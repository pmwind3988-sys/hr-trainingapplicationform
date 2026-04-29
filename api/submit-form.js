/**
 * /api/submit-form.js
 *
 * Guest form submission via system account (Graph API).
 *
 * FIXES:
 *  - Use list GUIDs in all URLs (never encode display names in path)
 *  - Fetch existing SP columns and ONLY send fields that exist
 *    (prevents "Field X not recognized" 400s)
 *  - Full sanitization: strip __metadata, fix types, remove nulls/Title
 *  - Approver + conditional rule resolution via GUID-based fetches
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

// ─── helpers ──────────────────────────────────────────────────────────────────

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

/** Get list GUID by display name — match in JS, no encoding issues */
async function getListId(token, siteId, displayName) {
  const data = await graphGet(
    token,
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName`
  );
  const match = (data.value || []).find(
    l => l.displayName.toLowerCase() === displayName.toLowerCase()
  );
  return match?.id || null;
}

/** Fetch all items using list GUID — no $top, no encoded names, paginated */
async function fetchAllItems(token, siteId, listId) {
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields`;
  const items = [];
  while (url) {
    const data = await graphGet(token, url);
    items.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
    if (items.length > 1000) break;
  }
  return items;
}

/**
 * Get all column internal names that exist on a list.
 * Used to filter the submission body — only send fields that exist in SP.
 * Prevents "Field X not recognized" 400 errors.
 */
async function getListColumnNames(token, siteId, listId) {
  const data = await graphGet(
    token,
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=name,readOnly,hidden`
  );
  return new Set(
    (data.value || [])
      .filter(c => !c.readOnly && !c.hidden)
      .map(c => c.name)
  );
}

/**
 * Sanitize body for Graph API:
 *  - Strip __metadata and Title (SP-managed)
 *  - Remove nulls/undefined
 *  - Coerce "true"/"false" strings to booleans
 *  - Keep ISO dates as strings
 *  - Objects → JSON string
 *  - Only keep fields that exist as columns in the target SP list
 */
function sanitizeBody(body, allowedColumns) {
  const clean = {};

  for (const [key, val] of Object.entries(body)) {
    // Always strip these
    if (key === "__metadata") continue;
    if (key === "Title")      continue; // SP manages this internally

    // Only include fields that actually exist as columns in SP
    if (allowedColumns && !allowedColumns.has(key)) {
      console.warn(`[submit-form] skipping unknown column: ${key}`);
      continue;
    }

    // Skip nulls and undefined
    if (val === null || val === undefined) continue;

    // Boolean coercion
    if (val === "true")  { clean[key] = true;  continue; }
    if (val === "false") { clean[key] = false;  continue; }
    if (typeof val === "boolean") { clean[key] = val; continue; }

    // Numbers
    if (typeof val === "number") { clean[key] = val; continue; }

    // Objects/arrays → JSON string
    if (typeof val === "object") { clean[key] = JSON.stringify(val); continue; }

    // Strings
    if (typeof val === "string") {
      if (val === "") continue; // skip empty strings — avoids SP validation errors
      clean[key] = val;
      continue;
    }

    clean[key] = val;
  }

  return clean;
}

// ─── handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { listTitle, body: rawBody } = req.body || {};
  if (!listTitle || !rawBody) {
    return res.status(400).json({ error: "Missing listTitle or body" });
  }

  const SITE_ID = process.env.SP_SITE_ID;
  if (!SITE_ID || !process.env.TENANT_ID || !process.env.SYSTEM_CLIENT_ID || !process.env.SYSTEM_CLIENT_SECRET) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  try {
    const token = await getSystemToken();

    // ── 1. Get submission list GUID ───────────────────────────────────────────
    const listId = await getListId(token, SITE_ID, listTitle);
    if (!listId) {
      return res.status(404).json({ error: `List "${listTitle}" not found.` });
    }

    // ── 2. Get all valid column names for this list ───────────────────────────
    // This is the key fix: we only send fields that actually exist in SP.
    // Columns are provisioned during publish in AdminFormBuilder.
    // If a column wasn't provisioned (e.g. form was republished with new fields),
    // we skip it rather than 400ing the whole submission.
    const allowedColumns = await getListColumnNames(token, SITE_ID, listId);

    // ── 3. Build body with timestamps ────────────────────────────────────────
    const itemBody = { ...rawBody };
    if (!itemBody.SubmittedAt) itemBody.SubmittedAt = new Date().toISOString();
    if (!itemBody.SubmittedBy) itemBody.SubmittedBy = "GUEST";

    // ── 4. Resolve approvers if not already set ───────────────────────────────
    const needsApprovers = !itemBody.L1_Email && !itemBody.L1_Status;
    if (needsApprovers) {
      try {
        // Check for conditional rules first
        const masterListId = await getListId(token, SITE_ID, "Master Form");
        if (masterListId) {
          const cfgItems  = await fetchAllItems(token, SITE_ID, masterListId);
          const cfgFields = cfgItems.map(i => i.fields).find(f => f?.Title === listTitle);

          let resolvedViaRules = false;
          if (cfgFields?.ApprovalRules) {
            let rules;
            try { rules = JSON.parse(cfgFields.ApprovalRules); } catch {}
            if (rules?.conditionField && rules?.rules?.length) {
              const condVal = String(itemBody[rules.conditionField] ?? "").toLowerCase();
              const matched = rules.rules.find(r => r.when.toLowerCase() === condVal);
              if (matched?.layers?.length) {
                matched.layers.forEach((layer, n) => {
                  const num = n + 1;
                  itemBody[`L${num}_Email`]  = layer.email || "";
                  itemBody[`L${num}_Status`] = num === 1 ? "Pending" : "Waiting";
                  if (layer.name) itemBody[`L${num}_Name`] = layer.name;
                  if (layer.role) itemBody[`L${num}_Role`] = layer.role;
                });
                resolvedViaRules = true;
              }
            }
          }

          // Fall back to static Approvers list
          if (!resolvedViaRules) {
            const approversListId = await getListId(token, SITE_ID, "Approvers");
            if (approversListId) {
              const apItems = await fetchAllItems(token, SITE_ID, approversListId);
              const approvers = apItems
                .map(i => i.fields)
                .filter(f => f?.FormTitle === listTitle)
                .sort((a, b) => (a.LayerNumber || 0) - (b.LayerNumber || 0));

              approvers.forEach((ap, n) => {
                const num = n + 1;
                itemBody[`L${num}_Email`]  = ap.ApproverEmail || "";
                itemBody[`L${num}_Status`] = num === 1 ? "Pending" : "Waiting";
                if (ap.ApproverName) itemBody[`L${num}_Name`] = ap.ApproverName;
              });
            }
          }
        }
      } catch (e) {
        console.warn("[submit-form] approver resolution failed (non-fatal):", e.message);
      }
    }

    // ── 5. Sanitize — only known columns, correct types ───────────────────────
    const cleanBody = sanitizeBody(itemBody, allowedColumns);

    console.log("[submit-form] list:", listTitle, "| allowed columns:", allowedColumns.size);
    console.log("[submit-form] sending fields:", Object.keys(cleanBody));

    // ── 6. Write to SP via Graph ──────────────────────────────────────────────
    const writeRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept:         "application/json",
        },
        body: JSON.stringify({ fields: cleanBody }),
      }
    );

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      console.error("[submit-form] Graph write failed:", errText);
      return res.status(502).json({
        error:      `Graph write failed: ${writeRes.status}`,
        details:    errText.slice(0, 800),
        sentFields: Object.keys(cleanBody),
      });
    }

    const result = await writeRes.json();
    return res.status(200).json({ ok: true, id: result.id });

  } catch (e) {
    console.error("[submit-form] error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};