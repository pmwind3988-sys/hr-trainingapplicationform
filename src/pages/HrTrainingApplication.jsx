import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import SignaturePad from "signature_pad";
import "survey-core/survey-core.min.css";

const FORM_VERSION = "1.0";
const FORM_ID = "1";

// ─── Signature Dialog (rendered via portal into document.body) ────────────────
function SignatureDialog({ open, onConfirm, onCancel, existingData }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    // Wait one tick for the dialog to mount and canvas to be in DOM
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d").scale(ratio, ratio);

      padRef.current = new SignaturePad(canvas, { penColor: "#000000" });

      if (existingData) {
        padRef.current.fromDataURL(existingData);
        setIsEmpty(false);
      } else {
        setIsEmpty(true);
      }

      padRef.current.addEventListener("endStroke", () => {
        setIsEmpty(padRef.current.isEmpty());
      });
    }, 50);

    return () => {
      clearTimeout(timer);
      padRef.current?.off();
    };
  }, [open, existingData]);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    onConfirm(padRef.current.toDataURL());
  };

  if (!open) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px"
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "12px",
        padding: "24px", width: "100%", maxWidth: "500px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)"
      }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
            Applicant Signature
          </div>
          <div style={{ fontSize: "13px", color: "#666" }}>
            Draw your signature below, then tap Confirm
          </div>
        </div>

        {/* Canvas area */}
        <div style={{
          border: "1.5px solid #d0d0d0", borderRadius: "8px",
          background: "#fafafa", position: "relative", overflow: "hidden"
        }}>
          {/* Baseline guide line */}
          <div style={{
            position: "absolute", bottom: "36px", left: "12px", right: "12px",
            borderBottom: "1px dashed #e0e0e0", pointerEvents: "none"
          }} />
          <canvas
            ref={canvasRef}
            style={{
              display: "block", width: "100%", height: "180px",
              touchAction: "none", cursor: "crosshair"
            }}
          />
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: "16px", gap: "8px"
        }}>
          <button
            onClick={handleClear}
            style={{
              padding: "8px 16px", borderRadius: "6px",
              border: "1px solid #ccc", background: "#fff",
              color: "#555", cursor: "pointer", fontSize: "13px"
            }}
          >
            Clear
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onCancel}
              style={{
                padding: "8px 16px", borderRadius: "6px",
                border: "1px solid #ccc", background: "#fff",
                color: "#555", cursor: "pointer", fontSize: "13px"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isEmpty}
              style={{
                padding: "8px 20px", borderRadius: "6px",
                border: "none",
                background: isEmpty ? "#b0bec5" : "#1e3a5f",
                color: "#fff",
                cursor: isEmpty ? "not-allowed" : "pointer",
                fontSize: "13px", fontWeight: 500
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Signature Trigger Box ────────────────────────────────────────────────────
function SignatureTrigger({ value, onChange }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleConfirm = (dataUrl) => {
    onChange(dataUrl);
    setDialogOpen(false);
  };

  return (
    <>
      <div
        onClick={() => setDialogOpen(true)}
        style={{
          border: value ? "2px solid #1e3a5f" : "2px dashed #bbb",
          borderRadius: "8px",
          background: value ? "#f0f5fa" : "#fafafa",
          minHeight: "110px",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          userSelect: "none"
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Signature"
              style={{ maxWidth: "90%", maxHeight: "90px", display: "block", pointerEvents: "none" }}
            />
            {/* 
            <div style={{
              position: "absolute", top: "8px", right: "8px",
              background: "#1e3a5f", color: "#fff",
              borderRadius: "4px", padding: "3px 10px",
              fontSize: "11px", fontWeight: 500
            }}>
              Tap to edit
            </div>
            }
            <button
              onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
              style={{
                position: "absolute", top: "8px", left: "8px",
                background: "rgba(255,255,255,0.9)", border: "1px solid #ddd",
                borderRadius: "4px", padding: "3px 10px",
                fontSize: "11px", cursor: "pointer", color: "#c0392b"
              }}
            >
              Remove
            </button> */}
          </>
        ) : (
          <div style={{ textAlign: "center", color: "#999", pointerEvents: "none" }}>
            {/* <div style={{ fontSize: "28px", marginBottom: "8px" }}>✍️</div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#555" }}>Tap to sign</div>
            <div style={{ fontSize: "12px", marginTop: "4px", color: "#aaa" }}>
              Opens a signing dialog
            </div> */}
          </div>
        )}
      </div>

      <SignatureDialog
        open={dialogOpen}
        onConfirm={handleConfirm}
        onCancel={() => setDialogOpen(false)}
        existingData={value}
      />
    </>
  );
}

// ─── Wrapper that bridges SurveyJS question state → React component ───────────
function SignatureQuestionWrapper({ question }) {
  const [value, setValue] = useState(question.value);

  useEffect(() => {
    const handler = () => setValue(question.value);
    question.registerFunctionOnPropertyValueChanged("value", handler, "sig-bridge");
    return () => question.unRegisterFunctionOnPropertyValueChanged("value", "sig-bridge");
  }, [question]);

  const handleChange = (dataUrl) => {
    question.value = dataUrl;
    setValue(dataUrl);
  };

  return <SignatureTrigger value={value} onChange={handleChange} />;
}

// ─── Survey JSON — signaturepad type kept, we replace its render ──────────────
const surveyJson = {
  checkErrorsMode: "onValueChanged",
  textUpdateMode: "onTyping",
  title: "HR Training Application Form",
  pages: [
    {
      name: "page1",
      elements: [
        {
          type: "panel",
          name: "employeeDetails",
          state: "expanded",
          title: "1. Employee Details",
          elements: [
            { type: "text", name: "employeeName", title: "Employee Name", isRequired: true },
            { type: "text", name: "position", title: "Position", isRequired: true },
            {
              type: "dropdown", name: "department", title: "Department", isRequired: true,
              choices: ["HR", "Finance", "IT", "Logistics", "Accounting"]
            },
            { type: "text", name: "reportingManager", title: "Reporting Manager", isRequired: true }
          ]
        },
        {
          type: "panel", name: "Training Details", state: "collapsed", title: "2. Training Details",
          elements: [
            { type: "text", name: "courseName", title: "Course Name", isRequired: true },
            { type: "comment", name: "trainingObjective", title: "Training Objective", isRequired: true },
            { type: "text", name: "trainingProvider", title: "Training Provider", isRequired: true },
            { type: "comment", name: "venue", title: "Venue", isRequired: true },
            {
              type: "text", inputType: "datetime-local", name: "startDate", min: "today",
              title: "Start Date/Time", isRequired: true,
              validators: [{ type: "expression", expression: "{startDate} > today()", text: "Date Invalid" }]
            },
            {
              type: "text", inputType: "datetime-local", name: "endDate", min: "today",
              title: "End Date/Time", isRequired: true,
              validators: [{ type: "expression", expression: "{endDate} > today()", text: "Date Invalid" }]
            }
          ]
        },
        {
          type: "panel", name: "cost", state: "expanded", title: "3. Cost",
          elements: [
            {
              type: "multipletext", name: "cost_details", titleLocation: "hidden", colCount: 1,
              items: [
                { name: "training_fee", title: "Training Fee (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
                { name: "mileage", title: "Travelling Cost: Mileage (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
                { name: "meal_allowance", title: "Travelling Cost: Meals Allowance (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
                { name: "accommodation", title: "Accommodation (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
                { name: "other_cost", title: "Other Cost (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] }
              ]
            },
            {
              type: "expression", name: "total_cost", title: "Total Cost (RM)",
              expression: "({cost_details.training_fee} || 0) + ({cost_details.mileage} || 0) + ({cost_details.meal_allowance} || 0) + ({cost_details.accommodation} || 0) + ({cost_details.other_cost} || 0)",
              displayStyle: "currency", currency: "MYR"
            }
          ]
        },
        {
          type: "radiogroup", name: "hrdc_application", title: "HRDC Application?",
          choices: [{ value: "true", text: "Yes" }, { value: "false", text: "No" }],
          colCount: 0, isRequired: true
        },
        {
          type: "panel", name: "approval_section", title: "Approved By",
          elements: [
            {
              type: "signaturepad",
              name: "applicant_signature",
              title: "Applicant Signature",
              isRequired: true,
              signatureWidth: 400,
              signatureHeight: 200,
              penColor: "#000000"
            },
            {
              type: "text", name: "applicant_name", title: "Full Name",
              isRequired: true, startWithNewLine: false
            }
          ]
        }
      ]
    }
  ]
};

// ─── FormPage ─────────────────────────────────────────────────────────────────
function FormPage() {
  const [submitStatus, setSubmitStatus] = useState(null);
  // Track mounted signature wrappers: { container, root, question }
  const signatureRoots = useRef([]);
  const navigate = useNavigate();

  const survey = useMemo(() => new Model(surveyJson), []);

  // After each question renders, intercept signaturepad questions
  const onAfterRenderQuestion = useCallback((_, options) => {
    const question = options.question;
    if (question.getType() !== "signaturepad") return;

    const questionEl = options.htmlElement;
    if (!questionEl) return;

    // Find and hide the native signature pad content area
    // SurveyJS renders a canvas inside a div with class sv-signature
    const nativeArea = questionEl.querySelector(".sv-signature, .sjs-cb-wrapper, canvas");
    const contentRoot = nativeArea?.parentElement || questionEl.querySelector(".sd-question__content") || questionEl;

    // Create a container div to mount React into
    const container = document.createElement("div");
    container.className = "sig-dialog-mount";

    // Hide all existing children of the content area
    if (contentRoot) {
      Array.from(contentRoot.children).forEach(child => {
        child.style.display = "none";
      });
      contentRoot.appendChild(container);
    } else {
      questionEl.appendChild(container);
    }

    // Use React 18 createRoot or fall back to ReactDOM.render
    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(<SignatureQuestionWrapper question={question} />);
      signatureRoots.current.push({ container, root, question });
    }).catch(() => {
      // React 17 fallback
      import("react-dom").then(ReactDOM => {
        ReactDOM.render(<SignatureQuestionWrapper question={question} />, container);
        signatureRoots.current.push({ container, question });
      });
    });
  }, []);

  survey.onAfterRenderQuestion.add(onAfterRenderQuestion);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      signatureRoots.current.forEach(({ root, container }) => {
        try { root?.unmount(); } catch {}
        try { container?.remove(); } catch {}
      });
    };
  }, []);

  const onComplete = useCallback(async (sender) => {
    const payload = {
      ...sender.data,
      formId: FORM_ID,
      formVersion: FORM_VERSION,
      submittedAt: new Date().toISOString(),
      baseUrl: window.location.origin,
    };
    setSubmitStatus("loading");
    try {
      const response = await fetch(process.env.REACT_APP_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setSubmitStatus(response.ok ? "success" : "error");
    } catch {
      setSubmitStatus("error");
    }
  }, []);

  survey.onComplete.add(onComplete);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <button
        onClick={() => navigate("/")}
        style={{
          background: "none", border: "1px solid #ccc", borderRadius: "6px",
          padding: "8px 16px", cursor: "pointer", marginBottom: "16px",
          color: "#555", fontSize: "14px"
        }}
      >
        ← Back to Home
      </button>

      <div style={{
        display: "flex", justifyContent: "flex-end", alignItems: "center",
        padding: "14px 18px",
        background: "linear-gradient(135deg, #1e3a5f, #16324f)",
        borderRadius: "12px", marginBottom: "18px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 13, color: "#9fc7f0", textAlign: "right" }}>
            Form ID
            <div style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 15, marginTop: 2 }}>
              {FORM_ID}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)" }} />
          <div style={{
            fontSize: 12, color: "#cfe6ff", background: "rgba(255,255,255,0.08)",
            borderRadius: "999px", padding: "5px 14px", fontWeight: 500,
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            Version {FORM_VERSION}
          </div>
        </div>
      </div>

      <Survey model={survey} />

      {submitStatus === "loading" && (
        <div style={{ marginTop: 20, padding: 16, backgroundColor: "#e8f4fd", border: "1px solid #b3d9f7", borderRadius: 8, color: "#1a6fa8", textAlign: "center" }}>
          ⏳ Submitting your response, please wait...
        </div>
      )}
      {submitStatus === "success" && (
        <div style={{ marginTop: 20, padding: 16, backgroundColor: "#e6f4ea", border: "1px solid #a8d5b0", borderRadius: 8, color: "#2d6a3f", textAlign: "center" }}>
          ✅ Your response has been submitted successfully!
        </div>
      )}
      {submitStatus === "error" && (
        <div style={{ marginTop: 20, padding: 16, backgroundColor: "#fdecea", border: "1px solid #f5b7b1", borderRadius: 8, color: "#a93226", textAlign: "center" }}>
          ❌ Something went wrong. Please try again or contact support.
        </div>
      )}
    </div>
  );
}

export default FormPage;