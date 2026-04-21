/**
 * ApprovalShared.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * All shared primitives, helpers, and UI components used across approval pages.
 * Import what you need — nothing here has side-effects.
 */

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import SignaturePad from "signature_pad";

// ── Design tokens ─────────────────────────────────────────────────────────────
export const C = {
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
  shadowMd: "0 4px 24px rgba(91,33,182,0.12), 0 1px 4px rgba(91,33,182,0.06)",
  shadowLg: "0 8px 40px rgba(91,33,182,0.16)",
};

export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: ${C.offWhite}; color: ${C.textPrimary}; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
`;

// ── Pure helpers ──────────────────────────────────────────────────────────────
export const ALLOWED_TENANT_ID = process.env.REACT_APP_AZURE_TENANT_ID;

export const isAllowedTenant = (account) =>
  (account?.tenantId ?? account?.idTokenClaims?.tid) === ALLOWED_TENANT_ID;

export const fmtCurrency = (v) => `RM ${parseFloat(v || 0).toFixed(2)}`;

export const fmtDate = (v) =>
  v ? new Date(v).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—";

export const fmtDateMed = (v) =>
  v ? new Date(v).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const isYes = (v) => v === true || v === "true" || v === "Yes" || v === 1;

export const layerIsRejected = (l) => l?.outcome === "Rejected" || l?.status === "Rejected";
export const layerIsApproved = (l) => l?.status === "Signed" && !layerIsRejected(l);

export const buildLayers = (payload, total) =>
  Array.from({ length: total }, (_, i) => payload[`l${i + 1}`] || null);

export const deriveFormStatus = (layers, paStatus) => {
  if (layers.some(layerIsRejected)) return "rejected";
  if (layers.length > 0 && layers.every(layerIsApproved)) return "fullyApproved";
  return paStatus || null;
};

// ── Layer role metadata — extensible per form type ───────────────────────────
const LAYER_META_MAP = {
  Managerial: ["Group Human Resource Head", "Chief Human Resource Officer"],
  "Non-Managerial": ["Head of Department", "Group Human Resource Head"],
  // Training Needs Analysis uses a single HOD layer — caller passes custom titles
};

export const getLayerMeta = (subject, layer, customTitles, customSectionLabels) => {
  const titles = customTitles ?? LAYER_META_MAP[subject];
  return {
    roleTitle: titles ? (titles[layer - 1] ?? `Layer ${layer} Approver`) : `Layer ${layer} Approver`,
    sectionLabel: customSectionLabels
      ? (customSectionLabels[layer - 1] ?? "Approved By")
      : (layer === 1 ? "Recommended By" : "Approved By"),
  };
};

// ── Primitive UI ──────────────────────────────────────────────────────────────
export function Spinner({ size = 16, color = C.purple, borderColor = C.purpleMid }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: `2px solid ${borderColor}`, borderTop: `2px solid ${color}`,
      borderRadius: "50%", animation: "spin 0.9s linear infinite",
    }} />
  );
}

export function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#EDE9FE 25%,#DDD6FE 50%,#EDE9FE 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.6s infinite", ...style,
    }} />
  );
}

export function Btn({ children, onClick, variant = "primary", disabled = false, style = {} }) {
  const variants = {
    primary: { background: disabled ? C.border : C.purple, color: disabled ? C.textMuted : C.white },
    secondary: { background: C.white, color: C.textPrimary, border: `1px solid ${C.border}` },
    danger: { background: disabled ? C.border : C.red, color: disabled ? C.textMuted : C.white },
    ghost: { background: "none", color: C.red, border: `1px solid ${C.redPale}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer", border: "none",
        display: "inline-flex", alignItems: "center", gap: 8,
        transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
        ...variants[variant], ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Labelled read-only field — used inside ReadOnlyForm grids */
export function Field({ label, value, full = false, highlight = false }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
      <div style={{
        padding: "9px 12px", borderRadius: 7, border: `1px solid ${highlight ? C.purpleMid : C.border}`,
        background: highlight ? C.purplePale : C.offWhite, fontSize: highlight ? 16 : 13,
        color: highlight ? C.purple : C.textPrimary, fontWeight: highlight ? 700 : 400,
        minHeight: 38, lineHeight: 1.6,
      }}>
        {value || <span style={{ color: C.textMuted }}>—</span>}
      </div>
    </div>
  );
}

export function SectionDivider({ number, title }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, padding: "14px 0 8px", marginTop: number > 1 ? 8 : 0 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
        color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
      }}>{number}</div>
      <span style={{ fontWeight: 600, fontSize: 13, color: C.textPrimary, letterSpacing: "-0.01em" }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

export function MetaRow({ label, value, color, bold = false, fullWidth = false }) {
  return (
    <div style={{ ...(fullWidth ? { flexBasis: "100%" } : {}) }}>
      <div style={{ fontSize: 10, color: color ?? C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: bold ? 600 : 400, lineHeight: 1.5 }}>{value || "—"}</div>
    </div>
  );
}

// ── Page chrome ───────────────────────────────────────────────────────────────
export function PageHeader() {
  return (
    <div style={{
      background: C.white, borderBottom: `1px solid ${C.border}`,
      padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 56, position: "sticky", top: 0, zIndex: 50,
      boxShadow: "0 1px 0 rgba(91,33,182,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M2 7h7M2 10h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: C.textPrimary, letterSpacing: "-0.01em" }}>
          Approval
        </span>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 500, color: C.purple,
        background: C.purplePale, borderRadius: 20, padding: "3px 10px",
        border: `1px solid ${C.purpleMid}`, letterSpacing: "0.04em", textTransform: "uppercase",
      }}>
        HR Forms
      </span>
    </div>
  );
}

export function PageShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>
        {children}
      </div>
    </div>
  );
}

export function PageFooter() {
  return (
    <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textMuted, paddingBottom: 32 }}>
      PMW International Berhad · HR-Forms · Confidential
    </div>
  );
}

// ── Full-page centred screen ──────────────────────────────────────────────────
export function Screen({ icon, title, message, color = C.textSecond, children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", minHeight: "calc(100vh - 56px)" }}>
        <div style={{
          background: C.white, borderRadius: 16, padding: "48px 44px", textAlign: "center",
          maxWidth: 440, width: "100%", boxShadow: C.shadowMd, border: `1px solid ${C.border}`,
          animation: "fadeUp 0.3s ease",
        }}>
          {icon && <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>}
          {title && <h2 style={{ fontFamily: "'DM Serif Display', serif", color, marginBottom: 10, fontSize: 22, fontWeight: 400 }}>{title}</h2>}
          <p style={{ color: C.textSecond, lineHeight: 1.7, fontSize: 14, marginBottom: children ? 24 : 0 }}>{message}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Loading screens ───────────────────────────────────────────────────────────
export function LoginWaitScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <Spinner size={48} color={C.purple} borderColor={C.purpleMid} />
      <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontSize: 22, marginBottom: 8, marginTop: 24 }}>Signing you in…</h2>
      <p style={{ color: C.textMuted, fontSize: 14 }}>Redirecting to Microsoft 365. Please wait.</p>
    </div>
  );
}

export function PageSkeleton({ userEmail }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "14px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12,
          boxShadow: C.shadow,
        }}>
          <Spinner size={16} />
          <span style={{ fontSize: 13, color: C.purple }}>Loading application for <strong>{userEmail}</strong>…</span>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div><Skeleton width={80} height={10} style={{ marginBottom: 6 }} /><Skeleton height={36} /></div>
            <div><Skeleton width={80} height={10} style={{ marginBottom: 6 }} /><Skeleton height={36} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Outcome screens ───────────────────────────────────────────────────────────
function DetailCard({ items }) {
  return (
    <div style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px", textAlign: "left", marginTop: 20 }}>
      {items.map(({ label, value }, i) => (
        <div key={i} style={{ marginBottom: i < items.length - 1 ? 14 : 0 }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 500 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function SuccessPage({ userEmail, layer, signedAt, action }) {
  const approved = action !== "rejected";
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", minHeight: "calc(100vh - 56px)" }}>
        <div style={{
          background: C.white, borderRadius: 16, padding: "48px 44px", textAlign: "center",
          maxWidth: 460, width: "100%", boxShadow: C.shadowMd, border: `1px solid ${C.border}`,
          animation: "fadeUp 0.3s ease",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
            background: approved ? C.greenPale : C.redPale,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>{approved ? "✓" : "✕"}</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontWeight: 400, fontSize: 22, marginBottom: 8 }}>
            {approved ? "Approval Submitted" : "Application Rejected"}
          </h2>
          <p style={{ color: C.textSecond, marginBottom: 4, lineHeight: 1.7, fontSize: 14 }}>
            Your Layer {layer} {approved ? "approval" : "rejection"} has been recorded.
          </p>
          <DetailCard items={[
            { label: approved ? "Approved by" : "Rejected by", value: userEmail },
            { label: "Approval layer", value: `Layer ${layer}` },
            { label: "Date / Time", value: fmtDate(signedAt) },
          ]} />
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 20 }}>You may close this window.</p>
        </div>
      </div>
    </div>
  );
}

export function AlreadySignedPage({ userEmail, signedEmail, layer, signedAt, action, rejectionReason }) {
  const approved = action !== "Rejected";
  const isSelf = signedEmail && userEmail && signedEmail.toLowerCase() === userEmail.toLowerCase();
  const detailItems = [
    { label: approved ? "Approved by" : "Rejected by", value: signedEmail },
    { label: "Layer", value: `Layer ${layer}` },
    { label: "Signed at", value: fmtDate(signedAt) },
    ...(!approved && rejectionReason ? [{ label: "Rejection Reason", value: rejectionReason }] : []),
  ];
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", minHeight: "calc(100vh - 56px)" }}>
        <div style={{
          background: C.white, borderRadius: 16, padding: "48px 44px", textAlign: "center",
          maxWidth: 460, width: "100%", boxShadow: C.shadowMd, border: `1px solid ${C.border}`,
          animation: "fadeUp 0.3s ease",
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>{isSelf ? "🔐" : "⏸️"}</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontWeight: 400, fontSize: 22, marginBottom: 8 }}>
            {isSelf ? `Already ${approved ? "Approved" : "Rejected"}` : `Layer ${layer} Already ${approved ? "Approved" : "Rejected"}`}
          </h2>
          <p style={{ color: C.textSecond, marginBottom: 4, lineHeight: 1.7, fontSize: 14 }}>
            {isSelf
              ? `You have already submitted your Layer ${layer} ${approved ? "approval" : "rejection"}. This link is now locked.`
              : `This layer has already been ${approved ? "approved" : "rejected"} by another approver.`}
          </p>
          <DetailCard items={detailItems} />
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 20 }}>You may close this window.</p>
        </div>
      </div>
    </div>
  );
}

// AFTER:
export function WrongTenantScreen({ userEmail, onLogout, onSwitch }) {
  return (
    <Screen icon="🚫" title="Access Restricted" color={C.red}
      message={<>This portal is only accessible to users within the organisation. The account <strong>{userEmail}</strong> is not part of the authorised tenant.</>}>
      <Btn onClick={onLogout} variant="ghost">🚪 Sign out</Btn>
    </Screen>
  );
}

export function WaitingForLayersScreen({ userLayer, totalLayers, layers, userEmail, onLogout, onSwitch }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", minHeight: "calc(100vh - 56px)" }}>
        <div style={{
          background: C.white, borderRadius: 16, padding: "44px 40px", textAlign: "center",
          maxWidth: 520, width: "100%", boxShadow: C.shadowMd, border: `1px solid ${C.border}`,
          animation: "fadeUp 0.3s ease",
        }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.purplePale, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⏳</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontWeight: 400, fontSize: 22, marginBottom: 8 }}>Awaiting Prior Approvals</h2>
          <p style={{ color: C.textSecond, lineHeight: 1.7, fontSize: 14, marginBottom: 28 }}>
            You are the <strong>Layer {userLayer}</strong> approver. Prior layers must approve first.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, textAlign: "left" }}>
            {layers.map((l, i) => {
              const n = i + 1;
              const signed = layerIsApproved(l);
              const isMe = n === userLayer;
              const pending = !signed && n < userLayer;
              return (
                <div key={n} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8,
                  background: signed ? C.greenPale : isMe ? C.purplePale : C.offWhite,
                  border: `1px solid ${signed ? "#6EE7B7" : isMe ? C.purpleMid : C.border}`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: signed ? C.green : pending ? C.amber : isMe ? C.purple : C.border,
                    color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600,
                  }}>{signed ? "✓" : n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>Layer {n}{isMe ? " (You)" : ""}</div>
                    <div style={{ fontSize: 11, color: signed ? C.green : pending ? C.amber : C.textMuted, marginTop: 2 }}>
                      {signed ? `Approved · ${fmtDateMed(l?.signedAt)}` : pending ? "Pending approval" : isMe ? "Waiting for layers above" : "Pending"}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.04em",
                    background: signed ? C.green : pending ? C.amberPale : isMe ? C.purplePale : C.border,
                    color: signed ? C.white : pending ? C.amber : isMe ? C.purple : C.textMuted,
                  }}>{signed ? "Done" : pending ? "Required" : isMe ? "Yours" : "Pending"}</span>
                </div>
              );
            })}
          </div>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 20 }}>This page is read-only. You'll be notified when it's your turn.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Btn onClick={onLogout} variant="ghost">🚪 Sign out</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}



// ── User badge (dropdown) ─────────────────────────────────────────────────────
export function UserBadge({ userEmail, layer, total, alreadyDone, onLogout, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const initials = userEmail
    ? userEmail.split("@")[0].split(".").map((p) => p[0]?.toUpperCase()).join("").slice(0, 2)
    : "?";

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <div
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.borderDark)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "10px 14px", cursor: "pointer",
          userSelect: "none", justifyContent: "space-between",
          boxShadow: C.shadow, transition: "border-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
            color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 600,
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{userEmail}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
              {alreadyDone ? `Already actioned · Layer ${layer}` : `Layer ${layer} of ${total} approver`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, background: C.purplePale, color: C.purple,
            padding: "3px 10px", borderRadius: 20, fontWeight: 600,
            border: `1px solid ${C.purpleMid}`, whiteSpace: "nowrap",
          }}>L{layer} / {total}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
            <path d="M2 4l4 4 4-4" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
          boxShadow: C.shadowLg, minWidth: 240, zIndex: 200, overflow: "hidden",
          animation: "fadeUp 0.15s ease",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.offWhite }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Signed in as</div>
            <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500, wordBreak: "break-all" }}>{userEmail}</div>
          </div>
          {[
            { icon: "🚪", label: "Sign out", action: onLogout, color: C.red, bordered: false },
          ].map(({ icon, label, action, color, bordered }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); action(); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.offWhite)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              style={{
                width: "100%", padding: "10px 16px", background: "none", border: "none",
                borderBottom: bordered ? `1px solid ${C.border}` : "none",
                textAlign: "left", cursor: "pointer", fontSize: 13, color,
                display: "flex", alignItems: "center", gap: 10, transition: "background 0.1s",
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status overlay modal (terminal states) ────────────────────────────────────
export function StatusOverlayModal({ formStatus, layers, totalLayers, onViewDetails }) {
  const isRejected = formStatus === "rejected";
  const rejectedIndex = layers.findIndex(layerIsRejected);
  const rejectedLayer = rejectedIndex >= 0 ? layers[rejectedIndex] : null;

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(30,27,75,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, animation: "fadeUp 0.2s ease",
    }}>
      <div style={{
        background: C.white, borderRadius: 16, padding: "40px 36px",
        maxWidth: 480, width: "100%", boxShadow: C.shadowLg,
        border: `1px solid ${C.border}`, textAlign: "center",
      }}>
        <div style={{
          width: 68, height: 68, borderRadius: "50%", margin: "0 auto 20px",
          background: isRejected ? C.redPale : C.greenPale,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
        }}>{isRejected ? "✕" : "✓"}</div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, fontSize: 22, color: C.textPrimary, marginBottom: 8 }}>
          {isRejected ? "Application Rejected" : "All Approvals Complete"}
        </h2>
        <p style={{ color: C.textSecond, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          {isRejected
            ? `This application was rejected at Layer ${rejectedIndex + 1}. No further approvals are required.`
            : `All ${totalLayers} approval layer${totalLayers > 1 ? "s" : ""} have been completed successfully.`}
        </p>
        {isRejected && rejectedLayer && (
          <div style={{
            background: C.redPale, border: "1px solid #FCA5A5",
            borderRadius: 10, padding: "16px 18px", textAlign: "left", marginBottom: 24,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {[
              { label: "Rejected by", value: rejectedLayer.email },
              { label: "Layer", value: `Layer ${rejectedIndex + 1}` },
              { label: "Date / Time", value: fmtDate(rejectedLayer.signedAt) },
              { label: "Reason", value: rejectedLayer.rejectionReason || "No reason provided" },
            ].map(({ label, value }) => (
              <MetaRow key={label} label={label} value={value} color={C.red} bold={label === "Reason"} />
            ))}
          </div>
        )}
        {!isRejected && (
          <div style={{
            background: C.greenPale, border: "1px solid #6EE7B7",
            borderRadius: 10, padding: "14px 18px", textAlign: "left", marginBottom: 24,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {layers.map((l, i) => l && (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: C.green, color: C.white,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>✓</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>Layer {i + 1} — {l.email || "—"}</div>
                  <div style={{ fontSize: 11, color: C.green, marginTop: 1 }}>{fmtDateMed(l.signedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Btn onClick={onViewDetails} variant="primary" style={{ width: "100%", justifyContent: "center", padding: "12px 22px" }}>
          📋 View Full Application Details
        </Btn>
        <p style={{ color: C.textMuted, fontSize: 11, marginTop: 14 }}>Read-only view — no actions can be taken.</p>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ type, onConfirm, onCancel, loading, userEmail }) {
  const [reason, setReason] = useState("");
  const isReject = type === "reject";

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, background: "rgba(30,27,75,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20, backdropFilter: "blur(2px)",
    }}>
      <div style={{
        background: C.white, borderRadius: 16, padding: "32px 28px",
        maxWidth: 480, width: "100%", boxShadow: C.shadowLg,
        border: `1px solid ${C.border}`, animation: "fadeUp 0.2s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: isReject ? C.redPale : C.purplePale,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 600, color: isReject ? C.red : C.purple,
          }}>{isReject ? "✕" : "✓"}</div>
          <div>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, fontWeight: 400, color: C.textPrimary }}>
              {isReject ? "Reject Application" : "Approve Application"}
            </h3>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {isReject ? "This action cannot be undone." : "Please confirm your approval."}
            </p>
          </div>
        </div>

        <div style={{
          background: C.offWhite, borderRadius: 8, padding: "12px 16px", marginBottom: 20,
          fontSize: 13, color: C.textSecond, lineHeight: 1.7, border: `1px solid ${C.border}`,
        }}>
          {isReject
            ? "Rejecting this application will notify the applicant and stop the approval process. Please provide a reason below."
            : "By approving, you confirm that you have reviewed this application and agree to proceed."}
        </div>

        {/* ── Signed-in email reminder ── */}
        {userEmail && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: C.purplePale, border: `1px solid ${C.purpleMid}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 20,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
              color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600,
            }}>
              {userEmail.split("@")[0].split(".").map(p => p[0]?.toUpperCase()).join("").slice(0, 2)}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary }}>{userEmail}</div>
              <div style={{ fontSize: 11, color: C.purple, marginTop: 1 }}>
                This account will be recorded for this {isReject ? "rejection" : "approval"}
              </div>
            </div>
          </div>
        )}

        {isReject && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: C.textSecond, display: "block", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Rejection Reason <span style={{ color: C.red }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for rejection…"
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${reason.trim() ? C.border : C.red}`,
                fontSize: 13, color: C.textPrimary, resize: "vertical",
                fontFamily: "'DM Sans', sans-serif", outline: "none", background: C.white,
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn onClick={onCancel} variant="secondary" disabled={loading}>Cancel</Btn>
          <Btn
            onClick={() => onConfirm(reason)}
            variant={isReject ? "danger" : "primary"}
            disabled={loading || (isReject && !reason.trim())}
          >
            {loading && <Spinner size={13} color="rgba(255,255,255,1)" borderColor="rgba(255,255,255,0.4)" />}
            {loading ? "Submitting…" : isReject ? "Confirm Rejection" : "Confirm Approval"}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Signature dialog & trigger ─────────────────────────────────────────────────
export function SignatureDialog({ open, onConfirm, onCancel, existingData }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d").scale(ratio, ratio);
      padRef.current = new SignaturePad(canvas, { penColor: C.purpleDark });
      if (existingData) { padRef.current.fromDataURL(existingData); setIsEmpty(false); }
      else setIsEmpty(true);
      padRef.current.addEventListener("endStroke", () => setIsEmpty(padRef.current.isEmpty()));
    }, 50);
    return () => { clearTimeout(timer); padRef.current?.off(); };
  }, [open, existingData]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(30,27,75,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, backdropFilter: "blur(2px)",
      }}
    >
      <div style={{ background: C.white, borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, boxShadow: C.shadowLg, animation: "fadeUp 0.2s ease" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontFamily: "'DM Serif Display', serif", color: C.textPrimary, marginBottom: 4 }}>Approver Signature</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Draw your signature in the box below, then tap Confirm</div>
        </div>
        <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.offWhite, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: 32, left: 12, right: 12, borderBottom: `1px dashed ${C.purpleMid}`, pointerEvents: "none" }} />
          <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: 180, touchAction: "none", cursor: "crosshair" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
          <Btn onClick={() => { padRef.current?.clear(); setIsEmpty(true); }} variant="secondary">Clear</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={onCancel} variant="secondary">Cancel</Btn>
            <Btn onClick={() => { if (!padRef.current?.isEmpty()) onConfirm(padRef.current.toDataURL()); }} variant="primary" disabled={isEmpty}>Confirm</Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SignatureTrigger({ value, onChange, submitting }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (submitting) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: C.purple, fontSize: 13 }}>
        <Spinner size={16} /> Submitting…
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
        {value ? "Signature captured — tap to edit" : "Tap the box below to draw your signature:"}
      </div>
      <div
        onClick={() => setDialogOpen(true)}
        style={{
          border: value ? `2px solid ${C.purple}` : `2px dashed ${C.border}`,
          borderRadius: 10, background: value ? C.purplePale : C.offWhite,
          minHeight: 100, maxWidth: 460, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", cursor: "pointer",
          position: "relative", overflow: "hidden", userSelect: "none",
          transition: "border-color 0.15s",
        }}
      >
        {value ? (
          <>
            <img src={value} alt="Signature" style={{ maxWidth: "90%", maxHeight: 80, display: "block", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 8, right: 8, background: C.purple, color: C.white, borderRadius: 5, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>Tap to edit</div>
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              style={{ position: "absolute", top: 8, left: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: C.red }}
            >Remove</button>
          </>
        ) : (
          <div style={{ textAlign: "center", color: C.textMuted, pointerEvents: "none" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>✍️</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textSecond }}>Tap to sign</div>
            <div style={{ fontSize: 11, marginTop: 3, color: C.textMuted }}>Opens a signing dialog</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: value ? C.green : C.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
        {value ? <><span>✓</span> Signature ready — click Approve to submit</> : "Please draw your signature above before approving."}
      </div>
      <SignatureDialog
        open={dialogOpen}
        onConfirm={(dataUrl) => { onChange(dataUrl); setDialogOpen(false); }}
        onCancel={() => setDialogOpen(false)}
        existingData={value}
      />
    </>
  );
}

// ── Approval box ──────────────────────────────────────────────────────────────
export function ApprovalBox({
  layer, totalLayers, layerData, isMine,
  onApprove, onReject, submitting,
  subject, skipped = false,
  customLayerTitles,
  customSectionLabels,   // ← add this
}) {

  const [sig, setSig] = useState(null);

  const rejected = layerIsRejected(layerData);
  const actioned = layerIsApproved(layerData) || rejected;
  const { email, signedAt, rejectionReason } = layerData || {};
  const { roleTitle, sectionLabel } = getLayerMeta(subject, layer, customLayerTitles, customSectionLabels);

  const theme = (() => {
    if (actioned) return rejected
      ? { border: "#FCA5A5", bg: C.redPale, accent: C.red, badgeBg: "#FCA5A5", badgeColor: "#7F1D1D" }
      : { border: "#6EE7B7", bg: C.greenPale, accent: C.green, badgeBg: "#6EE7B7", badgeColor: "#064E3B" };
    if (skipped) return { border: C.border, bg: "#F9FAFB", accent: C.textMuted, badgeBg: "#F3F4F6", badgeColor: C.textMuted };
    if (isMine) return { border: C.borderDark, bg: C.purplePale, accent: C.purple, badgeBg: C.purpleMid, badgeColor: C.purpleDark };
    return { border: C.border, bg: C.offWhite, accent: C.textMuted, badgeBg: C.border, badgeColor: C.textMuted };
  })();

  const badgeText = actioned
    ? (rejected ? "Rejected" : "Approved")
    : skipped ? "Not Required"
      : isMine ? "Action Required"
        : "Pending";

  return (
    <div style={{
      border: `1px solid ${theme.border}`, borderRadius: 12, padding: "22px 24px", marginBottom: 12,
      background: theme.bg,
      opacity: (!actioned && !isMine) ? (skipped ? 0.45 : 0.55) : 1,
      boxShadow: isMine ? `0 0 0 3px ${C.purplePale}, ${C.shadow}` : C.shadow,
      transition: "box-shadow 0.2s",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        {sectionLabel}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: actioned ? (rejected ? C.red : C.green) : isMine ? C.purple : C.border,
            color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
          }}>{actioned ? (rejected ? "✕" : "✓") : layer}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.textPrimary, letterSpacing: "-0.01em" }}>{roleTitle}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Layer {layer} of {totalLayers}</div>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
          background: theme.badgeBg, color: theme.badgeColor,
          textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
        }}>{badgeText}</span>
      </div>

      {actioned && (
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <MetaRow label="Approver Email" value={email} />
          <MetaRow label="Date / Time" value={fmtDate(signedAt)} />
          <MetaRow label="Decision" value={rejected ? "Rejected" : "Approved"} bold />
          {rejected && <MetaRow label="Rejection Reason" value={rejectionReason || "No reason provided"} bold fullWidth />}
        </div>
      )}

      {actioned && !rejected && layerData?.signature && (
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Signature</div>
          <div style={{ padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, display: "inline-block" }}>
            <img src={layerData.signature} alt={`Layer ${layer} signature`} style={{ maxWidth: 260, maxHeight: 80, display: "block" }} />
          </div>
        </div>
      )}

      {skipped && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 12 }}>
          <span>⛔</span> Not required — application was rejected at a previous layer
        </div>
      )}

      {!actioned && !isMine && !skipped && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 12 }}>
          <span>🔒</span> Locked — waiting for Layer {layer - 1} approval
        </div>
      )}

      {isMine && !actioned && (
        <div>
          <SignatureTrigger value={sig} onChange={setSig} submitting={submitting} />
          <div style={{ display: "flex", gap: 10, marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <Btn onClick={() => onApprove(sig)} variant="primary" disabled={submitting || !sig} style={{ flex: 1, minWidth: 140, justifyContent: "center" }}>
              ✓ Approve Application
            </Btn>
            <Btn onClick={onReject} variant="ghost" disabled={submitting}>✕ Reject</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approval chain ────────────────────────────────────────────────────────────
/**
 * @param {string[]} [customLayerTitles] - optional role title overrides per form type
 * @param {number}   chainSectionNumber  - section number shown in the chain header badge
 */
export function ApprovalChain({
  layers, totalLayers, myLayer, curLayer, alreadyDone,
  subject, submitting, onApprove, onReject,
  readOnly = false,
  customLayerTitles,
  customSectionLabels,   // ← add this
  chainSectionNumber = 5,
}) {
  const rejectedAtIndex = layers.findIndex(layerIsRejected);
  const hasRejection = rejectedAtIndex >= 0;
  const approvedCount = layers.filter(layerIsApproved).length;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{chainSectionNumber}</div>
            <span style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>Approval Chain</span>
          </div>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {hasRejection
              ? <span style={{ color: C.red, fontWeight: 600 }}>Rejected at Layer {rejectedAtIndex + 1}</span>
              : <><span style={{ color: C.purple, fontWeight: 600 }}>{approvedCount}</span> of {totalLayers} approved</>}
          </span>
        </div>
        <div style={{ padding: "16px 22px" }}>
          {layers.map((layerData, i) => {
            const layerNum = i + 1;
            const isMine = !readOnly && myLayer === layerNum && curLayer === layerNum && !alreadyDone;
            const skipped = hasRejection && i > rejectedAtIndex && !layerData?.email;
            return (
              <ApprovalBox
                key={layerNum}
                layer={layerNum}
                totalLayers={totalLayers}
                layerData={layerData || {}}
                isMine={isMine}
                onApprove={isMine ? onApprove : null}
                onReject={isMine ? onReject : null}
                subject={subject}
                submitting={isMine && submitting}
                skipped={skipped}
                customLayerTitles={customLayerTitles}
                customSectionLabels={customSectionLabels}
              />
            );
          })}
          {!readOnly && alreadyDone && !hasRejection && (
            <div style={{ background: C.greenPale, border: "1px solid #6EE7B7", borderRadius: 8, padding: "12px 16px", color: C.green, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>✓</span> You have already actioned this application. Waiting for remaining approvers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Terminal banner (shown above read-only form) ──────────────────────────────
export function TerminalBanner({ formStatus, showOverlay, onShowOverlay }) {
  const isRejected = formStatus === "rejected";
  return (
    <div style={{
      background: isRejected ? C.redPale : C.greenPale,
      border: `1px solid ${isRejected ? "#FCA5A5" : "#6EE7B7"}`,
      borderRadius: 10, padding: "12px 18px", marginBottom: 20,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: isRejected ? C.red : C.green, fontWeight: 500 }}>
        <span>{isRejected ? "✕" : "✓"}</span>
        {isRejected
          ? "This application has been rejected — viewing in read-only mode."
          : "All approvals are complete — viewing in read-only mode."}
      </div>
      {!showOverlay && (
        <button
          onClick={onShowOverlay}
          style={{
            background: "none", border: `1px solid ${isRejected ? "#FCA5A5" : "#6EE7B7"}`,
            borderRadius: 6, padding: "4px 12px", fontSize: 12,
            color: isRejected ? C.red : C.green,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          }}
        >View summary</button>
      )}
    </div>
  );
}

// ── useApprovalPage — shared data-fetch + submit hook ─────────────────────────
/**
 * Drop this hook into any approval page.
 *
 * @param {{ fetchUrl: string, signUrl: string }} urls
 * @returns all state + handlers needed to drive an approval page
 */
export function useApprovalPage({ fetchUrl, signUrl }) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [signResult, setSignResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dialog, setDialog] = useState(null);
  const [pendingSig, setPendingSig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const retryFnRef = useRef(null);

  const token = new URLSearchParams(window.location.search).get("token");

  const load = React.useCallback(async ({ userEmail, isAllowed }) => {
    if (!isAllowed) { setStatus("wrong_tenant"); return; }
    setStatus("loading");
    try {
      const r = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userEmail }),
      });
      const d = await r.json();
      const payload = d.body ?? d;

      if (payload.alreadySigned) { setData(payload); setStatus("already_signed"); return; }
      if (!payload.authorized) { setStatus("unauthorized"); setErrorMsg(payload.message || "You are not authorised."); return; }

      const subject = payload.submissionData?.subject;
      if (!subject || subject === "Unassigned") { setStatus("unassigned"); return; }

      const total = parseInt(payload.totalLayers) || 0;
      const layers = buildLayers(payload, total);
      const formStatus = deriveFormStatus(layers, payload.formStatus);
      const isTerminal = formStatus === "rejected" || formStatus === "fullyApproved";

      setData({ ...payload, formStatus });
      if (isTerminal) { setShowOverlay(true); setStatus("terminal"); }
      else setStatus("ready");
    } catch (e) {
      console.error("Fetch error:", e);
      setStatus("error");
      setErrorMsg("Unable to load the application. Please try again or contact HR.");
    }
  }, [fetchUrl, token]);

  const submitAction = React.useCallback(async ({ action, signature = "", rejectionReason = "", userEmail, userLayer, formId, submissionID }) => {
    const signedAt = new Date().toISOString();
    const doSubmit = async () => {
      setSubmitting(true); setStatus("ready"); setDialog(null);
      try {
        const res = await fetch(signUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: String(token),
            userEmail: String(userEmail),
            userLayer: String(userLayer),
            signature: String(signature),
            signedAt: String(signedAt),
            action: String(action),
            formID: String(formId || ""),
            submissionID: String(submissionID || ""),
            rejectionReason: String(rejectionReason),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSignResult({ signedAt, action });
        setStatus("done");
        retryFnRef.current = null;
      } catch (e) {
        console.error(e);
        setErrorMsg(`Failed to submit ${action}. Please try again.`);
        setStatus("submit_error");
      } finally {
        setSubmitting(false);
      }
    };
    retryFnRef.current = doSubmit;
    await doSubmit();
  }, [signUrl, token]);

  const handleApproveClick = React.useCallback((sig) => { setPendingSig(sig); setDialog("approve"); }, []);
  const handleRejectClick = React.useCallback(() => { setPendingSig(null); setDialog("reject"); }, []);

  return {
    status, setStatus, data, signResult, errorMsg,
    dialog, setDialog, pendingSig, submitting,
    showOverlay, setShowOverlay,
    token, retryFnRef,
    load, submitAction,
    handleApproveClick, handleRejectClick,
  };
}

// ── PrintPreviewButton (generic — driven by schema) ───────────────────────────
export function PrintPreviewButton({ formTitle, formId, formVersion, submittedAt, formStatus, sections, layers, totalLayers, subject, customLayerTitles }) {
  const printedAt = new Date().toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
  const isRejected = formStatus === "rejected";
  const statusLabel = isRejected ? "Rejected" : "Fully Approved";
  const statusColor = isRejected ? "#721c24" : "#155724";

  const renderField = (f) => {
    if (!f) return "";
    if (f.type === "signature") {
      if (!f.value) return "";
      return `<tr>
        <td class="lb">${f.label}</td>
        <td colspan="3">
          <img src="${f.value}" alt="${f.label}" style="max-height:60px;border:1px solid #ddd;padding:4px;background:#fafafa;display:block">
          <div style="font-size:10px;color:#666;margin-top:4px">Digitally signed on ${fmtDate(submittedAt)}</div>
        </td>
      </tr>`;
    }
    if (f.type === "html") {
      if (!f.value) return "";
      return `<tr>
        <td class="lb" style="vertical-align:top">${f.label}</td>
        <td colspan="3" style="padding:0">
          <div style="overflow-x:auto;font-size:11px;padding:8px 10px">${f.value}</div>
        </td>
      </tr>`;
    }
    if (f.full) {
      return `<tr>
        <td class="lb">${f.label}</td>
        <td colspan="3" ${f.highlight ? 'style="font-weight:bold;background:#f0f0f0;font-size:13px"' : ""}>${f.value || "—"}</td>
      </tr>`;
    }
    return null; // paired — handled in renderSection
  };

  const renderSection = (section, sectionIndex) => {
    if (!section) return "";
    const allFull = section.fields.filter(f => f.full || f.type === "signature" || f.type === "html");
    const paired  = section.fields.filter(f => !f.full && f.type !== "signature" && f.type !== "html");
    const pairs   = [];
    for (let i = 0; i < paired.length; i += 2) pairs.push([paired[i], paired[i + 1]]);

    return `
      <div class="sh">Section ${sectionIndex + 1} — ${section.title}</div>
      <table class="ft">
        ${pairs.map(([a, b]) => `<tr>
          <td class="lb">${a.label}</td>
          <td ${a.highlight ? 'style="font-weight:bold"' : ""}>${a.value || "—"}</td>
          ${b
            ? `<td class="lb">${b.label}</td><td ${b.highlight ? 'style="font-weight:bold"' : ""}>${b.value || "—"}</td>`
            : `<td></td><td></td>`}
        </tr>`).join("")}
        ${allFull.map(f => renderField(f)).join("")}
      </table>`;
  };

  const approvalSectionNumber = sections.length + 1;

  const docHTML = `
    <div class="doc-title">PMW International Berhad</div>
    <div class="doc-subtitle">${formTitle} &nbsp;|&nbsp; Confidential &nbsp;|&nbsp; HR Department</div>
    <div class="doc-meta">
      <span>Form ID: <strong>#${formId || "—"}</strong></span>
      <span>Version: <strong>${formVersion || "—"}</strong></span>
      <span>Submitted: <strong>${fmtDate(submittedAt)}</strong></span>
      <span>Status: <strong style="color:${statusColor}">${statusLabel}</strong></span>
    </div>

    ${sections.map((s, i) => renderSection(s, i)).join("")}

    <div class="sh">Section ${approvalSectionNumber} — Approval Chain</div>
    <table class="at">
      <thead><tr>
        <th style="width:5%">Layer</th>
        <th style="width:22%">Role</th>
        <th style="width:23%">Approver</th>
        <th style="width:18%">Date / Time</th>
        <th style="width:10%">Decision</th>
        <th style="width:22%">Signature</th>
      </tr></thead>
      <tbody>
        ${layers.map((l, i) => {
          if (!l) return "";
          const isRej = layerIsRejected(l);
          const badge = isRej
            ? `<span class="ba br">Rejected</span>`
            : l.status === "Signed"
              ? `<span class="ba bg">Approved</span>`
              : `<span class="ba by">Pending</span>`;
          const sig = l.signature
            ? `<img src="${l.signature}" alt="L${i+1} sig" style="max-height:44px;border:1px solid #ddd;padding:2px;background:#fafafa">`
            : "—";
          const { roleTitle } = getLayerMeta(subject, i + 1, customLayerTitles);
          return `
            <tr>
              <td style="text-align:center;font-weight:bold">${i + 1}</td>
              <td>${roleTitle}</td>
              <td>${l.email || "—"}</td>
              <td>${fmtDate(l.signedAt)}</td>
              <td>${badge}</td>
              <td>${sig}</td>
            </tr>
            ${isRej && l.rejectionReason
              ? `<tr><td></td><td colspan="5" style="font-size:10px;color:#721c24;font-style:italic;padding:4px 10px">Reason: ${l.rejectionReason}</td></tr>`
              : ""}`;
        }).join("")}
      </tbody>
    </table>

    <div style="margin-top:20px;padding:10px;background:#f8f8f8;border:1px solid #ccc;font-size:11px;color:#333">
      <strong>This document is computer-generated.</strong> All approval decisions and signatures have been digitally recorded in the HR Forms system. Any alterations render this document invalid.
    </div>
    <div class="footer">
      <span>PMW International Berhad &nbsp;·&nbsp; HR-Forms &nbsp;·&nbsp; Confidential</span>
      <span>Form ID: #${formId || "—"} &nbsp;·&nbsp; Printed: ${printedAt}</span>
    </div>
  `;

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:32px 40px}
    .doc-title{text-align:center;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;border-bottom:2px solid #000;padding-bottom:8px}
    .doc-subtitle{text-align:center;font-size:11px;color:#444;margin-bottom:20px}
    .doc-meta{display:flex;justify-content:space-between;font-size:11px;color:#444;margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:10px;flex-wrap:wrap;gap:6px}
    .sh{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;background:#f0f0f0;border:1px solid #ccc;border-bottom:none;padding:5px 10px;margin-top:16px}
    table.ft{width:100%;border-collapse:collapse;font-size:12px}
    table.ft td{border:1px solid #ccc;padding:6px 10px;vertical-align:top}
    td.lb{width:28%;background:#fafafa;font-weight:bold;color:#333;font-size:11px}
    table.at{width:100%;border-collapse:collapse;font-size:11px}
    table.at th{background:#1a1a1a;color:#fff;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em}
    table.at td{border:1px solid #ccc;padding:7px 10px;vertical-align:middle}
    table.at tr:nth-child(even) td{background:#fafafa}
    .ba{display:inline-block;padding:2px 8px;border-radius:2px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em}
    .bg{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
    .br{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}
    .by{background:#fff3cd;color:#856404;border:1px solid #ffeeba}
    .footer{margin-top:24px;border-top:1px solid #ccc;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#666}
    @media print{body{padding:20px 24px}@page{margin:15mm}}
  `;

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=960,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>${formTitle} — #${formId}</title><style>${css}</style></head><body>${docHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <button
      onClick={handlePrint}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "9px 18px", border: `1px solid ${C.border}`, borderRadius: 8,
        background: C.white, color: C.textPrimary, fontSize: 13,
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        boxShadow: C.shadow,
      }}
    >
      🖨 Print / Save as PDF
    </button>
  );
}