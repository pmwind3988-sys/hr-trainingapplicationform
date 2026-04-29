/**
 * /api/form-config.js
 *
 * Fetches form config + version JSON using system account.
 * Called by DynamicFormPage when visitor has no M365 session.
 *
 * FIX: Look up list by GUID first, then query items by GUID.
 * Never use encodeURIComponent(listName) in the URL path — Graph
 * rejects encoded spaces in list names. Always use the list's id.
 *
 * GET /api/form-config?slug=my-form
 * GET /api/form-config?slug=my-form&version=1.2
 */

const { readFileSync } = require("fs");
const { resolve }      = require("path");

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  envFile.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  });
} catch {}

// ─── shared helpers (also used by submit-form) ────────────────────────────────

async function getSystemToken() {
  const { TENANT_ID, SYSTEM_CLIENT_ID, SYSTEM_CLIENT_SECRET } = process.env;
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     SYSTEM_CLIENT_ID,
        client_secret: SYSTEM_CLIENT_SECRET,
        scope:         "https://graph.microsoft.com/.default",
      }).toString(),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function graphGet(token, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Graph GET ${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.json();
}

/**
 * Get list GUID by display name.
 * Uses /lists endpoint with $select only — no $filter, no encoding issues.
 * Matches in JS.
 */
async function getListId(token, siteId, displayName) {
  const data = await graphGet(
    token,
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName`
  );
  const match = (data.value || []).find(
    l => l.displayName.toLowerCase() === displayName.toLowerCase()
  );
  if (!match) throw new Error(`List "${displayName}" not found`);
  return match.id;
}

/**
 * Fetch all items from a list using its GUID.
 * Uses ?$expand=fields ONLY — no $top, no $filter, no $select in URL.
 * All filtering done in JS. Paginates via @odata.nextLink.
 */
async function fetchAllItems(token, siteId, listId) {
  // Use list GUID in path — never encode list display name
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields`;
  const items = [];
  while (url) {
    const data = await graphGet(token, url);
    items.push(...(data.value || []));
    // Use nextLink as-is — Graph builds it correctly
    url = data["@odata.nextLink"] || null;
    if (items.length > 1000) break; // safety cap
  }
  return items;
}

// ─── handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")    return res.status(405).json({ error: "Method not allowed" });

  const { slug, version } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const SITE_ID = process.env.SP_SITE_ID;
  if (!SITE_ID) return res.status(500).json({ error: "SP_SITE_ID not configured" });

  try {
    const token = await getSystemToken();

    // ── 1. Get Master Form list GUID ──────────────────────────────────────────
    const masterListId = await getListId(token, SITE_ID, "Master Form");

    // ── 2. Fetch all items, find by slug in JS ────────────────────────────────
    const cfgItems = await fetchAllItems(token, SITE_ID, masterListId);
    const cfgFields = cfgItems
      .map(i => i.fields)
      .find(f => f && f.Slug === slug && f.IsPublished === true);

    if (!cfgFields) {
      return res.status(404).json({ error: `Form "${slug}" not found or not published.` });
    }

    // ── 3. Get Web Form Versions list GUID ────────────────────────────────────
    const versionsListId = await getListId(token, SITE_ID, "Web Form Versions");

    // ── 4. Fetch all version items, find by title + version in JS ─────────────
    const targetVersion = version || cfgFields.CurrentVersion;
    const versionItems  = await fetchAllItems(token, SITE_ID, versionsListId);
    const versionFields = versionItems
      .map(i => i.fields)
      .find(f => f && f.FormTitle === cfgFields.Title && f.FormVersion === targetVersion);

    if (!versionFields?.SurveyJSON) {
      return res.status(404).json({
        error: `Version ${targetVersion} not found for "${cfgFields.Title}".`,
      });
    }

    // ── 5. Parse stored JSON ──────────────────────────────────────────────────
    let parsed;
    try { parsed = JSON.parse(versionFields.SurveyJSON); }
    catch { return res.status(500).json({ error: "Failed to parse version JSON." }); }

    // ── 6. Return ─────────────────────────────────────────────────────────────
    return res.status(200).json({
      formConfig: {
        Title:                 cfgFields.Title,
        FormID:                cfgFields.FormID                || "",
        CurrentVersion:        cfgFields.CurrentVersion         || "1.0",
        NumberOfApprovalLayer: cfgFields.NumberOfApprovalLayer  || 0,
        Slug:                  cfgFields.Slug                   || "",
        IsPublic:              cfgFields.IsPublic               !== false,
        ApprovalRules:         cfgFields.ApprovalRules          || null,
        ConditionField:        cfgFields.ConditionField          || "",
      },
      surveyJson: parsed.surveyJson || parsed,
      meta:       parsed.meta       || {},
    });

  } catch (e) {
    console.error("[/api/form-config]", e.message);
    return res.status(500).json({ error: e.message });
  }
};