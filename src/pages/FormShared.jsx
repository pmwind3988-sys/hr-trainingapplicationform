// ─────────────────────────────────────────────────────────────────────────────
//  formShared.jsx  — shared design tokens, components, and layout for HR forms
//  Import everything you need from here when building a new form page.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import SignaturePad from "signature_pad";
import logo from "../assets/logo.png";

// ── Design tokens ─────────────────────────────────────────────────────────────
export const C = {
  purple:      "#5B21B6",
  purpleLight: "#7C3AED",
  purplePale:  "#EDE9FE",
  purpleMid:   "#DDD6FE",
  purpleDark:  "#3B0764",
  white:       "#FFFFFF",
  offWhite:    "#F8F7FF",
  border:      "#E5E3F0",
  textPrimary: "#1E1B4B",
  textSecond:  "#6B7280",
  textMuted:   "#9CA3AF",
  red:         "#DC2626",
  redPale:     "#FEE2E2",
  shadow:      "0 1px 3px rgba(91,33,182,0.08), 0 4px 16px rgba(91,33,182,0.06)",
  shadowLg:    "0 8px 40px rgba(91,33,182,0.16)",
};

export const D = {
  bg:        "#0f0f1a",
  card:      "#1a1a2e",
  cardAlt:   "#13132a",
  border:    "#2d2d4e",
  text:      "#e0d7ff",
  textMuted: "#6b6b8a",
  accent:    "#a78bfa",
};

export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
`;

// ── useDarkTokens — derive all theme-dependent values in one call ─────────────
export function useDarkTokens(isDark) {
  return {
    bg:       isDark ? D.bg      : C.offWhite,
    card:     isDark ? D.card    : C.white,
    cardAlt:  isDark ? D.cardAlt : C.offWhite,
    bdr:      isDark ? D.border  : C.border,
    txt:      isDark ? D.text    : C.textPrimary,
    txtMuted: isDark ? D.accent  : C.textSecond,
  };
}

export function useBodyTheme(isDark) {
  useEffect(() => {
    document.body.style.margin     = "0";
    document.body.style.padding    = "0";
    document.body.style.background = isDark ? D.bg : C.offWhite;
    document.body.style.transition = "background 0.3s";
    return () => {
      document.body.style.background = "";
    };
  }, [isDark]);
};

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title;
    return () => { document.title = "PMW HR Forms"; }; // reset on unmount
  }, [title]);
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ isDark, onToggleDark, title }) {
  return (
    <div style={{
      background: isDark ? D.card : C.white,
      borderBottom: `1px solid ${isDark ? D.border : C.border}`,
      padding: "0 32px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 56, position: "sticky", top: 0, zIndex: 50,
      boxShadow: "0 1px 0 rgba(91,33,182,0.06)",
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M2 7h7M2 10h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{
          fontFamily: "'DM Serif Display', serif", fontSize: 17,
          color: isDark ? D.text : C.textPrimary, letterSpacing: "-0.01em",
          transition: "color 0.3s",
        }}>
          {title}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13 }}>{isDark ? "🌙" : "☀️"}</span>
        <div onClick={onToggleDark} role="switch" aria-checked={isDark} style={{
          width: 44, height: 24, borderRadius: 12, cursor: "pointer",
          background: isDark ? C.purple : C.border,
          position: "relative", transition: "background 0.25s", flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", top: 3, left: isDark ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%",
            background: C.white, transition: "left 0.25s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 500, color: C.purple,
          background: C.purplePale, borderRadius: 20, padding: "3px 10px",
          border: `1px solid ${C.purpleMid}`, letterSpacing: "0.04em",
          textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
        }}>
          HR Forms
        </span>
      </div>
    </div>
  );
}

// ── DocumentHeader — the ISO document card at the top of every form ───────────
//
//  Props:
//    formTitle     string   e.g. "TRAINING REQUISITION FORM"
//    formVersion   string   e.g. "1.0"
//    formId        string   e.g. "1"
//    isDark        bool
//
export function DocumentHeader({ formTitle, formVersion, formId, isDark }) {
  const { card, cardAlt, bdr, txt, txtMuted } = useDarkTokens(isDark);

  const labelCell = {
    width: 160, minWidth: 160,
    borderRight: `1px solid ${bdr}`,
    background: cardAlt,
    padding: "9px 14px",
    fontWeight: 600, fontSize: 11,
    color: txtMuted,
    textTransform: "uppercase", letterSpacing: "0.04em",
    fontFamily: "'DM Sans', sans-serif",
    verticalAlign: "middle",
  };

  const valueCell = {
    padding: "9px 14px",
    color: txt, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    verticalAlign: "middle",
  };

  return (
    <div style={{
      background: card,
      borderRadius: 12,
      border: `1px solid ${bdr}`,          // ← uses bdr so dark mode is correct
      overflow: "hidden", marginBottom: 20,
      boxShadow: C.shadow,
      transition: "background 0.3s, border-color 0.3s",
    }}>
      {/* Purple gradient bar */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
        padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>
            ISO 9001 · ISO 14001 · ISO 45001
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: C.white }}>
            {formTitle}
          </div>
        </div>
        <span style={{ fontSize: 11, color: C.purpleMid, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)", fontFamily: "'DM Sans', sans-serif" }}>
          v{formVersion}
        </span>
      </div>

      {/*
        Grid layout — 3 logical columns:
          col-A (160px) : logo | label | label | label | label
          col-B (flex)  : company name | doc-title value | form-title value | companies | doc-no value
          col-C (auto)  : — | — | — | — | version label + value

        The logo cell uses rowSpan=3 so it vertically spans:
          row-1 (company name), row-2 (document title), row-3 (form title)
        making col-A widths identical in all rows → perfect column alignment.
      */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {/* Row 1 — Logo (rowSpan 3) + Company name */}
          <tr style={{ borderBottom: `1px solid ${bdr}` }}>
            <td rowSpan={1} style={{
              width: 160, minWidth: 160,
              borderRight: `1px solid ${bdr}`,
              background: cardAlt,
              padding: "14px 20px",
              textAlign: "center", verticalAlign: "middle",
            }}>
              <img src={logo} alt="Company Logo" style={{ maxHeight: 40, objectFit: "contain" }} />
            </td>
            <td colSpan={2} style={{
              padding: "14px 20px",
              fontWeight: 700, fontSize: 15,
              color: txt, letterSpacing: "0.5px",
              fontFamily: "'DM Sans', sans-serif", verticalAlign: "middle",
            }}>
              PMW INTERNATIONAL BERHAD
            </td>
          </tr>

          {/* Row 2 — Document Title */}
          <tr style={{ borderBottom: `1px solid ${bdr}` }}>
            <td style={labelCell}>Document Title</td>
            <td style={valueCell}>ISO 9001, ISO 14001 &amp; ISO 45001</td>
          </tr>

          {/* Row 3 — Form Title */}
          <tr style={{ borderBottom: `1px solid ${bdr}` }}>
            <td style={labelCell}>Form Title</td>
            <td style={valueCell}>{formTitle}</td>
          </tr>

          {/* Row 4 — Companies */}
          <tr style={{ borderBottom: `1px solid ${bdr}` }}>
            <td style={labelCell}>Companies</td>
            <td colSpan={2} style={{ ...valueCell, lineHeight: 1.9 }}>
              PMW INDUSTRIES SDN BHD<br />
              PMW CONCRETE INDUSTRIES SDN BHD<br />
              PMW LIGHTING INDUSTRIES SDN BHD<br />
              WINABUMI SDN BHD
            </td>
          </tr>

          {/* Row 5 — Document No. + Version */}
          <tr>
            <td style={labelCell}>Document No.</td>
            <td style={{ ...valueCell, borderRight: `1px solid ${bdr}`, fontFamily: "monospace", width: "40%" }}>
              {formId}
            </td>
            <td style={{ padding: 0, verticalAlign: "middle" }}>
              <div style={{ display: "flex", height: "100%" }}>
                <div style={{ padding: "9px 12px", borderRight: `1px solid ${bdr}`, fontWeight: 600, background: cardAlt, color: txtMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                  Version
                </div>
                <div style={{ padding: "9px 12px", color: txt, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
                  {formVersion}
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── BackButton ────────────────────────────────────────────────────────────────
export function BackButton({ onClick, isDark }) {
  const { card, bdr } = useDarkTokens(isDark);
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: card, border: `1px solid ${bdr}`,
      borderRadius: 8, padding: "8px 16px", cursor: "pointer",
      marginBottom: 20, color: isDark ? D.accent : C.textSecond,
      fontSize: 13, fontFamily: "'DM Sans', sans-serif",
      boxShadow: C.shadow, transition: "border-color 0.15s, background 0.3s",
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back to Home
    </button>
  );
}

// ── StatusMessages ────────────────────────────────────────────────────────────
export function StatusMessages({ status }) {
  if (status === "loading") return (
    <div style={{ marginTop: 16, padding: "14px 18px", background: C.purplePale, border: `1px solid ${C.purpleMid}`, borderRadius: 10, color: C.purple, fontSize: 13, display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: 15, height: 15, border: `2px solid ${C.purpleMid}`, borderTop: `2px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
      Submitting your response, please wait…
    </div>
  );
  if (status === "error") return (
    <div style={{ marginTop: 16, padding: "14px 18px", background: C.redPale, border: "1px solid #FCA5A5", borderRadius: 10, color: C.red, fontSize: 13, display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Sans', sans-serif" }}>
      <span>❌</span> Something went wrong. Please try again or contact support.
    </div>
  );
  return null;
}

// ── Footer ────────────────────────────────────────────────────────────────────
export function FormFooter({ isDark }) {
  return (
    <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: isDark ? D.textMuted : C.textMuted, paddingBottom: 32, fontFamily: "'DM Sans', sans-serif" }}>
      PMW International Berhad · HR Forms · Confidential
    </div>
  );
}

export function useSurveyEvent(survey, event, handler) {
  React.useEffect(() => {
    if (!survey || !handler) return;
    event.add(handler);
    return () => event.remove(handler);
  }, [survey, event, handler]);
}

// ── SignatureDialog ───────────────────────────────────────────────────────────
export function SignatureDialog({ open, onConfirm, onCancel, existingData, title = "Signature" }) {
  const canvasRef = useRef(null);
  const padRef    = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width  = canvas.offsetWidth  * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d").scale(ratio, ratio);
      padRef.current = new SignaturePad(canvas, { penColor: C.purpleDark });
      if (existingData) { padRef.current.fromDataURL(existingData); setIsEmpty(false); }
      else setIsEmpty(true);
      padRef.current.addEventListener("endStroke", () => setIsEmpty(padRef.current.isEmpty()));
    }, 50);
    return () => { clearTimeout(timer); padRef.current?.off(); };
  }, [open, existingData]);

  const handleClear   = () => { padRef.current?.clear(); setIsEmpty(true); };
  const handleConfirm = () => { if (!padRef.current || padRef.current.isEmpty()) return; onConfirm(padRef.current.toDataURL()); };

  if (!open) return null;

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onCancel(); }} style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(30,27,75,0.5)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ background: C.white, borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, boxShadow: C.shadowLg, animation: "fadeUp 0.2s ease" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: C.textPrimary, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>Draw your signature below, then tap Confirm</div>
        </div>
        <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.offWhite, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: 32, left: 12, right: 12, borderBottom: `1px dashed ${C.purpleMid}`, pointerEvents: "none" }} />
          <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: 180, touchAction: "none", cursor: "crosshair" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
          <button onClick={handleClear} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textSecond, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Clear</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textSecond, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            <button onClick={handleConfirm} disabled={isEmpty} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: isEmpty ? C.border : C.purple, color: isEmpty ? C.textMuted : C.white, cursor: isEmpty ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s" }}>Confirm</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── SignatureTrigger ──────────────────────────────────────────────────────────
export function SignatureTrigger({ value, onChange, dialogTitle }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const handleConfirm = (dataUrl) => { onChange(dataUrl); setDialogOpen(false); };
  return (
    <>
      <div onClick={() => setDialogOpen(true)} style={{
        border: value ? `2px solid ${C.purple}` : `2px dashed ${C.border}`,
        borderRadius: 10, background: value ? C.purplePale : C.offWhite,
        minHeight: 110, maxWidth: 400,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: "pointer", position: "relative", overflow: "hidden", userSelect: "none",
        transition: "border-color 0.15s",
      }}>
        {value
          ? <img src={value} alt="Signature" style={{ maxWidth: "90%", maxHeight: 90, display: "block", pointerEvents: "none" }} />
          : <div style={{ textAlign: "center", color: C.textMuted, pointerEvents: "none" }}>
              <div style={{ fontSize: 24, marginTop: 3, marginBottom: 6 }}>✍️</div>
              <div style={{ fontSize: 11, marginTop: 3, color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>Tap Here</div>
              <div style={{ fontSize: 11, marginTop: 3, color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>Opens a signing dialog</div>
            </div>
        }
      </div>
      <SignatureDialog open={dialogOpen} onConfirm={handleConfirm} onCancel={() => setDialogOpen(false)} existingData={value} title={dialogTitle} />
    </>
  );
}

// ── SignatureQuestionWrapper — bridges SurveyJS question ↔ React ──────────────
export function SignatureQuestionWrapper({ question, dialogTitle }) {
  const [value, setValue] = useState(question.value);
  useEffect(() => {
    const handler = () => setValue(question.value);
    question.registerFunctionOnPropertyValueChanged("value", handler, "sig-bridge");
    return () => question.unRegisterFunctionOnPropertyValueChanged("value", "sig-bridge");
  }, [question]);
  const handleChange = (dataUrl) => { question.value = dataUrl; setValue(dataUrl); };
  return <SignatureTrigger value={value} onChange={handleChange} dialogTitle={dialogTitle} />;
}

// ── mountSignatureQuestion — call inside onAfterRenderQuestion ────────────────
//   Returns a cleanup function; push it into signatureRoots.current.
export function mountSignatureQuestion(options, signatureRoots, dialogTitle) {
  const question   = options.question;
  if (question.getType() !== "signaturepad") return;
  const questionEl = options.htmlElement;
  if (!questionEl) return;

  // ── Hide ALL native SurveyJS signature content aggressively ──────────────
  const nativeSelectors = [
    ".sv-signature",
    ".sv-signature-pad",
    ".sjs-cb-wrapper",
    ".sd-signaturepad",
    "canvas",
    ".sv_q_signaturepad",
    'button[data-bind]',
    ".sv-signature__clear-button",
    ".sv-signature__placeholder",
  ];
  nativeSelectors.forEach(sel => {
    questionEl.querySelectorAll(sel).forEach(el => {
      el.style.display = "none";
    });
  });

  // Also hide direct children of the question content area
  const contentRoot = questionEl.querySelector(".sd-question__content") || questionEl;
  Array.from(contentRoot.children).forEach(child => {
    if (!child.classList.contains("sig-dialog-mount")) {
      child.style.display = "none";
    }
  });

  // ── Mount our custom trigger ──────────────────────────────────────────────
  const container = document.createElement("div");
  container.className = "sig-dialog-mount";
  contentRoot.appendChild(container);

  import("react-dom/client").then(({ createRoot }) => {
    const root = createRoot(container);
    root.render(<SignatureQuestionWrapper question={question} dialogTitle={dialogTitle} />);
    signatureRoots.current.push({ container, root });
  }).catch(() => {
    import("react-dom").then(ReactDOM => {
      ReactDOM.render(<SignatureQuestionWrapper question={question} dialogTitle={dialogTitle} />, container);
      signatureRoots.current.push({ container });
    });
  });
}

// ── useSignatureCleanup — unmounts all mounted signature roots on page leave ──
export function useSignatureCleanup(signatureRoots) {
  useEffect(() => {
    return () => {
      signatureRoots.current.forEach(({ root, container }) => {
        try { root?.unmount(); } catch {}
        try { container?.remove(); } catch {}
      });
    };
  }, []);
}