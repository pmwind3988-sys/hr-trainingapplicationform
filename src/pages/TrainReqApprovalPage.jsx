import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useMsal, useIsAuthenticated, useMsalAuthentication } from "@azure/msal-react";
import { InteractionType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import SignaturePad from "signature_pad";

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
  shadowMd: "0 4px 24px rgba(91,33,182,0.12), 0 1px 4px rgba(91,33,182,0.06)",
  shadowLg: "0 8px 40px rgba(91,33,182,0.16)",
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: ${C.offWhite}; color: ${C.textPrimary}; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
`;

// ── Tenant guard ──────────────────────────────────────────────────────────────
const ALLOWED_TENANT_ID = process.env.REACT_APP_AZURE_TENANT_ID;
function getTenantFromAccount(account) {
  return account?.tenantId || account?.idTokenClaims?.tid || null;
}
function isAllowedTenant(account) {
  return getTenantFromAccount(account) === ALLOWED_TENANT_ID;
}

// ── Page chrome ───────────────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div style={{
      background: C.white,
      borderBottom: `1px solid ${C.border}`,
      padding: "0 32px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
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
        border: `1px solid ${C.purpleMid}`, letterSpacing: "0.04em", textTransform: "uppercase"
      }}>
        HR Forms
      </span>
    </div>
  );
}

// ── User badge ────────────────────────────────────────────────────────────────
function UserBadge({ userEmail, layer, total, alreadyDone, onLogout, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = userEmail
    ? userEmail.split("@")[0].split(".").map(p => p[0]?.toUpperCase()).join("").slice(0, 2)
    : "?";

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 12,
        background: C.white, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "10px 14px", cursor: "pointer",
        userSelect: "none", justifyContent: "space-between",
        boxShadow: C.shadow, transition: "border-color 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.borderDark}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
            color: C.white, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, fontWeight: 600,
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
          }}>
            L{layer} / {total}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
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
            { icon: "🔄", label: "Switch account", action: onSwitch, color: C.textPrimary },
            { icon: "🚪", label: "Sign out", action: onLogout, color: C.red },
          ].map(({ icon, label, action, color }) => (
            <button key={label} onClick={() => { setOpen(false); action(); }} style={{
              width: "100%", padding: "10px 16px", background: "none", border: "none",
              borderBottom: label === "Switch account" ? `1px solid ${C.border}` : "none",
              textAlign: "left", cursor: "pointer", fontSize: 13, color,
              display: "flex", alignItems: "center", gap: 10, transition: "background 0.1s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.offWhite}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ fontSize: 15 }}>{icon}</span> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#EDE9FE 25%,#DDD6FE 50%,#EDE9FE 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.6s infinite", ...style,
    }} />
  );
}

function PageSkeleton({ userEmail }) {
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
          <div style={{ width: 16, height: 16, border: `2px solid ${C.purpleMid}`, borderTop: `2px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
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

function LoginWaitScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <div style={{ width: 48, height: 48, border: `3px solid ${C.purpleMid}`, borderTop: `3px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", marginBottom: 24 }} />
      <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontSize: 22, marginBottom: 8 }}>Signing you in…</h2>
      <p style={{ color: C.textMuted, fontSize: 14 }}>Redirecting to Microsoft 365. Please wait.</p>
    </div>
  );
}

// ── Full-page screens ─────────────────────────────────────────────────────────
function Screen({ icon, title, message, color = C.textSecond, children }) {
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

function Btn({ children, onClick, variant = "primary", disabled = false, style = {} }) {
  const base = {
    padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer", border: "none",
    display: "inline-flex", alignItems: "center", gap: 8,
    transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif", ...style,
  };
  const variants = {
    primary: { background: disabled ? C.border : C.purple, color: disabled ? C.textMuted : C.white },
    secondary: { background: C.white, color: C.textPrimary, border: `1px solid ${C.border}` },
    danger: { background: disabled ? C.border : C.red, color: disabled ? C.textMuted : C.white },
    ghost: { background: "none", color: C.red, border: `1px solid ${C.redPale}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

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

function SuccessPage({ userEmail, layer, signedAt, action }) {
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
          }}>
            {approved ? "✓" : "✕"}
          </div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontWeight: 400, fontSize: 22, marginBottom: 8 }}>
            {approved ? "Approval Submitted" : "Application Rejected"}
          </h2>
          <p style={{ color: C.textSecond, marginBottom: 4, lineHeight: 1.7, fontSize: 14 }}>
            Your Layer {layer} {approved ? "approval" : "rejection"} has been recorded.
          </p>
          <DetailCard items={[
            { label: approved ? "Approved by" : "Rejected by", value: userEmail },
            { label: "Approval layer", value: `Layer ${layer}` },
            { label: "Date / Time", value: new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) },
          ]} />
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 20 }}>You may close this window.</p>
        </div>
      </div>
    </div>
  );
}

function AlreadySignedPage({ userEmail, signedEmail, layer, signedAt, action }) {
  const approved = action !== "Rejected";
  const isSelf = signedEmail && userEmail && signedEmail.toLowerCase() === userEmail.toLowerCase();
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
          <DetailCard items={[
            { label: approved ? "Approved by" : "Rejected by", value: signedEmail },
            { label: "Layer", value: `Layer ${layer}` },
            { label: "Signed at", value: signedAt ? new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—" },
          ]} />
          <p style={{ color: C.textMuted, fontSize: 12, marginTop: 20 }}>You may close this window.</p>
        </div>
      </div>
    </div>
  );
}

function WrongTenantScreen({ userEmail, onLogout, onSwitch }) {
  return (
    <Screen icon="🚫" title="Access Restricted" color={C.red}
      message={<>This portal is only accessible to users within the organisation. The account <strong>{userEmail}</strong> is not part of the authorised tenant.</>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn onClick={onSwitch} variant="primary">🔄 Sign in with a different account</Btn>
        <Btn onClick={onLogout} variant="ghost">🚪 Sign out</Btn>
      </div>
    </Screen>
  );
}

function WaitingForLayersScreen({ userLayer, currentLayer, totalLayers, layers, userEmail, onLogout, onSwitch }) {
  const pendingLayers = Array.from({ length: userLayer - 1 }, (_, i) => i + 1)
    .filter(n => { const l = layers[n - 1]; return !l || l.status !== "Signed"; });

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
          <h2 style={{ fontFamily: "'DM Serif Display', serif", color: C.textPrimary, fontWeight: 400, fontSize: 22, marginBottom: 8 }}>
            Awaiting Prior Approval{pendingLayers.length > 1 ? "s" : ""}
          </h2>
          <p style={{ color: C.textSecond, lineHeight: 1.7, fontSize: 14, marginBottom: 28 }}>
            You are the <strong>Layer {userLayer}</strong> approver.{" "}
            {pendingLayers.length === 1 ? `Layer ${pendingLayers[0]} must approve first.` : `Layers ${pendingLayers.join(" and ")} must approve first.`}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, textAlign: "left" }}>
            {Array.from({ length: totalLayers }, (_, i) => {
              const n = i + 1;
              const l = layers[i];
              const signed = l?.status === "Signed";
              const isMe = n === userLayer;
              const pending = !signed && n < userLayer;
              return (
                <div key={n} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 8,
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
                      {signed ? `Approved${l?.signedAt ? " · " + new Date(l.signedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : ""}` : pending ? "Pending approval" : isMe ? "Waiting for layers above" : "Pending"}
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
            <Btn onClick={onSwitch} variant="primary">🔄 Switch account</Btn>
            <Btn onClick={onLogout} variant="ghost">🚪 Sign out</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status Overlay Modal (rejected / fullyApproved) ───────────────────────────
function StatusOverlayModal({ formStatus, layers, totalLayers, onViewDetails }) {
  const isRejected = formStatus === "rejected";

  const rejectedIndex = isRejected
    ? layers.findIndex(l => l?.outcome === "Rejected")
    : -1;
  const rejectedLayer = rejectedIndex >= 0 ? layers[rejectedIndex] : null;
  const rejectedLayerNum = rejectedIndex + 1;

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
        {/* Icon */}
        <div style={{
          width: 68, height: 68, borderRadius: "50%", margin: "0 auto 20px",
          background: isRejected ? C.redPale : C.greenPale,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30,
        }}>
          {isRejected ? "✕" : "✓"}
        </div>

        <h2 style={{
          fontFamily: "'DM Serif Display', serif", fontWeight: 400,
          fontSize: 22, color: C.textPrimary, marginBottom: 8,
        }}>
          {isRejected ? "Application Rejected" : "All Approvals Complete"}
        </h2>

        <p style={{ color: C.textSecond, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          {isRejected
            ? `This application was rejected at Layer ${rejectedLayerNum}. No further approvals are required.`
            : `All ${totalLayers} approval layer${totalLayers > 1 ? "s" : ""} have been completed successfully.`}
        </p>

        {/* Rejected detail card */}
        {isRejected && rejectedLayer && (
          <div style={{
            background: C.redPale, border: `1px solid #FCA5A5`,
            borderRadius: 10, padding: "16px 18px", textAlign: "left", marginBottom: 24,
          }}>
            {[
              { label: "Rejected by", value: rejectedLayer.email || "—" },
              { label: "Layer", value: `Layer ${rejectedLayerNum}` },
              { label: "Date / Time", value: rejectedLayer.signedAt ? new Date(rejectedLayer.signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—" },
              { label: "Reason", value: rejectedLayer.rejectionReason || "No reason provided" },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ marginBottom: i < arr.length - 1 ? 12 : 0 }}>
                <div style={{ fontSize: 10, color: C.red, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: label === "Reason" ? 500 : 400, lineHeight: 1.5 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Fully approved summary */}
        {!isRejected && (
          <div style={{
            background: C.greenPale, border: `1px solid #6EE7B7`,
            borderRadius: 10, padding: "14px 18px", textAlign: "left", marginBottom: 24,
          }}>
            {layers.map((l, i) => l && (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: i < layers.length - 1 ? 10 : 0,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: C.green, color: C.white,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>✓</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>
                    Layer {i + 1} — {l.email || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: C.green, marginTop: 1 }}>
                    {l.signedAt ? new Date(l.signedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Btn
          onClick={onViewDetails}
          variant="primary"
          style={{ width: "100%", justifyContent: "center", padding: "12px 22px" }}
        >
          📋 View Full Application Details
        </Btn>
        <p style={{ color: C.textMuted, fontSize: 11, marginTop: 14 }}>
          Read-only view — no actions can be taken.
        </p>
      </div>
    </div>,
    document.body
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ type, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");
  const isReject = type === "reject";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(2px)" }}>
      <div style={{ background: C.white, borderRadius: 16, padding: "32px 28px", maxWidth: 480, width: "100%", boxShadow: C.shadowLg, border: `1px solid ${C.border}`, animation: "fadeUp 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: isReject ? C.redPale : C.purplePale,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 600, color: isReject ? C.red : C.purple,
          }}>
            {isReject ? "✕" : "✓"}
          </div>
          <div>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, fontWeight: 400, color: C.textPrimary }}>{isReject ? "Reject Application" : "Approve Application"}</h3>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{isReject ? "This action cannot be undone." : "Please confirm your approval."}</p>
          </div>
        </div>

        <div style={{ background: C.offWhite, borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: C.textSecond, lineHeight: 1.7, border: `1px solid ${C.border}` }}>
          {isReject ? "Rejecting this application will notify the applicant and stop the approval process. Please provide a reason below." : "By approving, you confirm that you have reviewed this training application and agree to proceed."}
        </div>

        {isReject && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: C.textSecond, display: "block", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Rejection Reason <span style={{ color: C.red }}>*</span>
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter reason for rejection…" rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${reason.trim() ? C.border : C.red}`, fontSize: 13, color: C.textPrimary, resize: "vertical", fontFamily: "'DM Sans', sans-serif", outline: "none", background: C.white }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn onClick={onCancel} variant="secondary" disabled={loading}>Cancel</Btn>
          <Btn onClick={() => onConfirm(reason)} variant={isReject ? "danger" : "primary"} disabled={loading || (isReject && !reason.trim())}>
            {loading && <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {loading ? "Submitting…" : isReject ? "Confirm Rejection" : "Confirm Approval"}
          </Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Read-only form ────────────────────────────────────────────────────────────
function Field({ label, value, full = false }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
      <div style={{ padding: "9px 12px", background: C.offWhite, borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, color: C.textPrimary, minHeight: 38, lineHeight: 1.6 }}>
        {value || <span style={{ color: C.textMuted }}>—</span>}
      </div>
    </div>
  );
}

function SectionDivider({ number, title }) {
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

function ReadOnlyForm({ data, formId, formVersion }) {
  if (!data) return null;
  const fmt = v => (v !== undefined && v !== null && v !== "") ? `RM ${parseFloat(v).toFixed(2)}` : "RM 0.00";
  const isYes = v => v === true || v === "true" || v === "Yes" || v === 1;
  const fmtDt = v => v ? new Date(v).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const total = [data.trainingFee, data.mileage, data.mealAllowance, data.accommodation, data.otherCost].reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2);

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow }}>
      {/* Form header bar */}
      <div style={{ background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Training Requisition Form</div>
          <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>Form ID: <strong style={{ fontFamily: "monospace" }}>#{formId || "—"}</strong></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Submitted: {fmtDt(data.submittedAt)}</div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 11, color: C.purpleMid, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)" }}>Version: {formVersion || "—"}</span>
        </div>
      </div>

      <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
        <SectionDivider number={1} title="Employee Details" />
        <Field label="Employee Name" value={data.employeeName} />
        <Field label="Position" value={data.position} />
        <Field label="Department" value={data.department} />
        <Field label="Reporting Manager" value={data.reportingManager} />

        <SectionDivider number={2} title="Training Details" />
        <Field label="Course Name" value={data.courseName} />
        <Field label="Training Provider" value={data.trainingProvider} />
        <Field label="Start Date / Time" value={fmtDt(data.startDate)} />
        <Field label="End Date / Time" value={fmtDt(data.endDate)} />
        <Field label="Training Objective" value={data.trainingObjective} full />
        <Field label="Venue" value={data.venue} full />

        <SectionDivider number={3} title="Cost Breakdown" />
        <Field label="Training Fee" value={fmt(data.trainingFee)} />
        <Field label="Mileage / Transport" value={fmt(data.mileage)} />
        <Field label="Meal Allowance" value={fmt(data.mealAllowance)} />
        <Field label="Accommodation" value={fmt(data.accommodation)} />
        <Field label="Other Cost" value={fmt(data.otherCost)} />
        <Field label="HRDC Claimable" value={isYes(data.hrdcApplication) ? "Yes" : "No"} />
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Total Cost</div>
          <div style={{ padding: "10px 14px", background: C.purplePale, borderRadius: 7, border: `1px solid ${C.purpleMid}`, fontSize: 16, color: C.purple, fontWeight: 700 }}>RM {total}</div>
        </div>

        <SectionDivider number={4} title="Submitted By" />
        <Field label="Applicant Name" value={data.applicantName} />
        <Field label="Submitted At" value={fmtDt(data.submittedAt)} />
        {data.applicantSignature && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Applicant Signature</div>
            <div style={{ padding: 12, background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, display: "inline-block" }}>
              <img src={data.applicantSignature} alt="Applicant signature" style={{ maxWidth: 280, maxHeight: 100, display: "block" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Signature dialog ──────────────────────────────────────────────────────────
function SignatureDialog({ open, onConfirm, onCancel, existingData }) {
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
    <div onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(30,27,75,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(2px)" }}>
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

function SignatureTrigger({ value, onChange, submitting }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  if (submitting) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: C.purple, fontSize: 13 }}>
        <div style={{ width: 16, height: 16, border: `2px solid ${C.purpleMid}`, borderTop: `2px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
        Submitting…
      </div>
    );
  }
  return (
    <>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
        {value ? "Signature captured — tap to edit" : "Tap the box below to draw your signature:"}
      </div>
      <div onClick={() => setDialogOpen(true)} style={{
        border: value ? `2px solid ${C.purple}` : `2px dashed ${C.border}`,
        borderRadius: 10, background: value ? C.purplePale : C.offWhite,
        minHeight: 100, maxWidth: 460, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", cursor: "pointer",
        position: "relative", overflow: "hidden", userSelect: "none",
        transition: "border-color 0.15s",
      }}>
        {value ? (
          <>
            <img src={value} alt="Signature" style={{ maxWidth: "90%", maxHeight: 80, display: "block", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 8, right: 8, background: C.purple, color: C.white, borderRadius: 5, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>Tap to edit</div>
            <button onClick={e => { e.stopPropagation(); onChange(null); }} style={{ position: "absolute", top: 8, left: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: C.red }}>Remove</button>
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
      <SignatureDialog open={dialogOpen} onConfirm={dataUrl => { onChange(dataUrl); setDialogOpen(false); }} onCancel={() => setDialogOpen(false)} existingData={value} />
    </>
  );
}

// ── Layer meta ────────────────────────────────────────────────────────────────
function getLayerMeta(subject, layer) {
  if (subject === "Managerial") {
    return {
      roleTitle: layer === 1 ? "Group Human Resource Head" : "Chief Human Resource Officer",
      sectionLabel: layer === 1 ? "Recommended By" : "Approved By",
    };
  }
  if (subject === "Non-Managerial") {
    return {
      roleTitle: layer === 1 ? "Head of Department" : "Group Human Resource Head",
      sectionLabel: layer === 1 ? "Recommended By" : "Approved By",
    };
  }
  return { roleTitle: `Layer ${layer} Approver`, sectionLabel: `Layer ${layer}` };
}

// ── Approval box ──────────────────────────────────────────────────────────────
function ApprovalBox({ layer, totalLayers, email, signedAt, status, outcome, rejectionReason, isMine, onApprove, onReject, submitting, subject }) {
  const signed = status === "Signed";
  const rejected = outcome === "Rejected";
  const [sig, setSig] = useState(null);
  const { roleTitle, sectionLabel } = getLayerMeta(subject, layer);

  const theme = signed
    ? rejected
      ? { border: "#FCA5A5", bg: C.redPale, accent: C.red, badgeBg: "#FCA5A5", badgeColor: "#7F1D1D" }
      : { border: "#6EE7B7", bg: C.greenPale, accent: C.green, badgeBg: "#6EE7B7", badgeColor: "#064E3B" }
    : isMine
      ? { border: C.borderDark, bg: C.purplePale, accent: C.purple, badgeBg: C.purpleMid, badgeColor: C.purpleDark }
      : { border: C.border, bg: C.offWhite, accent: C.textMuted, badgeBg: C.border, badgeColor: C.textMuted };

  const badgeText = signed ? (rejected ? "Rejected" : "Approved") : isMine ? "Action Required" : "Pending";

  return (
    <div style={{
      border: `1px solid ${theme.border}`, borderRadius: 12, padding: "22px 24px",
      marginBottom: 12, background: theme.bg,
      opacity: (!signed && !isMine) ? 0.55 : 1,
      boxShadow: isMine ? `0 0 0 3px ${C.purplePale}, ${C.shadow}` : C.shadow,
      transition: "box-shadow 0.2s",
    }}>
      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        {sectionLabel}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: signed ? (rejected ? C.red : C.green) : isMine ? C.purple : C.border,
            color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
          }}>{signed ? (rejected ? "✕" : "✓") : layer}</div>
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

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {[
          { label: "Approver Email", value: email || "—" },
          { label: "Date / Time", value: signedAt ? new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—" },
          ...(signed && outcome ? [{ label: "Decision", value: outcome }] : []),
          // ── Show rejection reason if present ──────────────────────────────
          ...(signed && rejected && rejectionReason ? [{ label: "Rejection Reason", value: rejectionReason }] : []),
        ].map(({ label, value }) => (
          <div key={label} style={{ ...(label === "Rejection Reason" ? { flexBasis: "100%" } : {}) }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
            <div style={{
              fontSize: 13,
              color: label === "Decision" ? (rejected ? C.red : C.green) : label === "Rejection Reason" ? C.textPrimary : C.textPrimary,
              fontWeight: label === "Decision" ? 600 : label === "Rejection Reason" ? 500 : 400,
              lineHeight: label === "Rejection Reason" ? 1.6 : "normal",
            }}>{value}</div>
          </div>
        ))}
      </div>

      {signed && !rejected && (
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Signature</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, color: C.textMuted }}>
            <span style={{ color: C.green }}>✓</span> Signature on file
          </div>
        </div>
      )}

      {!signed && !isMine && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 12 }}>
          <span>🔒</span> Locked — waiting for Layer {layer - 1} approval
        </div>
      )}

      {isMine && !signed && (
        <div>
          <SignatureTrigger value={sig} onChange={setSig} submitting={submitting} />
          <div style={{ display: "flex", gap: 10, marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <Btn onClick={() => onApprove(sig)} variant="primary" disabled={submitting || !sig} style={{ flex: 1, minWidth: 140, justifyContent: "center" }}>
              ✓ Approve Application
            </Btn>
            <Btn onClick={onReject} variant="ghost" disabled={submitting}>
              ✕ Reject
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared approval chain renderer ────────────────────────────────────────────
function ApprovalChain({ layers, totalLayers, myLayer, curLayer, alreadyDone, subject, submitting, onApprove, onReject, readOnly = false }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>5</div>
            <span style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>Approval Chain</span>
          </div>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            <span style={{ color: C.purple, fontWeight: 600 }}>{layers.filter(l => l?.status === "Signed").length}</span> of {totalLayers} completed
          </span>
        </div>

        <div style={{ padding: "16px 22px" }}>
          {layers.map((layer, i) => {
            const layerNum = i + 1;
            // In readOnly mode (terminal state), no layer is ever "mine" — pure view
            const isMine = !readOnly && myLayer === layerNum && curLayer === layerNum && !alreadyDone;
            return (
              <ApprovalBox
                key={layerNum}
                layer={layerNum}
                totalLayers={totalLayers}
                email={layer?.email}
                signedAt={layer?.signedAt}
                status={layer?.status}
                outcome={layer?.outcome}
                rejectionReason={layer?.rejectionReason}
                isMine={isMine}
                onApprove={isMine ? onApprove : null}
                onReject={isMine ? onReject : null}
                subject={subject}
                submitting={isMine && submitting}
              />
            );
          })}

          {!readOnly && alreadyDone && (
            <div style={{ background: C.greenPale, border: "1px solid #6EE7B7", borderRadius: 8, padding: "12px 16px", color: C.green, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>✓</span> You have already actioned this application. Waiting for remaining approvers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TrainReqApprovePage() {
  const { error: msalError } = useMsalAuthentication(InteractionType.Redirect, loginRequest);
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const retryFnRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [signResult, setSignResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dialog, setDialog] = useState(null);
  const [pendingSig, setPendingSig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Controls whether the status overlay is shown for terminal states
  const [showOverlay, setShowOverlay] = useState(true);

  const token = new URLSearchParams(window.location.search).get("token");

  const handleLogout = useCallback(() => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.href });
  }, [instance]);

  const handleSwitch = useCallback(() => {
    instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.href, onRedirectNavigate: () => false })
      .catch(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account" }));
  }, [instance, accounts]);

  useEffect(() => {
    if (msalError && msalError.errorCode !== "interaction_in_progress") {
      setStatus("error");
      setErrorMsg("Microsoft login failed. Please close this tab and try the link again.");
    }
  }, [msalError]);

  useEffect(() => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    if (!token || accounts.length === 0) return;
    if (status !== "idle") return;

    const account = accounts[0];
    const userEmail = account.username;

    if (!isAllowedTenant(account)) { setStatus("wrong_tenant"); return; }

    setStatus("loading");

    fetch(process.env.REACT_APP_FLOW_URL_FETCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userEmail }),
    })
      .then(r => r.json())
      .then(d => {
        const payload = d.body ?? d;
        if (payload.alreadySigned) { setData(payload); setStatus("already_signed"); return; }
        if (!payload.authorized) { setStatus("unauthorized"); setErrorMsg(payload.message || "You are not authorised."); return; }
        const subject = payload.submissionData?.subject;
        if (!subject || subject === "Unassigned") { setStatus("unassigned"); return; }
        setData(payload);

        // ── Terminal states: rejected or all layers done ──────────────────
        const fs = payload.formStatus;
        if (fs === "rejected" || fs === "fullyApproved") {
          setShowOverlay(true);   // always show modal first
          setStatus("terminal");
        } else {
          setStatus("ready");
        }
      })
      .catch(e => { console.error("Fetch error:", e); setStatus("error"); setErrorMsg("Unable to load the application. Please try again or contact HR."); });
  }, [isAuthenticated, inProgress, accounts, token, status]);

  const handleApproveClick = useCallback((sig) => { setPendingSig(sig); setDialog("approve"); }, []);
  const handleRejectClick = useCallback(() => { setPendingSig(null); setDialog("reject"); }, []);

  const handleConfirmApprove = useCallback(async () => {
    if (!data || !accounts.length || !pendingSig) return;
    const userEmail = accounts[0].username;
    const signedAt = new Date().toISOString();
    const doSubmit = async () => {
      setSubmitting(true); setStatus("ready"); setDialog(null);
      try {
        const res = await fetch(process.env.REACT_APP_FLOW_URL_SIGN, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: String(token),
            userEmail: String(userEmail),
            userLayer: String(data.userLayer),
            signature: String(pendingSig),
            signedAt: String(signedAt),
            action: "approved",
            formID: String(data?.formId || ""),
            submissionID: String(data?.submissionID || "")
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error("PA 400 response body:", errText);
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        setSignResult({ signedAt, action: "approved" }); setStatus("done"); retryFnRef.current = null;
      } catch (e) { console.error(e); setErrorMsg("Failed to submit approval. Please try again."); setStatus("submit_error"); }
      finally { setSubmitting(false); }
    };
    retryFnRef.current = doSubmit; await doSubmit();
  }, [data, token, accounts, pendingSig]);

  const handleConfirmReject = useCallback(async (reason) => {
    if (!data || !accounts.length) return;
    const userEmail = accounts[0].username;
    const signedAt = new Date().toISOString();
    const doSubmit = async () => {
      setSubmitting(true); setStatus("ready"); setDialog(null);
      try {
        const res = await fetch(process.env.REACT_APP_FLOW_URL_SIGN, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: String(token),
            userEmail: String(userEmail),
            userLayer: String(data.userLayer),
            signature: "",
            signedAt: String(signedAt),
            action: "rejected",
            formID: String(data?.formId || ""),
            submissionID: String(data?.submissionID || ""),
            rejectionReason: String(reason || "")
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error("PA 400 response body:", errText);
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        setSignResult({ signedAt, action: "rejected" }); setStatus("done"); retryFnRef.current = null;
      } catch (e) { console.error(e); setErrorMsg("Failed to submit rejection. Please try again."); setStatus("submit_error"); }
      finally { setSubmitting(false); }
    };
    retryFnRef.current = doSubmit; await doSubmit();
  }, [data, token, accounts]);

  const userEmail = accounts[0]?.username || "";

  // ── Render states ──────────────────────────────────────────────────────────
  if (!isAuthenticated || inProgress !== InteractionStatus.None) return <LoginWaitScreen />;
  if (status === "idle" || status === "loading") return <PageSkeleton userEmail={userEmail} />;
  if (status === "wrong_tenant") return <WrongTenantScreen userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;
  if (status === "unauthorized") return <Screen icon="🔒" title="Access Denied" message={errorMsg} color={C.red} />;
  if (status === "error") return (
    <Screen icon="❌" title="Something Went Wrong" message={errorMsg} color={C.red}>
      <Btn onClick={() => { setStatus("idle"); window.location.reload(); }} variant="primary">Try again</Btn>
    </Screen>
  );
  if (status === "submit_error") return (
    <Screen icon="❌" title="Submission Failed" message={errorMsg} color={C.red}>
      <Btn onClick={() => retryFnRef.current?.()} variant="primary">Try again</Btn>
    </Screen>
  );
  if (status === "already_signed") {
    const ld = data?.[`l${data?.userLayer}`];
    return <AlreadySignedPage userEmail={userEmail} signedEmail={ld?.email || userEmail} layer={data?.userLayer} signedAt={ld?.signedAt} action={ld?.outcome} />;
  }
  if (status === "done") return <SuccessPage userEmail={userEmail} layer={data?.userLayer} signedAt={signResult?.signedAt} action={signResult?.action} />;
  if (status === "unassigned") return (
    <Screen icon="⚠️" title="No Subject Assigned" color={C.amber}
      message="This training application has not been assigned a subject (Managerial / Non-Managerial). Please contact HR to update the form before approval can proceed." />
  );
  if (!data) return null;

  // ── Terminal state: rejected or fullyApproved ──────────────────────────────
  if (status === "terminal") {
    const { submissionData, formId, formVersion, totalLayers, formStatus } = data;
    const total = parseInt(totalLayers);
    const layers = Array.from({ length: total }, (_, i) => data[`l${i + 1}`] || null);
    const isRejected = formStatus === "rejected";

    return (
      <div style={{ minHeight: "100vh", background: C.offWhite }}>
        <style>{globalStyles}</style>
        <PageHeader />

        {/* Overlay modal — shown first, dismissed by "View Details" */}
        {showOverlay && (
          <StatusOverlayModal
            formStatus={formStatus}
            layers={layers}
            totalLayers={total}
            onViewDetails={() => setShowOverlay(false)}
          />
        )}

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>
          {/* Persistent status banner (visible after overlay is dismissed) */}
          <div style={{
            background: isRejected ? C.redPale : C.greenPale,
            border: `1px solid ${isRejected ? "#FCA5A5" : "#6EE7B7"}`,
            borderRadius: 10, padding: "12px 18px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: isRejected ? C.red : C.green, fontWeight: 500 }}>
              <span>{isRejected ? "✕" : "✓"}</span>
              {isRejected
                ? "This application has been rejected — viewing in read-only mode."
                : "All approvals are complete — viewing in read-only mode."}
            </div>
            {/* Re-open overlay button */}
            {!showOverlay && (
              <button
                onClick={() => setShowOverlay(true)}
                style={{
                  background: "none", border: `1px solid ${isRejected ? "#FCA5A5" : "#6EE7B7"}`,
                  borderRadius: 6, padding: "4px 12px", fontSize: 12,
                  color: isRejected ? C.red : C.green, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                View summary
              </button>
            )}
          </div>

          <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />

          <ApprovalChain
            layers={layers}
            totalLayers={total}
            subject={data?.submissionData?.subject}
            readOnly={true}
          />

          <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textMuted, paddingBottom: 32 }}>
            PMW International Berhad · HR-Forms · Confidential
          </div>
        </div>
      </div>
    );
  }

  // ── Normal ready state ─────────────────────────────────────────────────────
  const { submissionData, formId, formVersion, totalLayers, userLayer, currentLayer } = data;
  const total = parseInt(totalLayers);
  const myLayer = parseInt(userLayer);
  const curLayer = parseInt(currentLayer);
  const alreadyDone = myLayer < curLayer;

  const layers = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    return data[`l${n}`] || { email: null, signedAt: null, status: "Pending", outcome: null };
  });

  const mustWait = myLayer > curLayer;
  if (mustWait) {
    return <WaitingForLayersScreen userLayer={myLayer} currentLayer={curLayer} totalLayers={total} layers={layers} userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <PageHeader />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>
        {dialog && (
          <ConfirmDialog type={dialog} loading={submitting}
            onConfirm={dialog === "approve" ? handleConfirmApprove : handleConfirmReject}
            onCancel={() => setDialog(null)} />
        )}

        {/* User badge */}
        <div style={{ marginBottom: 24 }}>
          <UserBadge userEmail={userEmail} layer={myLayer} total={total} alreadyDone={alreadyDone} onLogout={handleLogout} onSwitch={handleSwitch} />
        </div>

        {/* Form data */}
        <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />

        {/* Approval chain */}
        <ApprovalChain
          layers={layers}
          totalLayers={total}
          myLayer={myLayer}
          curLayer={curLayer}
          alreadyDone={alreadyDone}
          subject={data?.submissionData?.subject}
          submitting={submitting}
          onApprove={handleApproveClick}
          onReject={handleRejectClick}
          readOnly={false}
        />

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textMuted, paddingBottom: 32 }}>
          PMW International Berhad · HR-Forms · Confidential
        </div>
      </div>
    </div>
  );
}