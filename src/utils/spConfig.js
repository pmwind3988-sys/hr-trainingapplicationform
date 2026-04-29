/**
 * spConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central configuration + runtime loader for the HR Forms dashboard.
 *
 * ── How visibility works ─────────────────────────────────────────────────────
 *
 *   excludeAlways (hardcoded below)
 *     → Always hidden from EVERYONE including admins.
 *       These are system/internal SP lists that should never appear.
 *
 *   "Form Config" SP list  (admin-managed whitelist)
 *     → Defines which lists are visible to REGULAR USERS and their config.
 *       Admins see everything NOT in excludeAlways, regardless of this list.
 *
 *   So:
 *     Non-admin → only sees lists present in "Form Config"
 *     Admin     → sees ALL discovered lists EXCEPT excludeAlways entries
 *
 * ── "Form Config" SP list columns ───────────────────────────────────────────
 *   Title            → exact SP list display name
 *   Form_ID          → short form identifier (e.g. "TAF")
 *   Approval_Layers  → integer, total approval layers (0 = no approval chain)
 *
 * ── Example rows ─────────────────────────────────────────────────────────────
 *   Title                                  | Form_ID | Approval_Layers
 *   Training Application Form Submission   | TAF     | 2
 *   Training Needs Analysis Form           | TNA     | 2
 *   Training Evaluation Form               | TEF     | 0
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Static config — only edit this block
// ─────────────────────────────────────────────────────────────────────────────
export const SP_STATIC = {
  /** SharePoint site group name that grants admin access */
  adminGroup: "_HR_ Forms Owners",

  /**
   * Column name on each list item that holds the overall form status.
   * Set to null to rely purely on layer-derived status.
   */
  statusColumn: null,

  /**
   * Always hidden from EVERYONE including admins.
   * These are system/internal SP lists — add any list here that should
   * never appear in the dashboard under any circumstances.
   */
  excludeAlways: [
    "Style Library",
    "Site Assets",
    "Approvers",
    "Master Form",
    "Submission Log",
    "Approval Log",
    "Site Pages",
    "Form Templates",
    "Preservation Hold Library",
    "Pages",
    "Images",
    "Form Documents",
    "Form Config",       // the config list itself — never show as a form list
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Auto-generated visual metadata
// ─────────────────────────────────────────────────────────────────────────────
const META_PALETTES = [
  { color: "#5B21B6", pale: "#EDE9FE" },
  { color: "#1D4ED8", pale: "#DBEAFE" },
  { color: "#0891B2", pale: "#CFFAFE" },
  { color: "#059669", pale: "#D1FAE5" },
  { color: "#D97706", pale: "#FEF3C7" },
  { color: "#DC2626", pale: "#FEE2E2" },
  { color: "#7C3AED", pale: "#F3E8FF" },
  { color: "#0D9488", pale: "#CCFBF1" },
];

const ICON_POOL = ["📋", "📊", "⭐", "📝", "📁", "🗂️", "📌", "🔖", "📑", "🧾"];

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
}

function deriveCategory(title) {
  const words = title.split(/\s+/);
  return words.find(w => w.length > 2) || words[0] || "Form";
}

export function generateMeta(listTitle) {
  const h       = hashString(listTitle);
  const palette = META_PALETTES[h % META_PALETTES.length];
  const icon    = ICON_POOL[h % ICON_POOL.length];
  return { icon, color: palette.color, pale: palette.pale, category: deriveCategory(listTitle) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Runtime config loader
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG_LIST_NAME = "Master Form";
const LAYER_COL        = "NumberOfApprovalLayer";
const FORM_ID_COL      = "FormID";

/** Safely coerce any SP field value to a plain string */
function safeStr(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return String(val.LookupValue ?? val.Title ?? val.Id ?? "");
  return String(val).trim();
}

/**
 * loadConfig(spClient)
 * ────────────────────
 * Fetches "Form Config" and returns everything the dashboard needs:
 *
 *   {
 *     layerConfig   : { [listTitle]: number },
 *     formIdMap     : { [listTitle]: string },
 *     listMetaMap   : { [listTitle]: { icon, color, pale, category } },
 *     allowedTitles : Set<string>,   // lowercased — what non-admins can see
 *   }
 *
 * If the fetch fails, returns empty defaults — the dashboard still loads;
 * admins see everything (minus excludeAlways), non-admins see nothing.
 */
export async function loadConfig(spClient) {
  const empty = {
    layerConfig:   {},
    formIdMap:     {},
    listMetaMap:   {},
    allowedTitles: new Set(),
  };

  try {
    const items = await spClient.queryList(CONFIG_LIST_NAME, {
      select:  ["Title", LAYER_COL, FORM_ID_COL],
      orderby: "Title asc",
      top:     500,
    });

    const layerConfig   = {};
    const formIdMap     = {};
    const listMetaMap   = {};
    const allowedTitles = new Set();

    for (const item of items) {
      const title = safeStr(item.Title);
      if (!title) continue;

      const layers = parseInt(item[LAYER_COL] ?? 0, 10);
      const formId = safeStr(item[FORM_ID_COL]);

      layerConfig[title]   = isNaN(layers) ? 0 : layers;
      formIdMap[title]     = formId;
      listMetaMap[title]   = generateMeta(title);
      allowedTitles.add(title.toLowerCase());
    }

    return { layerConfig, formIdMap, listMetaMap, allowedTitles };

  } catch (e) {
    console.warn("[spConfig] loadConfig failed:", e.message);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Visibility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if a list title matches the hardcoded excludeAlways list */
function isAlwaysExcluded(title) {
  const lower = title.toLowerCase();
  return SP_STATIC.excludeAlways.some(ex => lower === ex.toLowerCase());
}

/**
 * filterVisibleLists(discoveredLists, isAdmin, allowedTitles)
 * ─────────────────────────────────────────────────────────────
 * discoveredLists — raw array from sp.discoverLists()
 * isAdmin         — boolean
 * allowedTitles   — Set<string> (lowercased) from loadConfig
 *
 * Admin    → all discovered lists EXCEPT excludeAlways
 * Non-admin → only lists present in allowedTitles (Form Config whitelist),
 *             and not in excludeAlways
 */
export function filterVisibleLists(discoveredLists, isAdmin, allowedTitles) {
  return discoveredLists.filter(l => {
    // Always block system lists for everyone
    if (isAlwaysExcluded(l.title)) return false;

    // Admins see everything else
    if (isAdmin) return true;

    // Non-admins: only what's whitelisted in Form Config
    return allowedTitles.has(l.title.toLowerCase());
  });
}

/**
 * getMissingConfigs(visibleLists, layerConfig)
 * Informational — returns titles of visible lists with no Form Config entry.
 * Shown as a dismissible warning to admins only.
 */
export function getMissingConfigs(visibleLists, layerConfig) {
  return visibleLists
    .filter(l => !(l.title in layerConfig))
    .map(l => l.title);
}