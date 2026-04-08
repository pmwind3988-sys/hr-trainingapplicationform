import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { LayeredDarkPanelless, LayeredLightPanelless } from "survey-core/themes";
import SignaturePad from "signature_pad";
import logo from "../assets/logo.png";
import "survey-core/survey-core.min.css";
import SuccessScreen from "../utils/successScreen";

const FORM_VERSION = "1.0";
const FORM_ID = "2";

// ── Design tokens (shared with Form 1) ───────────────────────────────────────
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
  shadow: "0 1px 3px rgba(91,33,182,0.08), 0 4px 16px rgba(91,33,182,0.06)",
  shadowMd: "0 4px 24px rgba(91,33,182,0.12), 0 1px 4px rgba(91,33,182,0.06)",
  shadowLg: "0 8px 40px rgba(91,33,182,0.16)",
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// ── Dark theme helpers ────────────────────────────────────────────────────────
const D = {
  bg: "#0f0f1a",
  card: "#1a1a2e",
  cardAlt: "#13132a",
  border: "#2d2d4e",
  text: "#e0d7ff",
  textMuted: "#6b6b8a",
  accent: "#a78bfa",
};

// ── Page header ───────────────────────────────────────────────────────────────
function PageHeader({ isDark, onToggleDark }) {
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
      {/* Left — logo mark + title */}
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
        <span style={{
          fontFamily: "'DM Serif Display', serif", fontSize: 17,
          color: isDark ? D.text : C.textPrimary, letterSpacing: "-0.01em",
          transition: "color 0.3s",
        }}>
          Training Needs Analysis Form
        </span>
      </div>

      {/* Right — dark toggle + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>{isDark ? "🌙" : "☀️"}</span>
          <div
            onClick={onToggleDark}
            role="switch"
            aria-checked={isDark}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: "pointer",
              background: isDark ? C.purple : C.border,
              position: "relative", transition: "background 0.25s", flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", top: 3,
              left: isDark ? 23 : 3,
              width: 18, height: 18, borderRadius: "50%",
              background: C.white, transition: "left 0.25s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
            }} />
          </div>
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

// ── Signature Dialog ──────────────────────────────────────────────────────────
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

  const handleClear = () => { padRef.current?.clear(); setIsEmpty(true); };
  const handleConfirm = () => { if (!padRef.current || padRef.current.isEmpty()) return; onConfirm(padRef.current.toDataURL()); };

  if (!open) return null;

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onCancel(); }} style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(30,27,75,0.5)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 16, padding: 28,
        width: "100%", maxWidth: 500, boxShadow: C.shadowLg,
        animation: "fadeUp 0.2s ease",
      }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: C.textPrimary, marginBottom: 4 }}>
            HOD Signature
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
            Draw your signature below, then tap Confirm
          </div>
        </div>

        <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.offWhite, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: 32, left: 12, right: 12, borderBottom: `1px dashed ${C.purpleMid}`, pointerEvents: "none" }} />
          <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: 180, touchAction: "none", cursor: "crosshair" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
          <button onClick={handleClear} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textSecond, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            Clear
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.textSecond, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={isEmpty} style={{
              padding: "9px 20px", borderRadius: 8, border: "none",
              background: isEmpty ? C.border : C.purple,
              color: isEmpty ? C.textMuted : C.white,
              cursor: isEmpty ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.15s",
            }}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Signature Trigger ─────────────────────────────────────────────────────────
function SignatureTrigger({ value, onChange }) {
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
        {value ? (
          <img src={value} alt="Signature" style={{ maxWidth: "90%", maxHeight: 90, display: "block", pointerEvents: "none" }} />
        ) : (
          <div style={{ textAlign: "center", color: C.textMuted, pointerEvents: "none" }}>
            <div style={{ fontSize: 24, marginTop: 60, marginBottom: 6 }}>✍️</div>
            <div style={{ fontSize: 11, marginTop: 3, color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>Opens a signing dialog</div>
          </div>
        )}
      </div>
      <SignatureDialog open={dialogOpen} onConfirm={handleConfirm} onCancel={() => setDialogOpen(false)} existingData={value} />
    </>
  );
}

// ── SurveyJS bridge ───────────────────────────────────────────────────────────
function SignatureQuestionWrapper({ question }) {
  const [value, setValue] = useState(question.value);

  useEffect(() => {
    const handler = () => setValue(question.value);
    question.registerFunctionOnPropertyValueChanged("value", handler, "sig-bridge");
    return () => question.unRegisterFunctionOnPropertyValueChanged("value", "sig-bridge");
  }, [question]);

  const handleChange = (dataUrl) => { question.value = dataUrl; setValue(dataUrl); };

  return <SignatureTrigger value={value} onChange={handleChange} />;
}

// ── Survey JSON ───────────────────────────────────────────────────────────────
const surveyJson = {
  checkErrorsMode: "onValueChanged",
  textUpdateMode: "onTyping",
  title: "[HR] Training Needs Analysis Form",
  pages: [
    {
      name: "page1",
      elements: [
        {
          type: "dropdown", name: "department", title: "Department", isRequired: true,
          choices: ["HR", "Finance", "IT", "Logistics", "Accounting"]
        },
        {
          type: "text",
          name: "year",
          title: "Year",
          defaultValue: new Date().getFullYear(),
          readOnly: true
        },
        {
          type: "matrixdynamic",
          name: "training_needs_employee",
          title: "Details",
          titleLocation: "hidden",
          addRowText: "Add Row",
          showIndexColumn: true,
          indexColumnHeader: "No.",
          columns: [
            { name: "employee_no", title: "Emp. ID", cellType: "text", isRequired: true },
            { name: "trainee_name", title: "Name", cellType: "text", isRequired: true },
            { name: "training_needs", title: "Training Needs", cellType: "comment", isRequired: true },
            { name: "current_skill_level", title: "Current Skill Level", cellType: "checkbox", choices: ["Low", "Medium", "High"], maxSelectedChoices: 1, minSelectedChoices: 1 },
            { name: "required_skill_level", title: "Required Skill Level", cellType: "checkbox", choices: ["Low", "Medium", "High"], maxSelectedChoices: 1, minSelectedChoices: 1 },
            { name: "priority", title: "Priority", cellType: "checkbox", choices: ["Low", "Medium", "High"], maxSelectedChoices: 1, minSelectedChoices: 1 },
            { name: "relevance_to_job_function", title: "Please state relevancy to the job function", cellType: "comment", isRequired: false },
            { name: "tentative_schedule", title: "Tentative Schedule", cellType: "comment", isRequired: false },
          ],
          rowCount: 1,
          minRowCount: 1,
        },
        {
          type: "panel", name: "approval_section",
          elements: [
            { type: "text", name: "hod_name", title: "Name of HOD", isRequired: true, startWithNewLine: false },
            { type: "text", name: "hod_designation", title: "Designation", isRequired: true, startWithNewLine: false },
            {
              type: "text",
              inputType: "date",
              name: "hod_date",
              title: "Date",
              isRequired: true,
              startWithNewLine: false,
              defaultValueExpression: "today()"
            },
            { type: "signaturepad", name: "hod_signature", title: "Signature", isRequired: true, signatureWidth: 400, signatureHeight: 200, penColor: "#000000" },
          ]
        }
      ]
    }
  ]
};

// ── FormPage ──────────────────────────────────────────────────────────────────
function FormPage() {
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const signatureRoots = useRef([]);
  const navigate = useNavigate();

  const survey = useMemo(() => new Model(surveyJson), []);

  useEffect(() => {
    survey.applyTheme(isDark ? LayeredDarkPanelless : LayeredLightPanelless);
  }, [isDark, survey]);

  const onAfterRenderQuestion = useCallback((_, options) => {
    const question = options.question;
    if (question.getType() !== "signaturepad") return;
    const questionEl = options.htmlElement;
    if (!questionEl) return;
    const nativeArea = questionEl.querySelector(".sv-signature, .sjs-cb-wrapper, canvas");
    const contentRoot = nativeArea?.parentElement || questionEl.querySelector(".sd-question__content") || questionEl;
    const container = document.createElement("div");
    container.className = "sig-dialog-mount";
    if (contentRoot) {
      Array.from(contentRoot.children).forEach(child => { child.style.display = "none"; });
      contentRoot.appendChild(container);
    } else {
      questionEl.appendChild(container);
    }
    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(<SignatureQuestionWrapper question={question} />);
      signatureRoots.current.push({ container, root, question });
    }).catch(() => {
      import("react-dom").then(ReactDOM => {
        ReactDOM.render(<SignatureQuestionWrapper question={question} />, container);
        signatureRoots.current.push({ container, question });
      });
    });
  }, []);

  survey.onValueChanged.add(function (sender, options) {
    if (options.name === "hod_name" && options.value) {
      const formatted = options.value
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

      if (formatted !== options.value) {
        sender.setValue("hod_name", formatted);
      }
    }
  });

  survey.onValueChanged.add(function (sender, options) {
    if (options.name === "hod_name" && options.value) {
      const formatted = options.value
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

      if (formatted !== options.value) {
        sender.setValue("hod_name", formatted);
      }
    }
  });

  survey.onAfterRenderQuestion.add(onAfterRenderQuestion);
  survey.showCompletedPage = false;

  useEffect(() => {
    return () => {
      signatureRoots.current.forEach(({ root, container }) => {
        try { root?.unmount(); } catch { }
        try { container?.remove(); } catch { }
      });
    };
  }, []);

  const onComplete = useCallback(async (sender) => {
    const payload = {
      ...sender.data,
      formId: FORM_ID, formVersion: FORM_VERSION,
      submittedAt: new Date().toISOString(),
      baseUrl: window.location.origin,
    };
    setSubmitStatus("loading");
    try {
      const response = await fetch(process.env.REACT_APP_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSubmitStatus(response.ok ? "success" : "error");
    } catch {
      setSubmitStatus("error");
    }
  }, []);

  survey.onComplete.add(onComplete);

  // Dynamic dark helpers
  const bg = isDark ? D.bg : C.offWhite;
  const card = isDark ? D.card : C.white;
  const cardAlt = isDark ? D.cardAlt : C.offWhite;
  const bdr = isDark ? D.border : C.border;
  const txt = isDark ? D.text : C.textPrimary;
  const txtMuted = isDark ? D.accent : C.textSecond;

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.3s" }}>
      <style>{globalStyles}</style>
      <PageHeader isDark={isDark} onToggleDark={() => setIsDark(d => !d)} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>

        {/* Back button */}
        <button onClick={() => navigate("/")} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: card, border: `1px solid ${bdr}`,
          borderRadius: 8, padding: "8px 16px", cursor: "pointer",
          marginBottom: 20, color: isDark ? D.accent : C.textSecond,
          fontSize: 13, fontFamily: "'DM Sans', sans-serif",
          boxShadow: C.shadow, transition: "border-color 0.15s, background 0.3s",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Home
        </button>

        {/* ── Document Header card ──────────────────────────────────── */}
        <div style={{
          background: card, borderRadius: 12, border: `1px solid ${bdr}`,
          overflow: "hidden", marginBottom: 20, boxShadow: C.shadow,
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
                Training Needs Analysis Form
              </div>
            </div>
            <span style={{ fontSize: 11, color: C.purpleMid, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)", fontFamily: "'DM Sans', sans-serif" }}>
              v{FORM_VERSION}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {/* Row 1 — logo + company name (full width right cell) */}
              <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                {/* Logo — rowSpan 3 to cover: company row + document title + form title */}
                <td
                  rowSpan={1}
                  style={{
                    width: 160, minWidth: 160,
                    borderRight: `1px solid ${bdr}`,
                    background: cardAlt,
                    padding: "14px 20px",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  <img src={logo} alt="Company Logo" style={{ maxHeight: 40, objectFit: "contain" }} />
                </td>
                {/* Company name spans the two right columns */}
                <td
                  colSpan={2}
                  style={{
                    padding: "14px 20px",
                    fontWeight: 700, fontSize: 15,
                    color: txt,
                    letterSpacing: "0.5px",
                    fontFamily: "'DM Sans', sans-serif",
                    verticalAlign: "middle",
                  }}
                >
                  PMW INTERNATIONAL BERHAD
                </td>
              </tr>

              {/* Row 2 — Document Title */}
              <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                <td style={{
                  width: 160, minWidth: 160,
                  borderRight: `1px solid ${bdr}`,
                  background: cardAlt,
                  padding: "9px 14px",
                  fontWeight: 600, fontSize: 11,
                  color: txtMuted,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontFamily: "'DM Sans', sans-serif",
                  verticalAlign: "middle",
                }}>
                  Document Title
                </td>
                <td style={{
                  padding: "9px 14px",
                  color: txt, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  verticalAlign: "middle",
                }}>
                  ISO 9001, ISO 14001 &amp; ISO 45001
                </td>
              </tr>

              {/* Row 3 — Form Title */}
              <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                <td style={{
                  borderRight: `1px solid ${bdr}`,
                  background: cardAlt,
                  padding: "9px 14px",
                  fontWeight: 600, fontSize: 11,
                  color: txtMuted,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontFamily: "'DM Sans', sans-serif",
                  verticalAlign: "middle",
                }}>
                  Form Title
                </td>
                <td style={{
                  padding: "9px 14px",
                  color: txt, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  verticalAlign: "middle",
                }}>
                  TRAINING NEEDS ANALYSIS FORM
                </td>
              </tr>

              {/* Companies row */}
              <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                <td style={{
                  width: 160, minWidth: 160,
                  borderRight: `1px solid ${bdr}`,
                  background: cardAlt,
                  padding: "9px 14px",
                  fontWeight: 600, fontSize: 11,
                  color: txtMuted,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontFamily: "'DM Sans', sans-serif",
                  verticalAlign: "middle",
                }}>
                  Companies
                </td>
                <td
                  colSpan={2}
                  style={{
                    padding: "10px 14px",
                    color: txt, fontSize: 13,
                    lineHeight: 1.9,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  PMW INDUSTRIES SDN BHD<br />
                  PMW CONCRETE INDUSTRIES SDN BHD<br />
                  PMW LIGHTING INDUSTRIES SDN BHD<br />
                  WINABUMI SDN BHD
                </td>
              </tr>

              {/* Document No / Version row */}
              <tr>
                <td style={{
                  width: 160, minWidth: 160,
                  borderRight: `1px solid ${bdr}`,
                  background: cardAlt,
                  padding: "9px 14px",
                  fontWeight: 600, fontSize: 11,
                  color: txtMuted,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontFamily: "'DM Sans', sans-serif",
                  verticalAlign: "middle",
                }}>
                  Document No.
                </td>
                <td style={{
                  borderRight: `1px solid ${bdr}`,
                  padding: "9px 12px",
                  fontFamily: "monospace", fontSize: 13,
                  color: txt, verticalAlign: "middle",
                  width: "40%",
                }}>
                  {FORM_ID}
                </td>
                <td style={{ padding: 0, verticalAlign: "middle" }}>
                  <div style={{ display: "flex", height: "100%" }}>
                    <div style={{
                      padding: "9px 12px",
                      borderRight: `1px solid ${bdr}`,
                      fontWeight: 600, background: cardAlt,
                      color: txtMuted, fontSize: 11,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      display: "flex", alignItems: "center",
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: "nowrap",
                    }}>
                      Version
                    </div>
                    <div style={{
                      padding: "9px 12px",
                      textAlign: "center",
                      color: txt, fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {FORM_VERSION}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Survey / Success ──────────────────────────────────────── */}
        {submitStatus === "success" ? (
          <SuccessScreen onBack={() => navigate("/")} />
        ) : (
          <Survey model={survey} />
        )}

        {/* ── Status messages ───────────────────────────────────────── */}
        {submitStatus === "loading" && (
          <div style={{
            marginTop: 16, padding: "14px 18px",
            background: C.purplePale, border: `1px solid ${C.purpleMid}`,
            borderRadius: 10, color: C.purple, fontSize: 13,
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{ width: 15, height: 15, border: `2px solid ${C.purpleMid}`, borderTop: `2px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
            Submitting your response, please wait…
          </div>
        )}
        {submitStatus === "error" && (
          <div style={{
            marginTop: 16, padding: "14px 18px",
            background: C.redPale, border: "1px solid #FCA5A5",
            borderRadius: 10, color: C.red, fontSize: 13,
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <span>❌</span> Something went wrong. Please try again or contact support.
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: isDark ? D.textMuted : C.textMuted, paddingBottom: 32, fontFamily: "'DM Sans', sans-serif" }}>
          PMW International Berhad · HR Forms · Confidential
        </div>
      </div>
    </div>
  );
}

export default FormPage;