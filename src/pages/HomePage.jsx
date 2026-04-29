/**
 * HomePage.jsx  — Auto-discovery Submission Dashboard (SharePoint direct)
 * ─────────────────────────────────────────────────────────────────────────────
 * List configuration (names, approval layers, form IDs) is loaded at runtime
 * from the SharePoint "Documents" library — nothing is hardcoded here.
 *
 * See spConfig.js for:
 *   • SP_STATIC      — admin group, status column, exclude lists
 *   • loadFormConfig — fetches layerConfig / formIdMap / listMeta from SP
 *   • generateMeta   — auto-generates icon/colour/category for any list name
 *
 * ── Required env var ─────────────────────────────────────────────────────────
 *   REACT_APP_SP_SITE_URL   https://pmwgroupcom.sharepoint.com/sites/PMWHRDocs
 *   REACT_APP_AZURE_TENANT_ID
 */

import { useNavigate } from "react-router-dom";
import React, {
  useEffect, useState, useCallback, useMemo, useRef,
} from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import { createSpClient } from "../utils/sharepointClient";
import {
  SP_STATIC,
  loadConfig,
  filterVisibleLists,
  getMissingConfigs,
  generateMeta,
} from "../utils/spConfig";
import logo from "../assets/logo.png";

// ─────────────────────────────────────────────────────────────────────────────
//  Runtime config state (populated from SP on load — not hardcoded)
// ─────────────────────────────────────────────────────────────────────────────
//  layerConfig  : { [listTitle]: number }
//  formIdMap    : { [listTitle]: string }
//  listMetaMap  : { [listTitle]: { icon, color, pale, category } }
//
//  These are stored in React state (see loadedConfig state below) so the
//  whole component tree re-renders once the config is fetched.

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  purple: "#5B21B6",
  purpleLight: "#7C3AED",
  purplePale: "#EDE9FE",
  purpleMid: "#DDD6FE",
  purpleDark: "#3B0764",
  white: "#FFFFFF",
  offWhite: "#F8F7FF",
  border: "#E5E3F0",
  borderDark: "#C4B5FD",
  textPrimary: "#1E1B4B",
  textSecond: "#6B7280",
  textMuted: "#9CA3AF",
  green: "#059669",
  greenPale: "#D1FAE5",
  red: "#DC2626",
  redPale: "#FEE2E2",
  amber: "#D97706",
  amberPale: "#FEF3C7",
  shadow: "0 1px 3px rgba(91,33,182,0.08), 0 4px 16px rgba(91,33,182,0.06)",
  shadowMd: "0 4px 24px rgba(91,33,182,0.12)",
  shadowLg: "0 8px 40px rgba(91,33,182,0.16)",
};

const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:${C.offWhite};color:${C.textPrimary}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  input:focus,select:focus{outline:none;border-color:${C.purple}!important;box-shadow:0 0 0 3px ${C.purplePale}}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (v) => v ? new Date(v).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtDateShort = (v) => v ? new Date(v).toLocaleString("en-MY", { dateStyle: "short" }) : "—";
const pretty = (k) => k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, c => c.toUpperCase());

const ALLOWED_TENANT_ID = process.env.REACT_APP_AZURE_TENANT_ID;
const isAllowedTenant = (a) => (a?.tenantId ?? a?.idTokenClaims?.tid) === ALLOWED_TENANT_ID;

const SK = "homepage_auth_decision";
const getStored = () => { try { return localStorage.getItem(SK); } catch { return null; } };
const setStored = (v) => { try { localStorage.setItem(SK, v); } catch { } };
const clearStored = () => { try { localStorage.removeItem(SK); } catch { } };

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  fullyApproved: { label: "Fully Approved", bg: C.greenPale, color: C.green, dot: C.green },
  approved: { label: "Approved", bg: C.greenPale, color: C.green, dot: C.green },
  rejected: { label: "Rejected", bg: C.redPale, color: C.red, dot: C.red },
  inProgress: { label: "In Review", bg: C.purplePale, color: C.purple, dot: C.purple },
  pending: { label: "Pending", bg: C.amberPale, color: C.amber, dot: C.amber },
};
const getStatusCfg = (s) => {
  const k = (s || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (k.includes("fullyapproved")) return STATUS_CFG.fullyApproved;
  if (k === "approved") return STATUS_CFG.approved;
  if (k.includes("reject")) return STATUS_CFG.rejected;
  if (k.includes("progress") || k.includes("review")) return STATUS_CFG.inProgress;
  return STATUS_CFG.pending;
};

// ── Normalise a raw SP item ───────────────────────────────────────────────────
function normaliseItem(raw, listTitle, loadedConfig) {
  const { layerConfig, listMetaMap } = loadedConfig;
  const totalLayers = layerConfig[listTitle] ?? 0;
  const meta = listMetaMap[listTitle] ?? generateMeta(listTitle);

  const layers = Array.from({ length: totalLayers }, (_, i) => {
    const n = i + 1;
    const status = raw[`L${n}_Status`];
    if (!status) return null;
    return {
      status,
      outcome: status === "Rejected" ? "Rejected" : undefined,
      email: raw[`L${n}_Email`] ?? null,
      signedAt: raw[`L${n}_SignedAt`] ?? null,
      rejectionReason: raw[`L${n}_Rejection`] ?? null,
      signature: raw[`L${n}_Signature`] ?? null,
    };
  });

  let formStatus = SP_STATIC.statusColumn ? (raw[SP_STATIC.statusColumn] || null) : null;
  if (!formStatus && totalLayers > 0) {
    const hasRej = layers.some(l => l?.status === "Rejected");
    const allSign = layers.length > 0 && layers.every(l => l?.status === "Signed");
    const anySign = layers.some(l => l?.status === "Signed");
    if (hasRej) formStatus = "Rejected";
    else if (allSign) formStatus = "Fully Approved";
    else if (anySign) formStatus = "In Review";
    else formStatus = "Pending";
  }
  if (!formStatus) formStatus = "Pending";

  return {
    id: String(raw.Id),
    submissionId: String(raw.Id),
    listTitle,
    formId: loadedConfig.formIdMap[listTitle] || "",
    formVersion: raw.FormVersion ?? "1.0",
    title: listTitle,
    submittedByEmail: raw._authorEmail || "",
    submittedAt: raw.SubmittedAt || raw.Created || null,
    formStatus,
    totalLayers,
    layers,
    meta,
    submissionData: raw,
  };
}

// ── Fetch submissions from all visible lists in parallel ──────────────────────
async function fetchAllSubmissions(sp, visibleLists, userEmail, isAdmin, loadedConfig) {
  const results = await Promise.all(
    visibleLists.map(async (list) => {
      const opts = {
        select: ["Id", "Created", ...(SP_STATIC.statusColumn ? [SP_STATIC.statusColumn] : [])],
        orderby: "Created desc",
        top: 500,
      };
      if (!isAdmin) opts.filterByAuthorEmail = userEmail;

      try {
        const items = await sp.queryList(list.title, opts);
        return items.map(raw => normaliseItem(raw, list.title, loadedConfig));
      } catch (e) {
        console.error(`[HomePage] Failed to fetch "${list.title}":`, e.message);
        throw new Error(`Failed to load list "${list.title}": ${e.message}`);
      }
    })
  );
  return results.flat().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

// ─────────────────────────────────────────────────────────────────────────────
//  UI Primitives
// ─────────────────────────────────────────────────────────────────────────────
function Spinner({ size = 18 }) {
  return <div style={{ width: size, height: size, border: `2px solid ${C.purpleMid}`, borderTop: `2px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />;
}
function Skeleton({ w = "100%", h = 16, r = 6 }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#EDE9FE 25%,#DDD6FE 50%,#EDE9FE 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.6s infinite" }} />;
}
function StatusBadge({ status }) {
  const cfg = getStatusCfg(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
function ListBadge({ listTitle, listMetaMap }) {
  const m = (listMetaMap && listMetaMap[listTitle]) || generateMeta(listTitle);
  return <span style={{ background: m.pale, color: m.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{listTitle}</span>;
}
function RoleBadge({ isAdmin }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: isAdmin ? C.amber : C.purple, background: isAdmin ? C.amberPale : C.purplePale, borderRadius: 20, padding: "3px 10px", border: `1px solid ${isAdmin ? "#FDE68A" : C.purpleMid}`, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {isAdmin ? "⚙ Admin" : "User"}
    </span>
  );
}

// ── Config warning banner (non-blocking — lists without config still show) ────
function ConfigWarningBanner({ missingLists }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !missingLists.length) return null;
  return (
    <div style={{ background: C.amberPale, border: `1px solid #FDE68A`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 4 }}>Lists without a config entry in the Documents library</div>
        <div style={{ fontSize: 11, color: C.textSecond, lineHeight: 1.7 }}>
          The following discovered lists have no matching item in the <strong>Documents</strong> config library.
          They will appear with auto-generated defaults (0 approval layers). Add an entry for each to set the correct layer count and form ID:
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {missingLists.map(name => (
            <code key={name} style={{ fontSize: 11, background: C.white, color: C.amber, border: `1px solid #FDE68A`, borderRadius: 6, padding: "2px 8px" }}>{name}</code>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16, flexShrink: 0, padding: 0 }}>✕</button>
    </div>
  );
}

// ── UserMenu ──────────────────────────────────────────────────────────────────
function UserMenu({ userEmail, initials, onLogout, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 12px 4px 6px", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg,${C.purple},${C.purpleLight})`, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{initials}</div>
        <span style={{ fontSize: 12, color: C.textPrimary, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M3 4.5l3 3 3-3" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadowMd, minWidth: 200, zIndex: 100, animation: "fadeUp 0.15s ease" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted }}>Signed in as</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary, marginTop: 2, wordBreak: "break-all" }}>{userEmail}</div>
          </div>
          {[{ label: "🔄 Switch account", action: onSwitch }, { label: "🚪 Sign out", action: onLogout, danger: true }].map(({ label, action, danger }) => (
            <button key={label} onClick={() => { setOpen(false); action(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 14px", fontSize: 13, cursor: "pointer", color: danger ? C.red : C.textPrimary, fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = danger ? C.redPale : C.offWhite}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ userEmail, isAdmin, onLogout, onSwitch, onOpenBuilder }) {
  const initials = userEmail ? userEmail.split("@")[0].split(".").map(p => p[0]?.toUpperCase()).join("").slice(0, 2) : "?";
  return (
    <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 0 rgba(91,33,182,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src={logo} alt="logo" style={{ height: 28, objectFit: "contain" }} />
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 17, color: C.textPrimary, letterSpacing: "-0.01em" }}>PMW HR Forms</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isAdmin && (
          <button
            onClick={onOpenBuilder}
            style={{
              padding: "5px 14px", borderRadius: 7,
              border: `1px solid ${C.purpleMid}`,
              background: C.purplePale, color: C.purple,
              fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}
          >
            ⚙ Form Builder
          </button>
        )}
        <RoleBadge isAdmin={isAdmin} />
        <UserMenu userEmail={userEmail} initials={initials} onLogout={onLogout} onSwitch={onSwitch} />
      </div>
    </header>
  );
}

// Change signature:
function ListSummaryCards({ submissions, visibleLists, listMetaMap, isAdmin, onEditForm }) {
  const counts = useMemo(() => {
    const map = {};
    visibleLists.forEach(l => { map[l.title] = { total: 0, approved: 0, pending: 0, rejected: 0 }; });
    submissions.forEach(s => {
      const c = map[s.listTitle]; if (!c) return; c.total++;
      const k = (s.formStatus || "").toLowerCase().replace(/[\s_-]+/g, "");
      if (k.includes("fullyapproved") || k === "approved") c.approved++;
      else if (k.includes("reject")) c.rejected++;
      else c.pending++;
    });
    return map;
  }, [submissions, visibleLists]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(visibleLists.length, 4)},1fr)`, gap: 12, marginBottom: 24 }}>
      {visibleLists.map(list => {
        const meta = (listMetaMap && listMetaMap[list.title]) || generateMeta(list.title);
        const c = counts[list.title] || { total: 0, approved: 0, pending: 0, rejected: 0 };
        return (
          <div key={list.title} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 18px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: meta.pale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{meta.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>{list.title}</div>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{meta.category}</div>
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: meta.color, marginBottom: 8, fontFamily: "'DM Serif Display',serif" }}>{c.total}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.approved > 0 && <span style={{ fontSize: 10, color: C.green, background: C.greenPale, borderRadius: 12, padding: "2px 7px", fontWeight: 600 }}>✓ {c.approved}</span>}
              {c.pending > 0 && <span style={{ fontSize: 10, color: C.amber, background: C.amberPale, borderRadius: 12, padding: "2px 7px", fontWeight: 600 }}>⏳ {c.pending}</span>}
              {c.rejected > 0 && <span style={{ fontSize: 10, color: C.red, background: C.redPale, borderRadius: 12, padding: "2px 7px", fontWeight: 600 }}>✕ {c.rejected}</span>}
              {c.total === 0 && <span style={{ fontSize: 10, color: C.textMuted }}>No submissions yet</span>}
            </div>
            {isAdmin && (
              <button
                onClick={() => onEditForm(list.title)}
                style={{
                  marginTop: 12, width: "100%", padding: "5px 0",
                  border: `1px solid ${C.purpleMid}`,
                  borderRadius: 6, background: "none",
                  color: C.purple, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ✏ Edit Form
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ submissions }) {
  const total = submissions.length;
  const approved = submissions.filter(s => { const k = (s.formStatus || "").toLowerCase().replace(/[\s_-]+/g, ""); return k.includes("fullyapproved") || k === "approved"; }).length;
  const pending = submissions.filter(s => { const k = (s.formStatus || "").toLowerCase().replace(/[\s_-]+/g, ""); return !k.includes("approved") && !k.includes("reject"); }).length;
  const rejected = submissions.filter(s => (s.formStatus || "").toLowerCase().includes("reject")).length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
      {[{ label: "Total", value: total, color: C.purple }, { label: "Approved", value: approved, color: C.green }, { label: "Pending", value: pending, color: C.amber }, { label: "Rejected", value: rejected, color: C.red }].map(({ label, value, color }) => (
        <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", boxShadow: C.shadow }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar({ search, setSearch, listFilter, setListFilter, statusFilter, setStatusFilter, sortBy, setSortBy, submitterFilter, setSubmitterFilter, isAdmin, visibleLists, total, filtered }) {
  const sel = { height: 36, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", padding: "0 10px", color: C.textPrimary, background: C.white, cursor: "pointer" };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="6" cy="6" r="4.5" stroke={C.textMuted} strokeWidth="1.3" /><path d="M9.5 9.5l2.5 2.5" stroke={C.textMuted} strokeWidth="1.3" strokeLinecap="round" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search submissions…" style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 36, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.textPrimary, background: C.white }} />
        </div>
        <select value={listFilter} onChange={e => setListFilter(e.target.value)} style={sel}>
          <option value="All">All lists</option>
          {visibleLists.map(l => <option key={l.title} value={l.title}>{l.title}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          {["All", "Pending", "In Review", "Approved", "Fully Approved", "Rejected"].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="status">By status</option>
          <option value="list">By list</option>
        </select>
      </div>
      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="6.5" cy="4.5" r="2.5" stroke={C.textMuted} strokeWidth="1.3" /><path d="M2 11c0-2.5 9-2.5 9 0" stroke={C.textMuted} strokeWidth="1.3" strokeLinecap="round" /></svg>
            <input value={submitterFilter} onChange={e => setSubmitterFilter(e.target.value)} placeholder="Filter by submitter email…" style={{ width: "100%", paddingLeft: 30, paddingRight: 12, height: 34, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit", color: C.textPrimary, background: C.white }} />
          </div>
          <span style={{ fontSize: 10, color: C.amber, background: C.amberPale, borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>Admin — all users visible</span>
        </div>
      )}
      {(search || listFilter !== "All" || statusFilter !== "All") && (
        <div style={{ fontSize: 11, color: C.textMuted }}>Showing {filtered} of {total} submission{total !== 1 ? "s" : ""}</div>
      )}
    </div>
  );
}

// ── Submission list ───────────────────────────────────────────────────────────
function ListHeader({ isAdmin }) {
  const th = { fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "1fr 180px 180px 130px 120px 28px" : "1fr 180px 130px 120px 28px", gap: 12, padding: "6px 18px 8px" }}>
      <div style={th}>Submission</div>
      {isAdmin && <div style={th}>Submitted By</div>}
      <div style={th}>List</div>
      <div style={th}>Category</div>
      <div style={th}>Status</div>
      <div />
    </div>
  );
}

function SubmissionRow({ item, onView, isAdmin, listMetaMap }) {
  const meta = (listMetaMap && listMetaMap[item.listTitle]) || generateMeta(item.listTitle);
  const [hov, setHov] = useState(false);
  return (
    <div onClick={() => onView(item)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "grid", gridTemplateColumns: isAdmin ? "1fr 180px 180px 130px 120px 28px" : "1fr 180px 130px 120px 28px", alignItems: "center", gap: 12, padding: "13px 18px", background: hov ? C.purplePale : C.white, border: `1px solid ${hov ? C.purpleMid : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.12s", marginBottom: 5, boxShadow: hov ? C.shadowMd : C.shadow }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, marginBottom: 3 }}>
          {item.title}
          {item.formId && <span style={{ marginLeft: 8, fontSize: 10, color: C.textMuted, fontFamily: "monospace", background: C.offWhite, borderRadius: 4, padding: "1px 5px", border: `1px solid ${C.border}` }}>{item.formId}</span>}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{fmtDateShort(item.submittedAt)}{item.submissionId && <> · <span style={{ fontFamily: "monospace" }}>#{item.submissionId}</span></>}</div>
      </div>
      {isAdmin && <div style={{ fontSize: 11, color: C.textSecond, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.submittedByEmail || "—"}</div>}
      <ListBadge listTitle={item.listTitle} listMetaMap={listMetaMap} />
      <span style={{ fontSize: 12, color: C.textSecond }}>{meta.category || "—"}</span>
      <StatusBadge status={item.formStatus} />
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 10.5l3.5-3.5L5 3.5" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
const SKIP = new Set([
  "Id", "_authorEmail", "AuthorId", "EditorId", "FormVersion", "FormStatus",
  "TrainingNeedsHtml", "ContentsHtml", "EffectivenessHtml",
  "HodSignature", "ApplicantSignature", "EmployeeSignature",
  "L1_Status", "L1_Email", "L1_SignedAt", "L1_Rejection", "L1_Signature",
  "L2_Status", "L2_Email", "L2_SignedAt", "L2_Rejection", "L2_Signature",
  "L3_Status", "L3_Email", "L3_SignedAt", "L3_Rejection", "L3_Signature",
  "odata.type", "odata.id", "odata.etag", "odata.editLink",
  "FileSystemObjectType", "ServerRedirectedEmbedUri", "ServerRedirectedEmbedUrl",
  "ContentTypeId", "OData__UIVersionString", "Attachments", "GUID",
  "OData__ColorTag", "ComplianceAssetId",
]);

function DetailModal({ item, onClose }) {
  if (!item) return null;
  const meta = item.meta || generateMeta(item.listTitle);
  const data = item.submissionData || {};
  const entries = Object.entries(data).filter(([k, v]) => !SKIP.has(k) && typeof v !== "object" && v !== null && v !== "");
  const { layers = [], totalLayers = 0 } = item;
  const sigs = [
    { label: "Applicant Signature", src: data.ApplicantSignature },
    { label: "HOD Signature", src: data.HodSignature },
    { label: "Employee Signature", src: data.EmployeeSignature },
  ].filter(s => s.src);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(30,27,75,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}>
      <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 700, boxShadow: C.shadowLg, border: `1px solid ${C.border}`, animation: "fadeUp 0.2s ease" }}>
        <div style={{ background: `linear-gradient(135deg,${C.purpleDark},${C.purple})`, padding: "18px 22px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              {meta.icon} {item.listTitle}
              {item.formId && <span style={{ marginLeft: 8, background: "rgba(255,255,255,0.15)", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontFamily: "monospace" }}>{item.formId}</span>}
            </div>
            <div style={{ fontSize: 16, color: C.white, fontWeight: 500 }}>{item.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: C.white, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {/* Meta strip */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <StatusBadge status={item.formStatus} />
            <span style={{ fontSize: 12, color: C.textSecond }}>Submitted: {fmtDate(item.submittedAt)}</span>
            {item.submissionId && <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>SP #{item.submissionId}</span>}
            {item.submittedByEmail && <span style={{ fontSize: 11, color: C.textMuted }}>By: <strong style={{ color: C.textSecond }}>{item.submittedByEmail}</strong></span>}
          </div>

          {/* Generic field grid */}
          {entries.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 20 }}>
              {entries.map(([k, v]) => (
                <div key={k} style={{ gridColumn: String(v).length > 60 ? "1 / -1" : undefined }}>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>{pretty(k)}</div>
                  <div style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.offWhite, fontSize: 13, color: C.textPrimary, lineHeight: 1.6 }}>{String(v)}</div>
                </div>
              ))}
            </div>
          )}

          {/* HTML tables */}
          {data.TrainingNeedsHtml && (<div style={{ marginBottom: 20 }}><div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>Training Needs Table</div><div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: data.TrainingNeedsHtml }} /></div>)}
          {data.ContentsHtml && (<div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>Course Contents Rating</div><div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: data.ContentsHtml }} /></div>)}
          {data.EffectivenessHtml && (<div style={{ marginBottom: 20 }}><div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>Effectiveness Rating</div><div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: data.EffectivenessHtml }} /></div>)}

          {/* Signatures */}
          {sigs.length > 0 && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
              {sigs.map(({ label, src }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                  <div style={{ padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, display: "inline-block" }}>
                    <img src={src} alt={label} style={{ maxWidth: 220, maxHeight: 80, display: "block" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approval chain */}
          {totalLayers > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 600 }}>
                Approval Chain · {layers.filter(l => l?.status === "Signed").length} of {totalLayers} approved
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {layers.map((layer, i) => {
                  if (!layer) return (
                    <div key={i} style={{ padding: "10px 14px", borderRadius: 8, background: C.offWhite, border: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>Layer {i + 1}</span>
                      <span style={{ background: C.amberPale, color: C.amber, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>Awaiting</span>
                    </div>
                  );
                  const isApp = layer.status === "Signed" && layer.outcome !== "Rejected";
                  const isRej = layer.outcome === "Rejected" || layer.status === "Rejected";
                  return (
                    <div key={i} style={{ padding: "12px 14px", borderRadius: 8, background: isRej ? C.redPale : isApp ? C.greenPale : C.offWhite, border: `1px solid ${isRej ? "#FCA5A5" : isApp ? "#6EE7B7" : C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>Layer {i + 1}</div>
                          {layer.email && <div style={{ fontSize: 11, color: C.textSecond }}>{layer.email}</div>}
                          {layer.signedAt && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{isRej ? "Rejected" : "Signed"} at {fmtDate(layer.signedAt)}</div>}
                          {layer.rejectionReason && <div style={{ fontSize: 11, color: C.red, marginTop: 4, fontStyle: "italic" }}>Reason: {layer.rejectionReason}</div>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: isRej ? C.red : isApp ? C.green : C.amber, color: C.white }}>
                          {isRej ? "Rejected" : isApp ? "Approved" : "Pending"}
                        </span>
                      </div>
                      {layer.signature && (<div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${isRej ? "#FCA5A5" : "#6EE7B7"}` }}><img src={layer.signature} alt="sig" style={{ maxWidth: 160, maxHeight: 50, display: "block" }} /></div>)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ padding: "10px 14px", background: C.offWhite, borderRadius: 8, fontSize: 12, color: C.textMuted, textAlign: "center" }}>
            🔒 Read-only — submissions cannot be edited or deleted from this portal.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auxiliary screens ─────────────────────────────────────────────────────────
function EmptyState({ hasFilters, isAdmin }) {
  return (
    <div style={{ textAlign: "center", padding: "52px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>{hasFilters ? "No submissions match your filters" : "No submissions yet"}</div>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>{hasFilters ? "Try adjusting your filters." : isAdmin ? "No submissions across any list yet." : "Your submissions will appear here after you fill out a form."}</p>
    </div>
  );
}

function DashboardSkeleton({ userEmail }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{G}</style>
      <Header userEmail={userEmail} isAdmin={false} onLogout={() => { }} onSwitch={() => { }} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {[...Array(3)].map((_, i) => (<div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}><Skeleton w="55%" h={12} r={4} /><div style={{ marginTop: 12 }}><Skeleton w="30%" h={28} r={4} /></div></div>))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[...Array(4)].map((_, i) => (<div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}><Skeleton w="50%" h={10} r={4} /><div style={{ marginTop: 10 }}><Skeleton w="30%" h={24} r={4} /></div></div>))}
        </div>
        {[...Array(5)].map((_, i) => (<div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 5, display: "flex", gap: 14, alignItems: "center" }}><div style={{ flex: 1 }}><Skeleton w="40%" h={13} r={4} /><div style={{ marginTop: 6 }}><Skeleton w="25%" h={10} r={4} /></div></div><Skeleton w={130} h={22} r={11} /><Skeleton w={90} h={22} r={11} /><Skeleton w={100} h={22} r={11} /></div>))}
      </div>
    </div>
  );
}

function WrongTenantScreen({ userEmail, onLogout, onSwitch }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{G}</style>
      <div style={{ background: C.white, borderRadius: 16, padding: "48px 44px", maxWidth: 440, textAlign: "center", boxShadow: C.shadowMd, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.red, marginBottom: 10, fontWeight: 400 }}>Access Restricted</h2>
        <p style={{ color: C.textSecond, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}><strong>{userEmail}</strong> is not part of the authorised PMW organisation.</p>
        <button onClick={onSwitch} style={{ width: "100%", padding: 12, borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>🔄 Sign in with a different account</button>
        <button onClick={onLogout} style={{ width: "100%", padding: 12, borderRadius: 8, background: "none", color: C.red, border: `1px solid ${C.redPale}`, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🚪 Sign out</button>
      </div>
    </div>
  );
}

function ChoiceScreen({ onLogin, onGuest }) {
  const [remember, setRemember] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{G}</style>
      <div style={{ background: C.white, borderRadius: 20, padding: "48px 40px", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: C.shadowMd, border: `1px solid ${C.border}`, animation: "fadeUp 0.3s ease" }}>
        <div style={{ margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={logo} alt="logo" style={{ maxWidth: 140, height: "auto", objectFit: "contain" }} /></div>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, fontWeight: 400, color: C.textPrimary, marginBottom: 8 }}>PMW HR Forms</h1>
        <p style={{ color: C.textSecond, fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>Sign in with your Microsoft 365 account to view your submission history and approval status.</p>
        <button onClick={onLogin} style={{ width: "100%", padding: "13px", borderRadius: 10, background: C.purple, color: C.white, border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          onMouseEnter={e => e.currentTarget.style.background = C.purpleLight} onMouseLeave={e => e.currentTarget.style.background = C.purple}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7.5" height="7.5" fill="#F25022" /><rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00" /><rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF" /><rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900" /></svg>
          Sign in with Microsoft 365
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: C.textSecond, marginBottom: 14, userSelect: "none", justifyContent: "center" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 14, height: 14, cursor: "pointer", accentColor: C.purple }} />
          Remember my choice on this device
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><div style={{ flex: 1, height: 1, background: C.border }} /><span style={{ fontSize: 11, color: C.textMuted }}>or</span><div style={{ flex: 1, height: 1, background: C.border }} /></div>
        <button onClick={() => { if (remember) setStored("guest"); onGuest(); }} style={{ width: "100%", padding: "11px", borderRadius: 10, background: "none", color: C.textSecond, border: `1px solid ${C.border}`, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.borderDark} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
          Continue as guest →
        </button>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 18, lineHeight: 1.6 }}>Only PMW internal M365 accounts are permitted.<br />Guests can browse but cannot view submissions.</p>
      </div>
    </div>
  );
}

function GuestLanding({ onLogin, onForgetChoice }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{G}</style>
      <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src={logo} alt="logo" style={{ height: 26, objectFit: "contain" }} /><span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>PMW HR Forms</span></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onForgetChoice} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, color: C.textSecond, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          <button onClick={onLogin} style={{ background: C.purple, color: C.white, border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Sign in</button>
        </div>
      </header>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px", textAlign: "center", animation: "fadeUp 0.3s ease" }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>📋</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 26, fontWeight: 400, color: C.textPrimary, marginBottom: 12 }}>PMW HR Forms Portal</h2>
        <p style={{ color: C.textSecond, fontSize: 14, lineHeight: 1.8, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>Sign in with your company Microsoft 365 account to submit forms and track approval status.</p>
        <button onClick={onLogin} style={{ padding: "12px 32px", borderRadius: 10, background: C.purple, color: C.white, border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Sign in with Microsoft 365</button>
      </main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ submissions, visibleLists, userEmail, isAdmin, onLogout, onSwitch, loadedConfig, missingConfigs }) {
  const { listMetaMap } = loadedConfig;
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date_desc");
  const [submitterFilter, setSubmitterFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const processed = useMemo(() => {
    let list = [...submissions];
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(s => JSON.stringify(s).toLowerCase().includes(q)); }
    if (listFilter !== "All") list = list.filter(s => s.listTitle === listFilter);
    if (statusFilter !== "All") list = list.filter(s => getStatusCfg(s.formStatus).label.toLowerCase().includes(statusFilter.toLowerCase()));
    if (isAdmin && submitterFilter.trim()) { const q = submitterFilter.trim().toLowerCase(); list = list.filter(s => (s.submittedByEmail || "").toLowerCase().includes(q)); }
    list.sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b.submittedAt) - new Date(a.submittedAt);
      if (sortBy === "date_asc") return new Date(a.submittedAt) - new Date(b.submittedAt);
      if (sortBy === "status") return (a.formStatus || "").localeCompare(b.formStatus || "");
      if (sortBy === "list") return (a.listTitle || "").localeCompare(b.listTitle || "");
      return 0;
    });
    return list;
  }, [submissions, search, listFilter, statusFilter, sortBy, isAdmin, submitterFilter]);

  const navigate = useNavigate();
  const handleEditForm = useCallback((listTitle) => {
    navigate(`/admin/builder/${encodeURIComponent(listTitle)}`);
  }, [navigate]);

  const hasFilters = !!(search || listFilter !== "All" || statusFilter !== "All" || (isAdmin && submitterFilter));

  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{G}</style>
      <Header
        userEmail={userEmail}
        isAdmin={isAdmin}
        onLogout={onLogout}
        onSwitch={onSwitch}
        onOpenBuilder={() => navigate("/admin/builder")}   // ADD
      />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{isAdmin ? "All Submissions" : "My Submissions"}</h1>
          <p style={{ fontSize: 13, color: C.textSecond }}>{isAdmin ? "Admin view — all submissions from all users across all lists. Read-only." : "All your form submissions. Read-only — contact HR to make changes."}</p>
        </div>

        {/* ADD THIS BLOCK */}
        {isAdmin && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", marginBottom: 16,
            background: C.amberPale, border: "1px solid #FDE68A", borderRadius: 10,
          }}>
            <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>
              ⚙ Admin Tools
            </span>
            <button
              onClick={() => navigate("/admin/builder")}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
                color: C.white, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ＋ New Form
            </button>
          </div>
        )}

        {/* Non-blocking warning for lists without SP config entries */}
        {isAdmin && <ConfigWarningBanner missingLists={missingConfigs} />}

        <ListSummaryCards
          submissions={submissions}
          visibleLists={visibleLists}
          listMetaMap={listMetaMap}
          isAdmin={isAdmin}                  // ADD
          onEditForm={handleEditForm}        // ADD
        />
        <StatsRow submissions={processed} />
        <Toolbar search={search} setSearch={setSearch} listFilter={listFilter} setListFilter={setListFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sortBy={sortBy} setSortBy={setSortBy} submitterFilter={submitterFilter} setSubmitterFilter={setSubmitterFilter} isAdmin={isAdmin} visibleLists={visibleLists} total={submissions.length} filtered={processed.length} />
        {processed.length === 0
          ? <EmptyState hasFilters={hasFilters} isAdmin={isAdmin} />
          : <div><ListHeader isAdmin={isAdmin} />{processed.map(item => (<SubmissionRow key={`${item.listTitle}-${item.id}`} item={item} onView={setSelectedItem} isAdmin={isAdmin} listMetaMap={listMetaMap} />))}</div>
        }
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textMuted, paddingBottom: 40 }}>PMW International Berhad · HR Forms · Confidential</div>
      </main>
      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [pageState, setPageState] = useState("checking");
  const [submissions, setSubmissions] = useState([]);
  const [visibleLists, setVisibleLists] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [missingConfigs, setMissingConfigs] = useState([]);
  const [loadedConfig, setLoadedConfig] = useState({
    layerConfig: {},
    formIdMap: {},
    listMetaMap: {},
  });

  const userEmail = accounts[0]?.username || "";

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;
    if (isAuthenticated) {
      if (pageState === "checking") {
        if (!isAllowedTenant(accounts[0])) { setPageState("wrong_tenant"); return; }
        setPageState("loading");
      }
      return;
    }
    if (pageState === "checking") setPageState(getStored() === "guest" ? "guest" : "choice");
  }, [isAuthenticated, inProgress, accounts, pageState]);

  useEffect(() => {
    if (pageState !== "loading" || !isAuthenticated) return;
    const sp = createSpClient(instance, accounts);

    async function load() {
      try {
        // Step 1 — admin check, list discovery and config all run in parallel
        const [adminResult, listsResult, configResult] = await Promise.allSettled([
          sp.isGroupMember(SP_STATIC.adminGroup),
          sp.discoverLists(),
          loadConfig(sp),
        ]);

        if (listsResult.status === "rejected") {
          throw new Error(`List discovery failed: ${listsResult.reason?.message}`);
        }
        if (configResult.status === "rejected") {
          throw new Error(`Config load failed: ${configResult.reason?.message}`);
        }

        const admin = adminResult.status === "fulfilled" ? adminResult.value : false;
        const discovered = listsResult.value;
        // { layerConfig, formIdMap, listMetaMap, allowedTitles }
        const config = configResult.value;

        // Admins: all lists minus excludeAlways
        // Non-admins: only lists in Form Config whitelist
        const visible = filterVisibleLists(discovered, admin, config.allowedTitles);

        // Warn (non-blocking) about lists with no entry in the Documents config library
        const missing = getMissingConfigs(visible, config.layerConfig);
        setMissingConfigs(missing);

        setIsAdmin(admin);
        setVisibleLists(visible);
        setLoadedConfig(config);

        // Step 2 — fetch all submissions using the runtime config
        const items = await fetchAllSubmissions(sp, visible, userEmail, admin, config);
        setSubmissions(items);
        setPageState("ready");
      } catch (e) {
        console.error("[HomePage]", e);
        setErrorMsg(e.message || "Unable to load submissions. Please try again.");
        setPageState("error");
      }
    }

    load();
  }, [pageState, isAuthenticated, instance, accounts, userEmail]);

  const handleLogin = useCallback(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account", redirectUri: window.location.origin }), [instance]);
  const handleLogout = useCallback(() => { clearStored(); instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }); }, [instance]);
  const handleSwitch = useCallback(() => instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.href, onRedirectNavigate: () => false }).catch(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account", redirectUri: window.location.origin })), [instance, accounts]);
  const handleGuest = useCallback(() => setPageState("guest"), []);
  const handleForgetChoice = useCallback(() => { clearStored(); setPageState("choice"); }, []);

  if (pageState === "checking" || inProgress !== InteractionStatus.None)
    return <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}><style>{G}</style><Spinner size={36} /></div>;

  if (pageState === "choice") return <ChoiceScreen onLogin={handleLogin} onGuest={handleGuest} />;
  if (pageState === "guest") return <GuestLanding onLogin={handleLogin} onForgetChoice={handleForgetChoice} />;
  if (pageState === "wrong_tenant") return <WrongTenantScreen userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;
  if (pageState === "loading") return <DashboardSkeleton userEmail={userEmail} />;

  if (pageState === "error") return (
    <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{G}</style>
      <div style={{ background: C.white, borderRadius: 16, padding: "48px 44px", maxWidth: 400, textAlign: "center", boxShadow: C.shadowMd, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>❌</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.red, fontWeight: 400, marginBottom: 10 }}>Something went wrong</h2>
        <p style={{ color: C.textSecond, fontSize: 13, marginBottom: 24 }}>{errorMsg}</p>
        <button onClick={() => setPageState("loading")} style={{ padding: "10px 24px", borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
      </div>
    </div>
  );

  return (
    <Dashboard
      submissions={submissions}
      visibleLists={visibleLists}
      userEmail={userEmail}
      isAdmin={isAdmin}
      onLogout={handleLogout}
      onSwitch={handleSwitch}
      loadedConfig={loadedConfig}
      missingConfigs={missingConfigs}
    />
  );
}