/**
 * HomePage.jsx  — Submission Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * First visit: shows a "Sign in or continue as guest" choice screen.
 * Guest → sees a read-only public landing with no submission data.
 * Signed in → full dashboard with all their submissions.
 *
 * Key difference from before: NO useMsalAuthentication (no auto-redirect).
 * Login is only triggered when the user explicitly clicks "Sign in".
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import logo from "../assets/logo.png";

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
  blue: "#1D4ED8",
  bluePale: "#DBEAFE",
  shadow: "0 1px 3px rgba(91,33,182,0.08), 0 4px 16px rgba(91,33,182,0.06)",
  shadowMd: "0 4px 24px rgba(91,33,182,0.12)",
  shadowLg: "0 8px 40px rgba(91,33,182,0.16)",
};

const G = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:${C.offWhite};color:${C.textPrimary}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  input:focus,select:focus{outline:none;border-color:${C.purple}!important;box-shadow:0 0 0 3px ${C.purplePale}}
`;

const STORAGE_KEY = "homepage_auth_decision";

function getStoredDecision() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function setStoredDecision(val) {
  try { localStorage.setItem(STORAGE_KEY, val); } catch { }
}
function clearStoredDecision() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (v) =>
  v ? new Date(v).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—";

const fmtDateShort = (v) =>
  v ? new Date(v).toLocaleString("en-MY", { dateStyle: "short" }) : "—";

const FORM_CATALOG = {
  "1": { label: "Training Requisition", category: "Training", color: C.purple, pale: C.purplePale },
  "2": { label: "Training Needs Analysis", category: "Training", color: C.blue, pale: C.bluePale },
};

const STATUS_CONFIG = {
  fullyApproved: { label: "Fully Approved", bg: C.greenPale, color: C.green, dot: C.green },
  rejected: { label: "Rejected", bg: C.redPale, color: C.red, dot: C.red },
  inProgress: { label: "In Review", bg: C.purplePale, color: C.purple, dot: C.purple },
  pending: { label: "Pending", bg: C.amberPale, color: C.amber, dot: C.amber },
};

const getStatus = (s) => {
  const key = (s || "").toLowerCase().replace(/\s+/g, "");
  if (key.includes("fullyapproved") || key === "approved") return STATUS_CONFIG.fullyApproved;
  if (key.includes("reject")) return STATUS_CONFIG.rejected;
  if (key.includes("progress") || key.includes("review")) return STATUS_CONFIG.inProgress;
  return STATUS_CONFIG.pending;
};

const ALLOWED_TENANT_ID = process.env.REACT_APP_AZURE_TENANT_ID;
const isAllowedTenant = (account) =>
  (account?.tenantId ?? account?.idTokenClaims?.tid) === ALLOWED_TENANT_ID;

// ── Primitives ────────────────────────────────────────────────────────────────
function Spinner({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size, border: `2px solid ${C.purpleMid}`,
      borderTop: `2px solid ${C.purple}`, borderRadius: "50%",
      animation: "spin 0.9s linear infinite", flexShrink: 0,
    }} />
  );
}

function Skeleton({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#EDE9FE 25%,#DDD6FE 50%,#EDE9FE 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.6s infinite",
    }} />
  );
}

function StatusBadge({ status }) {
  const cfg = getStatus(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: cfg.bg, color: cfg.color,
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function FormTypeBadge({ formId }) {
  const meta = FORM_CATALOG[formId] || { label: `Form #${formId}`, color: C.textMuted, pale: C.offWhite };
  return (
    <span style={{
      background: meta.pale, color: meta.color,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

// ── Choice screen (shown before any login) ────────────────────────────────────
function ChoiceScreen({ onLogin, onGuest }) {
  const [remember, setRemember] = useState(false);

  const handleGuest = () => {
    if (remember) setStoredDecision("guest");
    onGuest();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.offWhite,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{G}</style>

      <div
        style={{
          background: C.white,
          borderRadius: 20,
          padding: "48px 40px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          boxShadow: C.shadowMd,
          border: `1px solid ${C.border}`,
          animation: "fadeUp 0.3s ease",
        }}
      >
        {/* Logo (natural, no background) */}
        <div
          style={{
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={logo}
            alt="logo"
            style={{
              maxWidth: 140,
              height: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 24,
            fontWeight: 400,
            color: C.textPrimary,
            marginBottom: 8,
          }}
        >
          PMW HR Forms
        </h1>

        <p
          style={{
            color: C.textSecond,
            fontSize: 13,
            lineHeight: 1.7,
            marginBottom: 30,
          }}
        >
          Sign in with your Microsoft 365 account to view your submission history
          and approval status — or continue as a guest.
        </p>

        {/* Sign in */}
        <button
          onClick={onLogin}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 10,
            background: C.purple,
            color: C.white,
            border: "none",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = C.purpleLight)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = C.purple)
          }
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="7.5" height="7.5" fill="#F25022" />
            <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00" />
            <rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF" />
            <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900" />
          </svg>
          Sign in with Microsoft 365
        </button>

        {/* Remember choice */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 12,
            color: C.textSecond,
            marginBottom: 14,
            userSelect: "none",
            justifyContent: "center",
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{
              width: 14,
              height: 14,
              cursor: "pointer",
              accentColor: C.purple,
            }}
          />
          Remember my choice on this device
        </label>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, color: C.textMuted }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Guest */}
        <button
          onClick={handleGuest}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 10,
            background: "none",
            color: C.textSecond,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = C.borderDark)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = C.border)
          }
        >
          Continue as guest →
        </button>

        <p
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginTop: 18,
            lineHeight: 1.6,
          }}
        >
          Guests can browse but cannot view submission history.
          <br />
          Only PMW organisation accounts are permitted to sign in.
        </p>
      </div>
    </div>
  );
}

// ── Guest landing (no submissions, prompt to sign in) ─────────────────────────
function GuestLanding({ onLogin, onForgetChoice }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{G}</style>
      {/* Minimal header */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 4h9M2 6.5h6.5M2 9h4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>PMW HR Forms</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onForgetChoice}
            style={{
              background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "5px 12px", fontSize: 12, color: C.textSecond,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
          <button
            onClick={onLogin}
            style={{
              background: C.purple, color: C.white, border: "none", borderRadius: 6,
              padding: "6px 16px", fontSize: 12, cursor: "pointer",
              fontFamily: "inherit", fontWeight: 500,
            }}
          >
            Sign in
          </button>
        </div>
      </header>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "calc(100vh - 56px)", padding: 20,
      }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>👋</div>
          <h2 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400,
            color: C.textPrimary, marginBottom: 10,
          }}>
            You're browsing as a guest
          </h2>
          <p style={{ color: C.textSecond, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            To view your submitted forms and their approval status, sign in with your PMW Microsoft 365 account.
          </p>
          <button
            onClick={onLogin}
            style={{
              padding: "12px 28px", borderRadius: 10,
              background: C.purple, color: C.white, border: "none",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6.5" height="6.5" fill="#F25022" />
              <rect x="8.5" y="1" width="6.5" height="6.5" fill="#7FBA00" />
              <rect x="1" y="8.5" width="6.5" height="6.5" fill="#00A4EF" />
              <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFB900" />
            </svg>
            Sign in with Microsoft 365
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page header (dashboard) ───────────────────────────────────────────────────
function Header({ userEmail, onLogout, onSwitch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const initials = userEmail
    ? userEmail.split("@")[0].split(".").map(p => p[0]?.toUpperCase()).join("").slice(0, 2)
    : "?";

  return (
    <header style={{
      background: C.white, borderBottom: `1px solid ${C.border}`,
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 1px 0 rgba(91,33,182,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M2 7h7M2 10h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.01em" }}>My Submissions</div>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>PMW HR Forms</div>
        </div>
      </div>

      <div ref={ref} style={{ position: "relative" }}>
        <div
          onClick={() => setMenuOpen(o => !o)}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.borderDark}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          style={{
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
            padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.white, transition: "border-color 0.15s", userSelect: "none",
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
            color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600,
          }}>{initials}</div>
          <span style={{ fontSize: 13, color: C.textPrimary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userEmail}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
            <path d="M2 4l4 4 4-4" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {menuOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: 10, boxShadow: C.shadowLg, minWidth: 220, overflow: "hidden",
            animation: "fadeUp 0.15s ease", zIndex: 200,
          }}>
            <div style={{ padding: "10px 14px", background: C.offWhite, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Signed in as</div>
              <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500, marginTop: 2, wordBreak: "break-all" }}>{userEmail}</div>
            </div>
            {[
              { icon: "🔄", label: "Switch account", action: onSwitch },
              { icon: "🚪", label: "Sign out", action: onLogout, danger: true },
            ].map(({ icon, label, action, danger }) => (
              <button key={label} onClick={() => { setMenuOpen(false); action(); }}
                onMouseEnter={e => e.currentTarget.style.background = C.offWhite}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
                style={{
                  width: "100%", padding: "10px 14px", background: "none", border: "none",
                  textAlign: "left", cursor: "pointer", fontSize: 13,
                  color: danger ? C.red : C.textPrimary,
                  display: "flex", alignItems: "center", gap: 10,
                  fontFamily: "inherit", transition: "background 0.1s",
                }}
              >{icon} {label}</button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ submissions }) {
  const total = submissions.length;
  const approved = submissions.filter(s => getStatus(s.formStatus).label.includes("Approved")).length;
  const pending = submissions.filter(s => ["Pending", "In Review"].includes(getStatus(s.formStatus).label)).length;
  const rejected = submissions.filter(s => getStatus(s.formStatus).label === "Rejected").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
      {[
        { label: "Total Submitted", value: total, color: C.purple },
        { label: "Approved", value: approved, color: C.green },
        { label: "Pending / In Review", value: pending, color: C.amber },
        { label: "Rejected", value: rejected, color: C.red },
      ].map(({ label, value, color }) => (
        <div key={label} style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "16px 18px", boxShadow: C.shadow,
        }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
const inputStyle = {
  padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
  fontSize: 13, color: C.textPrimary, background: C.white,
  fontFamily: "inherit", transition: "border-color 0.15s",
};

function Toolbar({ search, setSearch, category, setCategory, sortBy, setSortBy, total, filtered }) {
  const categories = ["All", ...new Set(Object.values(FORM_CATALOG).map(f => f.category))];
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <circle cx="6" cy="6" r="4.5" stroke={C.textMuted} strokeWidth="1.2" />
          <path d="M9.5 9.5L13 13" stroke={C.textMuted} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          style={{ ...inputStyle, paddingLeft: 32, width: "100%" }}
          placeholder="Search submissions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
        {categories.map(c => <option key={c}>{c}</option>)}
      </select>
      <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
        <option value="date_desc">Newest first</option>
        <option value="date_asc">Oldest first</option>
        <option value="status">By status</option>
        <option value="form">By form type</option>
      </select>
      <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>{filtered} of {total}</span>
    </div>
  );
}

// ── Submission row ────────────────────────────────────────────────────────────
function SubmissionRow({ item, onView }) {
  const meta = FORM_CATALOG[item.formId] || { label: `Form #${item.formId}`, category: "Other" };
  return (
    <div
      onClick={() => onView(item)}
      onMouseEnter={e => { e.currentTarget.style.background = C.purplePale; e.currentTarget.style.borderColor = C.purpleMid; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.border; }}
      style={{
        display: "grid", gridTemplateColumns: "1fr 160px 130px 120px 80px",
        alignItems: "center", gap: 16, padding: "14px 20px",
        background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
        cursor: "pointer", transition: "all 0.15s", marginBottom: 6, boxShadow: C.shadow,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, marginBottom: 3 }}>
          {item.title || meta.label}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          Submitted {fmtDateShort(item.submittedAt)}
          {item.submissionId && <> · <span style={{ fontFamily: "monospace" }}>#{item.submissionId}</span></>}
        </div>
      </div>
      <FormTypeBadge formId={item.formId} />
      <span style={{ fontSize: 12, color: C.textSecond }}>{meta.category}</span>
      <StatusBadge status={item.formStatus} />
      <div style={{ textAlign: "right" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 12l4-4-4-4" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ── Category group ────────────────────────────────────────────────────────────
function CategoryGroup({ category, items, onView }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.purple, textTransform: "uppercase", letterSpacing: "0.06em" }}>{category}</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 11, color: C.textMuted }}>{items.length} form{items.length !== 1 ? "s" : ""}</span>
      </div>
      {items.map(item => <SubmissionRow key={item.id || item.submissionId} item={item} onView={onView} />)}
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ item, onClose }) {
  if (!item) return null;
  const meta = FORM_CATALOG[item.formId] || { label: `Form #${item.formId}` };
  const data = item.submissionData || item;
  const pretty = (k) => k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, c => c.toUpperCase());
  const skip = new Set(["training_needs_html", "formId", "formVersion", "baseUrl", "hod_signature", "applicantSignature"]);
  const entries = Object.entries(data).filter(([k, v]) => !skip.has(k) && typeof v !== "object" && v !== null && v !== "");

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(30,27,75,0.5)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 20px", overflowY: "auto",
      }}
    >
      <div style={{
        background: C.white, borderRadius: 16, width: "100%", maxWidth: 680,
        boxShadow: C.shadowLg, border: `1px solid ${C.border}`,
        animation: "fadeUp 0.2s ease",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
          padding: "18px 22px", borderRadius: "16px 16px 0 0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{meta.category} · {meta.label}</div>
            <div style={{ fontSize: 16, color: C.white, fontWeight: 500 }}>{item.title || meta.label}</div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: C.white,
            width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        <div style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <StatusBadge status={item.formStatus} />
            <span style={{ fontSize: 12, color: C.textSecond }}>Submitted: {fmtDate(item.submittedAt)}</span>
            {item.submissionId && <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>#{item.submissionId}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 20 }}>
            {entries.map(([key, value]) => (
              <div key={key} style={{ gridColumn: String(value).length > 60 ? "1 / -1" : undefined }}>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>{pretty(key)}</div>
                <div style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.offWhite, fontSize: 13, color: C.textPrimary, lineHeight: 1.6 }}>
                  {String(value)}
                </div>
              </div>
            ))}
          </div>

          {item.training_needs_html && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>Training Needs</div>
              <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                dangerouslySetInnerHTML={{ __html: item.training_needs_html }} />
            </div>
          )}

          {(item.hod_signature || item.applicantSignature) && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: "HOD Signature", src: item.hod_signature },
                { label: "Applicant Signature", src: item.applicantSignature },
              ].filter(s => s.src).map(({ label, src }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                  <div style={{ padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, display: "inline-block" }}>
                    <img src={src} alt={label} style={{ maxWidth: 200, maxHeight: 70, display: "block" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, padding: "10px 14px", background: C.offWhite, borderRadius: 8, fontSize: 12, color: C.textMuted, textAlign: "center" }}>
            🔒 Read-only view — submissions cannot be edited or deleted.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function DashboardSkeleton({ userEmail }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{G}</style>
      <Header userEmail={userEmail} onLogout={() => { }} onSwitch={() => { }} />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
              <Skeleton w="60%" h={10} r={4} /><div style={{ marginTop: 10 }}><Skeleton w="40%" h={28} r={4} /></div>
            </div>
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 20px", marginBottom: 6, display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1 }}><Skeleton w="40%" h={13} r={4} /><div style={{ marginTop: 6 }}><Skeleton w="25%" h={10} r={4} /></div></div>
            <Skeleton w={120} h={22} r={11} /><Skeleton w={80} h={22} r={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wrong tenant ──────────────────────────────────────────────────────────────
function WrongTenantScreen({ userEmail, onLogout, onSwitch }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{G}</style>
      <div style={{ background: C.white, borderRadius: 16, padding: "48px 44px", maxWidth: 440, textAlign: "center", boxShadow: C.shadowMd, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.red, marginBottom: 10, fontWeight: 400 }}>Access Restricted</h2>
        <p style={{ color: C.textSecond, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}><strong>{userEmail}</strong> is not part of the authorised PMW tenant.</p>
        <button onClick={onSwitch} style={{ width: "100%", padding: 12, borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>🔄 Sign in with a different account</button>
        <button onClick={onLogout} style={{ width: "100%", padding: 12, borderRadius: 8, background: "none", color: C.red, border: `1px solid ${C.redPale}`, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🚪 Sign out</button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilters }) {
  return (
    <div style={{ textAlign: "center", padding: "52px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>
        {hasFilters ? "No submissions match your filters" : "No submissions yet"}
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
        {hasFilters ? "Try adjusting your search or filter criteria." : "Fill out a form using the direct links shared with you. Your submissions will appear here."}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HomePage() {
  // NO useMsalAuthentication — we handle login manually
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // "choice" = showing choice screen
  // "guest"  = user chose guest
  // "loading"= fetching submissions
  // "ready"  = dashboard shown
  // "error"  = fetch failed
  // "wrong_tenant" = wrong org
  const [pageState, setPageState] = useState("checking");
  const [submissions, setSubmissions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("date_desc");

  const userEmail = accounts[0]?.username || "";

  // ── Determine initial state ──────────────────────────────────────────────
  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    if (isAuthenticated) {
      // Already logged in — go straight to loading data
      if (pageState === "checking") {
        const account = accounts[0];
        if (!isAllowedTenant(account)) { setPageState("wrong_tenant"); return; }
        setPageState("loading");
      }
      return;
    }

    // Not authenticated — check stored decision
    if (pageState === "checking") {
      const stored = getStoredDecision();
      if (stored === "guest") {
        setPageState("guest");
      } else {
        setPageState("choice");
      }
    }
  }, [isAuthenticated, inProgress, accounts, pageState]);

  // ── Fetch submissions once in "loading" state ────────────────────────────
  useEffect(() => {
    if (pageState !== "loading" || !isAuthenticated) return;

    fetch(process.env.REACT_APP_FLOW_DASHBOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail }),
    })
      .then(r => r.json())
      .then(d => {
        const list = d.body ?? d.submissions ?? d ?? [];
        setSubmissions(Array.isArray(list) ? list : []);
        setPageState("ready");
      })
      .catch(e => {
        console.error(e);
        setErrorMsg("Unable to load submissions. Please try again.");
        setPageState("error");
      });
  }, [pageState, isAuthenticated, userEmail]);

  // ── Auth actions ─────────────────────────────────────────────────────────
  const handleLogin = useCallback(() => {
    instance.loginRedirect({
      ...loginRequest,
      prompt: "select_account",
      redirectUri: window.location.origin,  // homepage always redirects to /
    });
  }, [instance]);

  const handleLogout = useCallback(() => {
    clearStoredDecision();
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  }, [instance]);

  const handleSwitch = useCallback(() => {
    instance
      .logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.href, onRedirectNavigate: () => false })
      .catch(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account", redirectUri: window.location.origin }));
  }, [instance, accounts]);

  const handleGuest = useCallback(() => {
    setPageState("guest");
  }, []);

  const handleForgetChoice = useCallback(() => {
    clearStoredDecision();
    setPageState("choice");
  }, []);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const processed = useMemo(() => {
    let list = [...submissions];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => JSON.stringify(s).toLowerCase().includes(q));
    }
    if (category !== "All") {
      list = list.filter(s => FORM_CATALOG[s.formId]?.category === category);
    }
    list.sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b.submittedAt) - new Date(a.submittedAt);
      if (sortBy === "date_asc") return new Date(a.submittedAt) - new Date(b.submittedAt);
      if (sortBy === "status") return (a.formStatus || "").localeCompare(b.formStatus || "");
      if (sortBy === "form") return (a.formId || "").localeCompare(b.formId || "");
      return 0;
    });
    return list;
  }, [submissions, search, category, sortBy]);

  const grouped = useMemo(() => {
    const map = {};
    processed.forEach(s => {
      const cat = FORM_CATALOG[s.formId]?.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return map;
  }, [processed]);

  // ── Render states ─────────────────────────────────────────────────────────

  // Still initialising MSAL
  if (pageState === "checking" || inProgress !== InteractionStatus.None) {
    return (
      <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{G}</style>
        <Spinner size={36} />
      </div>
    );
  }

  if (pageState === "choice") {
    return <ChoiceScreen onLogin={handleLogin} onGuest={handleGuest} />;
  }

  if (pageState === "guest") {
    return <GuestLanding onLogin={handleLogin} onForgetChoice={handleForgetChoice} />;
  }

  if (pageState === "wrong_tenant") {
    return <WrongTenantScreen userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;
  }

  if (pageState === "loading") {
    return <DashboardSkeleton userEmail={userEmail} />;
  }

  if (pageState === "error") {
    return (
      <div style={{ minHeight: "100vh", background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{G}</style>
        <div style={{ background: C.white, borderRadius: 16, padding: "48px 44px", maxWidth: 400, textAlign: "center", boxShadow: C.shadowMd, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>❌</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.red, fontWeight: 400, marginBottom: 10 }}>Something went wrong</h2>
          <p style={{ color: C.textSecond, fontSize: 13, marginBottom: 24 }}>{errorMsg}</p>
          <button onClick={() => setPageState("loading")} style={{ padding: "10px 24px", borderRadius: 8, background: C.purple, color: C.white, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard (ready) ────────────────────────────────────────────────────
  const hasFilters = search.trim() || category !== "All";

  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{G}</style>
      <Header userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>My Submissions</h1>
          <p style={{ fontSize: 13, color: C.textSecond }}>All forms submitted with your account. Read-only — contact HR to make changes.</p>
        </div>
        <StatsRow submissions={submissions} />
        <Toolbar search={search} setSearch={setSearch} category={category} setCategory={setCategory} sortBy={sortBy} setSortBy={setSortBy} total={submissions.length} filtered={processed.length} />
        {processed.length === 0
          ? <EmptyState hasFilters={hasFilters} />
          : Object.entries(grouped).map(([cat, items]) => (
            <CategoryGroup key={cat} category={cat} items={items} onView={setSelectedItem} />
          ))
        }
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textMuted, paddingBottom: 40 }}>
          PMW International Berhad · HR Forms · Confidential
        </div>
      </main>
      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}