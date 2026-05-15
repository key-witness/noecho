import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const stateDir = join(process.cwd(), ".noecho");
const statePath = join(stateDir, "server-state.json");
const snapshotTable = "noecho_state_snapshots";

function getSupabaseConfig() {
  const url = (process.env.NOECHO_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.NOECHO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    url,
    serviceKey,
    enabled: Boolean(url && serviceKey)
  };
}

function jsonHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
    ...extra
  };
}

async function supabaseRequest(path, { method = "GET", serviceKey, body, prefer } = {}) {
  const { url, enabled } = getSupabaseConfig();
  if (!enabled) {
    throw new Error("supabase not configured");
  }

  const response = await fetch(`${url}${path}`, {
    method,
    headers: jsonHeaders(serviceKey || getSupabaseConfig().serviceKey, prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `supabase request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function readLocalSnapshot() {
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function writeLocalSnapshot(snapshot) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(snapshot, null, 2)}\n`);
}

async function loadHostedSnapshot(preferredProfileId) {
  const { enabled, serviceKey } = getSupabaseConfig();
  if (!enabled) return null;

  let path = `/rest/v1/${snapshotTable}?select=profile_id,snapshot,updated_at&order=updated_at.desc&limit=1`;
  if (preferredProfileId) {
    path = `/rest/v1/${snapshotTable}?select=profile_id,snapshot,updated_at&profile_id=eq.${encodeURIComponent(preferredProfileId)}&limit=1`;
  }

  const rows = await supabaseRequest(path, { serviceKey });
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? row.snapshot : null;
}

async function saveHostedSnapshot(profileId, snapshot) {
  const { enabled, serviceKey } = getSupabaseConfig();
  if (!enabled || !profileId) return;

  await supabaseRequest(`/rest/v1/${snapshotTable}?on_conflict=profile_id`, {
    method: "POST",
    serviceKey,
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      profile_id: profileId,
      snapshot,
      updated_at: new Date().toISOString()
    }
  });
}

async function ensureHostedProfile(address) {
  const { enabled, serviceKey } = getSupabaseConfig();
  if (!enabled) {
    return `profile_${address.toLowerCase().slice(2, 10)}`;
  }

  const chain = "eip155";
  const existing = await supabaseRequest(
    `/rest/v1/wallet_identities?select=profile_id&chain=eq.${encodeURIComponent(chain)}&address=eq.${encodeURIComponent(address)}&limit=1`,
    { serviceKey }
  );
  const foundProfileId = Array.isArray(existing) && existing[0]?.profile_id;
  if (foundProfileId) {
    return foundProfileId;
  }

  const profile = await supabaseRequest("/rest/v1/profiles?select=id", {
    method: "POST",
    serviceKey,
    prefer: "return=representation",
    body: { display_name: address.slice(0, 10) }
  });
  const profileId = Array.isArray(profile) ? profile[0]?.id : profile?.[0]?.id;
  const finalProfileId = profileId || randomUUID();

  await supabaseRequest("/rest/v1/wallet_identities", {
    method: "POST",
    serviceKey,
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      profile_id: finalProfileId,
      chain,
      address
    }
  });

  return finalProfileId;
}

export function createStateStore() {
  let activeProfileId = null;

  return {
    async load(preferredProfileId) {
      const snapshot = (await loadHostedSnapshot(preferredProfileId)) || readLocalSnapshot();
      if (snapshot?.profileId) {
        activeProfileId = snapshot.profileId;
      }
      return snapshot;
    },
    async save(snapshot, profileId) {
      activeProfileId = profileId || snapshot?.profileId || activeProfileId;
      try {
        await saveHostedSnapshot(activeProfileId, snapshot);
      } catch {
        // Hosted sync is best-effort so local persistence remains reliable.
      }
    },
    async ensureProfileForAddress(address) {
      const profileId = await ensureHostedProfile(address);
      activeProfileId = profileId;
      return profileId;
    },
    getActiveProfileId() {
      return activeProfileId;
    },
    isHostedEnabled() {
      return getSupabaseConfig().enabled;
    },
    localStatePath: statePath
  };
}
