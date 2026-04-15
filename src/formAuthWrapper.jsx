import React, { useState, useEffect, createContext, useContext } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

// ── Auth Context ──────────────────────────────────────────────────────────────
export const FormAuthContext = createContext({ userEmail: null });
export const useFormAuth = () => useContext(FormAuthContext);

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  purple: "#5B21B6",
  purpleLight: "#7C3AED",
  purplePale: "#EDE9FE",
  purpleMid: "#DDD6FE",
  white: "#FFFFFF",
  offWhite: "#F8F7FF",
  border: "#E5E3F0",
  textPrimary: "#1E1B4B",
  textSecond: "#6B7280",
  textMuted: "#9CA3AF",
  green: "#059669",
  greenPale: "#D1FAE5",
  shadow: "0 4px 24px rgba(91,33,182,0.12)",
  shadowLg: "0 8px 40px rgba(91,33,182,0.16)",
};

const STORAGE_KEY = "form_auth_guest_decision";

function getStoredDecision() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function setStoredDecision(val) {
  try { localStorage.setItem(STORAGE_KEY, val); } catch {}
}

function clearStoredDecision() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ── Logged-in badge shown at top of form ──────────────────────────────────────
function LoggedInBanner({ userEmail, onLogout }) {
  const initials = userEmail
    ? userEmail.split("@")[0].split(".").map(p => p[0]?.toUpperCase()).join("").slice(0, 2)
    : "?";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: C.purplePale, border: `1px solid ${C.purpleMid}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 16,
      fontSize: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
          color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600,
        }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 500, color: C.textPrimary }}>{userEmail}</div>
          <div style={{ fontSize: 11, color: C.purple, marginTop: 1 }}>
            ✓ Signed in — your submission will be linked to your account
          </div>
        </div>
      </div>
      <button
        onClick={onLogout}
        style={{
          background: "none", border: `1px solid ${C.purpleMid}`, borderRadius: 6,
          padding: "5px 12px", fontSize: 11, color: C.purple, cursor: "pointer",
          fontFamily: "inherit", fontWeight: 500,
        }}
      >
        Sign out
      </button>
    </div>
  );
}

// ── Guest banner ──────────────────────────────────────────────────────────────
function GuestBanner({ onLogin }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: C.offWhite, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 16,
      fontSize: 12, flexWrap: "wrap",
    }}>
      <span style={{ color: C.textSecond }}>
        You're filling this form as a guest. Sign in to track your submissions.
      </span>
      <button
        onClick={onLogin}
        style={{
          background: C.purple, color: C.white, border: "none", borderRadius: 6,
          padding: "6px 14px", fontSize: 12, cursor: "pointer",
          fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap",
        }}
      >
        Sign in
      </button>
    </div>
  );
}

// ── Soft modal login prompt ───────────────────────────────────────────────────
function LoginPromptModal({ formTitle, onLogin, onSkip, onSkipRemember }) {
  const [remember, setRemember] = useState(false);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(30,27,75,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: C.white, borderRadius: 16, padding: "36px 32px",
        maxWidth: 420, width: "100%", boxShadow: C.shadowLg,
        border: `1px solid ${C.border}`,
        animation: "fadeUp 0.25s ease",
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 12, margin: "0 auto 18px",
          background: C.purplePale,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke={C.purple} strokeWidth="1.5"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1.5" fill={C.purple}/>
          </svg>
        </div>

        <h2 style={{
          fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 400,
          color: C.textPrimary, textAlign: "center", marginBottom: 8,
        }}>
          Sign in to track your submission
        </h2>
        <p style={{ color: C.textSecond, fontSize: 13, textAlign: "center", lineHeight: 1.7, marginBottom: 22 }}>
          Signing in with Microsoft 365 lets you view your submitted forms and their approval status on the dashboard. You can also fill this form as a guest.
        </p>

        {/* Form name pill */}
        <div style={{
          background: C.purplePale, border: `1px solid ${C.purpleMid}`,
          borderRadius: 8, padding: "8px 12px", marginBottom: 22,
          fontSize: 12, color: C.purple, textAlign: "center", fontWeight: 500,
        }}>
          📋 {formTitle}
        </div>

        {/* Sign in button */}
        <button
          onClick={onLogin}
          style={{
            width: "100%", padding: "12px", borderRadius: 8,
            background: C.purple, color: C.white, border: "none",
            fontSize: 14, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6.5" height="6.5" fill="#F25022"/>
            <rect x="8.5" y="1" width="6.5" height="6.5" fill="#7FBA00"/>
            <rect x="1" y="8.5" width="6.5" height="6.5" fill="#00A4EF"/>
            <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft 365
        </button>

        {/* Remember me */}
        <label style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          fontSize: 12, color: C.textSecond, marginBottom: 16, userSelect: "none",
        }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            style={{ width: 14, height: 14, cursor: "pointer", accentColor: C.purple }}
          />
          Remember my choice (don't ask again on this device)
        </label>

        {/* Continue as guest */}
        <button
          onClick={() => remember ? onSkipRemember() : onSkip()}
          style={{
            width: "100%", padding: "10px", borderRadius: 8,
            background: "none", color: C.textSecond,
            border: `1px solid ${C.border}`,
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Continue as guest →
        </button>
      </div>
    </div>
  );
}

// ── Main wrapper ──────────────────────────────────────────────────────────────
export default function FormAuthWrapper({ children, formTitle = "HR Form" }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [promptState, setPromptState] = useState("checking"); // checking | prompt | guest | loggedin

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    if (isAuthenticated) {
      setPromptState("loggedin");
      return;
    }

    const stored = getStoredDecision();
    if (stored === "guest") {
      setPromptState("guest");
    } else {
      setPromptState("prompt");
    }
  }, [isAuthenticated, inProgress]);

  const handleLogin = () => {
    instance.loginRedirect({ ...loginRequest, prompt: "select_account" });
  };

  const handleLogout = () => {
    clearStoredDecision();
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.href });
  };

  const handleSkip = () => setPromptState("guest");

  const handleSkipRemember = () => {
    setStoredDecision("guest");
    setPromptState("guest");
  };

  // null for guests, email string for authenticated users
  const userEmail = isAuthenticated ? (accounts[0]?.username || null) : null;

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Soft modal — only shown when state is "prompt" */}
      {promptState === "prompt" && (
        <LoginPromptModal
          formTitle={formTitle}
          onLogin={handleLogin}
          onSkip={handleSkip}
          onSkipRemember={handleSkipRemember}
        />
      )}

      {/* Provide email (or null) to all child forms via context */}
      <FormAuthContext.Provider value={{ userEmail }}>
        <div>
          {promptState === "loggedin" && (
            <div style={{ maxWidth: 860, margin: "0 auto", padding: "12px 24px 0" }}>
              <LoggedInBanner userEmail={userEmail} onLogout={handleLogout} />
            </div>
          )}
          {promptState === "guest" && (
            <div style={{ maxWidth: 860, margin: "0 auto", padding: "12px 24px 0" }}>
              <GuestBanner onLogin={handleLogin} />
            </div>
          )}

          {/* Always render the form — prompt is a non-blocking overlay */}
          {children}
        </div>
      </FormAuthContext.Provider>
    </>
  );
}