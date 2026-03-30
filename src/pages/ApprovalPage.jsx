import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useMsal, useIsAuthenticated, useMsalAuthentication } from "@azure/msal-react";
import { InteractionType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import SignaturePad from "signature_pad";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", ...style,
    }} />
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
      <div><Skeleton width={80} height={11} style={{ marginBottom: 6 }} /><Skeleton height={36} /></div>
      <div><Skeleton width={80} height={11} style={{ marginBottom: 6 }} /><Skeleton height={36} /></div>
    </div>
  );
}

function PageSkeleton({ userEmail }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ background: "#e8f4fd", border: "1px solid #b3d9f7", borderRadius: 8, padding: "12px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 16, height: 16, border: "2px solid #b3d9f7", borderTop: "2px solid #1a6fa8", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: "#1a6fa8" }}>Signed in as <strong>{userEmail}</strong> — Loading application data...</span>
      </div>
      <Skeleton width={200} height={20} style={{ marginBottom: 24 }} />
      <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
      <hr style={{ margin: "28px 0", borderColor: "#e0e0e0" }} />
      <Skeleton width={140} height={16} style={{ marginBottom: 16 }} />
      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "18px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><Skeleton width={140} height={14} /><Skeleton width={80} height={22} radius={20} /></div>
        <div style={{ display: "flex", gap: 32 }}>
          <div style={{ flex: 1 }}><Skeleton width={60} height={11} style={{ marginBottom: 6 }} /><Skeleton height={14} /></div>
          <div style={{ flex: 1 }}><Skeleton width={70} height={11} style={{ marginBottom: 6 }} /><Skeleton height={14} /></div>
        </div>
      </div>
    </div>
  );
}

function LoginWaitScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f8fa", padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ width: 44, height: 44, border: "3px solid #e0e0e0", borderTop: "3px solid #1a6fa8", borderRadius: "50%", animation: "spin 0.9s linear infinite", marginBottom: 24 }} />
      <h2 style={{ color: "#1a3c5e", fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Signing you in...</h2>
      <p style={{ color: "#888", fontSize: 14 }}>Redirecting to Microsoft 365. Please wait.</p>
    </div>
  );
}

// ── Full-page screens ─────────────────────────────────────────────────────────

function Screen({ icon, title, message, color = "#555", children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#f7f8fa" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "44px 40px", textAlign: "center", maxWidth: 440, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        {icon && <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>}
        {title && <h2 style={{ color, marginBottom: 10, fontSize: 20, fontWeight: 500 }}>{title}</h2>}
        <p style={{ color: "#666", lineHeight: 1.6, marginBottom: children ? 20 : 0 }}>{message}</p>
        {children}
      </div>
    </div>
  );
}

function DetailCard({ items }) {
  return (
    <div style={{ background: "#f7f8fa", border: "1px solid #e0e0e0", borderRadius: 10, padding: "18px 20px", textAlign: "left", marginTop: 20 }}>
      {items.map(({ label, value }, i) => (
        <div key={i} style={{ marginBottom: i < items.length - 1 ? 14 : 0 }}>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
          <div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function SuccessPage({ userEmail, layer, signedAt, action }) {
  const approved = action !== "rejected";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8fa", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "44px 40px", textAlign: "center", maxWidth: 460, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{approved ? "✅" : "❎"}</div>
        <h2 style={{ color: approved ? "#2d6a3f" : "#a93226", fontWeight: 500, fontSize: 20, marginBottom: 8 }}>
          {approved ? "Approval Submitted" : "Application Rejected"}
        </h2>
        <p style={{ color: "#666", marginBottom: 4, lineHeight: 1.6 }}>Your Layer {layer} {approved ? "approval" : "rejection"} has been recorded.</p>
        <DetailCard items={[
          { label: approved ? "Approved by" : "Rejected by", value: userEmail },
          { label: "Approval layer", value: `Layer ${layer}` },
          { label: "Date / Time",    value: new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) },
        ]} />
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 20 }}>You may close this window.</p>
      </div>
    </div>
  );
}

function AlreadySignedPage({ userEmail, layer, signedAt, action }) {
  const approved = action !== "Rejected";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8fa", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "44px 40px", textAlign: "center", maxWidth: 460, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <h2 style={{ color: "#1a6fa8", fontWeight: 500, fontSize: 20, marginBottom: 8 }}>Already {approved ? "Approved" : "Rejected"}</h2>
        <p style={{ color: "#666", marginBottom: 4, lineHeight: 1.6 }}>You have already submitted your Layer {layer} {approved ? "approval" : "rejection"}. This link is now locked.</p>
        <DetailCard items={[
          { label: approved ? "Approved by" : "Rejected by", value: userEmail },
          { label: "Layer",     value: `Layer ${layer}` },
          { label: "Signed at", value: signedAt ? new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—" },
        ]} />
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 20 }}>You may close this window.</p>
      </div>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ type, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");
  const isReject = type === "reject";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20,
    }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "32px 28px", maxWidth: 460, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.2)" }}>

        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: isReject ? "#fdecea" : "#e6f4ea",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            {isReject ? "✕" : "✓"}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: isReject ? "#a93226" : "#2d6a3f" }}>
              {isReject ? "Reject Application" : "Approve Application"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
              {isReject ? "This action cannot be undone." : "Please confirm your approval below."}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ background: "#f7f8fa", borderRadius: 8, padding: "14px 16px", marginBottom: 20, fontSize: 14, color: "#555", lineHeight: 1.6 }}>
          {isReject
            ? "Rejecting this application will notify the applicant and stop the approval process. Please provide a reason below."
            : "By approving, you confirm that you have reviewed this training application and agree to proceed."
          }
        </div>

        {/* Rejection reason input */}
        {isReject && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 6, fontWeight: 500 }}>
              Rejection reason <span style={{ color: "#a93226" }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${reason.trim() ? "#e0e0e0" : "#f5b7b1"}`,
                fontSize: 14, color: "#333", resize: "vertical",
                fontFamily: "inherit", boxSizing: "border-box", outline: "none",
              }}
            />
          </div>
        )}

        {/* Approve — signature reminder */}
        {!isReject && (
          <div style={{ marginBottom: 20, padding: "10px 14px", background: "#e6f4ea", borderRadius: 8, fontSize: 13, color: "#2d6a3f" }}>
            Your signature in the approval box will serve as your digital authorization.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", color: "#555", fontSize: 14, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading || (isReject && !reason.trim())}
            style={{
              padding: "10px 22px", borderRadius: 8, border: "none",
              background: isReject
                ? (reason.trim() ? "#a93226" : "#e0e0e0")
                : "#1a6fa8",
              color: (isReject && !reason.trim()) ? "#aaa" : "#fff",
              fontSize: 14, fontWeight: 500,
              cursor: (loading || (isReject && !reason.trim())) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {loading && (
              <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            )}
            {loading ? "Submitting..." : isReject ? "Confirm Rejection" : "Confirm Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 2-column read-only form ───────────────────────────────────────────────────

function Field({ label, value, full = false }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined, marginBottom: 4 }}>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{
        padding: "9px 13px", background: "#f7f8fa",
        borderRadius: 6, border: "1px solid #eaeaea",
        fontSize: 14, color: "#333", minHeight: 38, lineHeight: 1.5,
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function SectionHeader({ number, title }) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 0 6px",
      borderBottom: "2px solid #e8f4fd",
      marginBottom: 4, marginTop: number > 1 ? 12 : 0,
    }}>
      <span style={{
        background: "#1a6fa8", color: "#fff", borderRadius: "50%",
        width: 22, height: 22, display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0,
      }}>
        {number}
      </span>
      <span style={{ fontWeight: 500, fontSize: 14, color: "#1a3c5e" }}>{title}</span>
    </div>
  );
}

function ReadOnlyForm({ data, formId, formVersion }) {
  if (!data) return null;

  const fmt    = v => (v !== undefined && v !== null && v !== "") ? `RM ${parseFloat(v).toFixed(2)}` : "RM 0.00";
  const isYes  = v => v === true || v === "true" || v === "Yes" || v === 1;
  const fmtDt  = v => v ? new Date(v).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const total  = [data.trainingFee, data.mileage, data.mealAllowance, data.accommodation, data.otherCost]
                   .reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2);

  return (
    <div>
      {/* Form header bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 18px",
        background: "linear-gradient(135deg, #1e3a5f, #16324f)",
        borderRadius: 10, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: "#9fc7f0" }}>
          Form ID: <strong style={{ color: "#fff", fontFamily: "monospace", fontSize: 14 }}>{formId || "—"}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: "#5a8ab0" }}>
            Submitted: {fmtDt(data.submittedAt)}
          </div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }} />
          <div style={{ fontSize: 12, color: "#cfe6ff", background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.1)" }}>
            v{formVersion || "—"}
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>

        <SectionHeader number={1} title="Employee Details" />
        <Field label="Employee Name"     value={data.employeeName} />
        <Field label="Position"          value={data.position} />
        <Field label="Department"        value={data.department} />
        <Field label="Reporting Manager" value={data.reportingManager} />

        <SectionHeader number={2} title="Training Details" />
        <Field label="Course Name"       value={data.courseName} />
        <Field label="Training Provider" value={data.trainingProvider} />
        <Field label="Start Date / Time" value={fmtDt(data.startDate)} />
        <Field label="End Date / Time"   value={fmtDt(data.endDate)} />
        <Field label="Training Objective" value={data.trainingObjective} full />
        <Field label="Venue"              value={data.venue}             full />

        <SectionHeader number={3} title="Cost Breakdown" />
        <Field label="Training Fee"   value={fmt(data.trainingFee)} />
        <Field label="Mileage"        value={fmt(data.mileage)} />
        <Field label="Meal Allowance" value={fmt(data.mealAllowance)} />
        <Field label="Accommodation"  value={fmt(data.accommodation)} />
        <Field label="Other Cost"     value={fmt(data.otherCost)} />
        <Field label="HRDC Application" value={isYes(data.hrdcApplication) ? "Yes" : "No"} />

        {/* Total cost — full width highlighted */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500 }}>Total Cost</div>
          <div style={{ padding: "10px 14px", background: "#e8f4fd", borderRadius: 6, border: "1px solid #b3d9f7", fontSize: 16, color: "#1a3c5e", fontWeight: 600 }}>
            RM {total}
          </div>
        </div>

        <SectionHeader number={4} title="Submitted By" />
        <Field label="Applicant Name" value={data.applicantName} />
        <Field label="Submitted At"   value={fmtDt(data.submittedAt)} />

        {/* Applicant signature — full width */}
        {data.applicantSignature && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500 }}>Applicant Signature</div>
            <div style={{ padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #eaeaea", display: "inline-block" }}>
              <img src={data.applicantSignature} alt="Applicant signature" style={{ maxWidth: 280, maxHeight: 100, display: "block" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Signature pad ─────────────────────────────────────────────────────────────

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
            Approver Signature
          </div>
          <div style={{ fontSize: "13px", color: "#666" }}>
            Draw your signature below, then tap Confirm
          </div>
        </div>

        <div style={{
          border: "1.5px solid #d0d0d0", borderRadius: "8px",
          background: "#fafafa", position: "relative", overflow: "hidden"
        }}>
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
                background: isEmpty ? "#b0bec5" : "#1a6fa8",
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

// ── Signature Trigger Box (replaces the old inline SignaturePad) ───────────────
function SignatureTrigger({ value, onChange, submitting }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (submitting) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: "#1a6fa8" }}>
        <div style={{ width: 18, height: 18, border: "2px solid #b3d9f7", borderTop: "2px solid #1a6fa8", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
        Submitting...
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
        {value ? "Signature captured — tap to edit" : "Tap the box below to draw your signature:"}
      </div>

      <div
        onClick={() => setDialogOpen(true)}
        style={{
          border: value ? "2px solid #1a6fa8" : "2px dashed #bbb",
          borderRadius: "8px",
          background: value ? "#f0f5fa" : "#fafafa",
          minHeight: "100px",
          maxWidth: "460px",
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
              style={{ maxWidth: "90%", maxHeight: "80px", display: "block", pointerEvents: "none" }}
            />
            <div style={{
              position: "absolute", top: "8px", right: "8px",
              background: "#1a6fa8", color: "#fff",
              borderRadius: "4px", padding: "3px 10px",
              fontSize: "11px", fontWeight: 500
            }}>
              Tap to edit
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              style={{
                position: "absolute", top: "8px", left: "8px",
                background: "rgba(255,255,255,0.9)", border: "1px solid #ddd",
                borderRadius: "4px", padding: "3px 10px",
                fontSize: "11px", cursor: "pointer", color: "#c0392b"
              }}
            >
              Remove
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", color: "#999", pointerEvents: "none" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>✍️</div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#555" }}>Tap to sign</div>
            <div style={{ fontSize: "12px", marginTop: "4px", color: "#aaa" }}>Opens a signing dialog</div>
          </div>
        )}
      </div>

      {/* Helper text below box */}
      {value && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#2d6a3f", display: "flex", alignItems: "center", gap: 6 }}>
          <span>✓</span> Signature ready — click Approve below to submit
        </div>
      )}
      {!value && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
          Please draw your signature above before approving.
        </div>
      )}

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
function ApprovalBox({ layer, totalLayers, email, signedAt, status, outcome, isMine, onApprove, onReject, submitting }) {
  const signed   = status === "Signed";
  const rejected = outcome === "Rejected";

  const colors = signed
    ? rejected
      ? { border: "#f5b7b1", bg: "#fdecea", badge: { bg: "#f5b7b1", color: "#7b1f1f" } }
      : { border: "#a8d5b0", bg: "#e6f4ea", badge: { bg: "#a8d5b0", color: "#1e5c32" } }
    : isMine
      ? { border: "#b3d9f7", bg: "#e8f4fd", badge: { bg: "#b3d9f7", color: "#0c447c" } }
      : { border: "#e0e0e0", bg: "#f7f7f7", badge: { bg: "#ececec", color: "#aaa" } };

  const badgeText = signed
    ? rejected ? "Rejected" : "Approved"
    : isMine ? "Awaiting your action" : "Pending";

  // ← sig state lives here now, passed down to SignatureTrigger
  const [sig, setSig] = useState(null);

  return (
    <div style={{
      border: `1px solid ${colors.border}`, borderRadius: 10,
      padding: "20px 22px", marginBottom: 14, background: colors.bg,
      opacity: (!signed && !isMine) ? 0.6 : 1,
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: signed ? (rejected ? "#e24b4a" : "#2d6a3f") : isMine ? "#1a6fa8" : "#ccc",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600,
          }}>
            {layer}
          </div>
          <div style={{ fontWeight: 500, fontSize: 15, color: "#1a3c5e" }}>
            Layer {layer} of {totalLayers} — Approval
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 12px", borderRadius: 20, background: colors.badge.bg, color: colors.badge.color, whiteSpace: "nowrap" }}>
          {badgeText}
        </span>
      </div>

      {/* Info row */}
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Approver</div>
          <div style={{ fontSize: 14, color: "#444" }}>{email || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Date / Time</div>
          <div style={{ fontSize: 14, color: "#444" }}>
            {signedAt ? new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—"}
          </div>
        </div>
        {signed && outcome && (
          <div>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Decision</div>
            <div style={{ fontSize: 14, color: rejected ? "#a93226" : "#2d6a3f", fontWeight: 500 }}>{outcome}</div>
          </div>
        )}
      </div>

      {/* Signed state */}
      {signed && !rejected && (
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Signature</div>
          <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 6, border: "1px solid #e0e0e0", display: "inline-block", fontSize: 13, color: "#aaa" }}>
            Signature on file
          </div>
        </div>
      )}

      {/* Locked future layer */}
      {!signed && !isMine && (
        <div style={{ padding: "10px 0", color: "#bbb", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔒</span> Waiting for Layer {layer - 1} approval before this becomes active
        </div>
      )}

      {/* Active layer — dialog-based signature */}
      {isMine && !signed && (
        <div>
          {/* ↓ replaces old <SignaturePad> */}
          <SignatureTrigger
            value={sig}
            onChange={setSig}
            submitting={submitting}
          />

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid #e0e0e0", flexWrap: "wrap" }}>
            <button
              onClick={() => onApprove(sig)}
              disabled={submitting || !sig}
              style={{
                flex: 1, minWidth: 140,
                padding: "11px 20px", borderRadius: 8, border: "none",
                background: sig ? "#1a6fa8" : "#e0e0e0",
                color: sig ? "#fff" : "#aaa",
                fontSize: 14, fontWeight: 500,
                cursor: (submitting || !sig) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              ✓ Approve Application
            </button>

            <button
              onClick={onReject}
              disabled={submitting}
              style={{
                padding: "11px 20px", borderRadius: 8,
                border: "1px solid #f5b7b1",
                background: "#fff", color: "#a93226",
                fontSize: 14, fontWeight: 500,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              ✕ Reject Application
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ── Main ──────────────────────────────────────────────────────────────────────

export default function ApprovePage() {
  const { error: msalError }               = useMsalAuthentication(InteractionType.Redirect, loginRequest);
  const { accounts, inProgress }           = useMsal();
  const isAuthenticated                    = useIsAuthenticated();
  const retryFnRef = useRef(null);
  const [status,        setStatus]        = useState("idle");
  const [data,          setData]          = useState(null);
  const [signResult,    setSignResult]    = useState(null);
  const [errorMsg,      setErrorMsg]      = useState("");
  const [dialog,        setDialog]        = useState(null); // null | "approve" | "reject"
  const [pendingSig,    setPendingSig]    = useState(null);
  const [submitting,    setSubmitting]    = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

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

    const userEmail = accounts[0].username;
    setStatus("loading");

    fetch(process.env.REACT_APP_FLOW_URL_FETCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userEmail}),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (d.alreadySigned) { setData(d); setStatus("already_signed"); return; }
        if (!d.authorized)   { setStatus("unauthorized"); setErrorMsg(d.message || "You are not authorised."); return; }
        setData(d);
        setStatus("ready");
      })
      .catch(e => {
        console.error("Fetch error:", e);
        setStatus("error");
        setErrorMsg("Unable to load the application. Please try again or contact HR.");
      });
  }, [isAuthenticated, inProgress, accounts, token, status]);

  // Called when approver clicks Approve — opens confirm dialog
  const handleApproveClick = useCallback((sig) => {
    setPendingSig(sig);
    setDialog("approve");
  }, []);

  // Called when approver clicks Reject — opens confirm dialog
  const handleRejectClick = useCallback(() => {
    setDialog("reject");
  }, []);

  const handleConfirmApprove = useCallback(async () => {
    if (!data || !accounts.length || !pendingSig) return;
    const userEmail = accounts[0].username;
    const signedAt  = new Date().toISOString();

    const doSubmit = async () => {
      setSubmitting(true);
      setStatus("ready"); // ← clear any previous error, go back to form
      setDialog(null);
      try {
        const res = await fetch(process.env.REACT_APP_FLOW_URL_SIGN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, userEmail, userLayer: data.userLayer, signature: pendingSig, signedAt, action: "approved", formID: data?.formId, submissionID: data?.submissionID}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSignResult({ signedAt, action: "approved" });
        setStatus("done");
        retryFnRef.current = null;
      } catch (e) {
        console.error("Approve error:", e);
        setErrorMsg("Failed to submit approval. Please try again.");
        setStatus("submit_error"); // ← new dedicated error state
      } finally {
        setSubmitting(false);
      }
    };

    retryFnRef.current = doSubmit; // ← save for retry
    await doSubmit();
  }, [data, token, accounts, pendingSig]);

  // Confirmed rejection
  const handleConfirmReject = useCallback(async (reason) => {
    if (!data || !accounts.length) return;
    const userEmail = accounts[0].username;
    const signedAt  = new Date().toISOString();

    const doSubmit = async () => {
      setSubmitting(true);
      setStatus("ready");
      setDialog(null);
      try {
        const res = await fetch(process.env.REACT_APP_FLOW_URL_SIGN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, userEmail, userLayer: data.userLayer, signedAt, action: "rejected",formID: data?.formId, submissionID: data?.submissionID, rejectionReason: reason }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSignResult({ signedAt, action: "rejected" });
        setStatus("done");
        retryFnRef.current = null;
      } catch (e) {
        console.error("Reject error:", e);
        setErrorMsg("Failed to submit rejection. Please try again.");
        setStatus("submit_error");
      } finally {
        setSubmitting(false);
      }
    };

    retryFnRef.current = doSubmit;
    await doSubmit();
  }, [data, token, accounts]);

  const userEmail = accounts[0]?.username || "";

  // ── Render states ──

  if (!isAuthenticated || inProgress !== InteractionStatus.None) return <LoginWaitScreen />;
  if (status === "idle" || status === "loading") return <PageSkeleton userEmail={userEmail} />;
  if (status === "unauthorized") return <Screen icon="🔒" title="Access Denied" message={errorMsg} color="#a93226" />;
  if (status === "error") return (
    <Screen icon="❌" title="Something Went Wrong" message={errorMsg} color="#a93226">
      <button
        onClick={() => { setStatus("idle"); window.location.reload(); }}
        style={{ background: "#1a6fa8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}
      >
        Try again
      </button>
    </Screen>
  );

  // Submit error — reuse existing data, no reload needed
  if (status === "submit_error") return (
    <Screen icon="❌" title="Submission Failed" message={errorMsg} color="#a93226">
      <button
        onClick={() => retryFnRef.current?.()}
        style={{ background: "#1a6fa8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}
      >
        Try again
      </button>
    </Screen>
  );

  if (status === "already_signed") {
    const ld = data?.[`l${data?.userLayer}`];
    return <AlreadySignedPage userEmail={userEmail} layer={data?.userLayer} signedAt={ld?.signedAt} action={ld?.outcome} />;
  }
  if (status === "done") {
    return <SuccessPage userEmail={userEmail} layer={data?.userLayer} signedAt={signResult?.signedAt} action={signResult?.action} />;
  }

  const { submissionData, formId, formVersion, totalLayers, userLayer, currentLayer } = data;
  const total    = parseInt(totalLayers);
  const myLayer  = parseInt(userLayer);
  const curLayer = parseInt(currentLayer);
  const alreadyDone = myLayer < curLayer;

  const layers = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    return data[`l${n}`] || { email: null, signedAt: null, status: "Pending", outcome: null };
  });

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Confirm dialog */}
      {dialog && (
        <ConfirmDialog
          type={dialog}
          loading={submitting}
          onConfirm={dialog === "approve" ? handleConfirmApprove : handleConfirmReject}
          onCancel={() => setDialog(null)}
        />
      )}

      {/* Top banner */}
      <div style={{ background: "#e8f4fd", border: "1px solid #b3d9f7", borderRadius: 8, padding: "12px 18px", marginBottom: 28, fontSize: 14, color: "#1a6fa8", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span>
          Signed in as <strong>{userEmail}</strong>
          {" — "}
          {alreadyDone ? `You already actioned this application (Layer ${myLayer})` : `You are the Layer ${myLayer} approver`}
        </span>
        <span style={{ fontSize: 11, background: "#b3d9f7", color: "#0c447c", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>
          Layer {myLayer} of {total}
        </span>
      </div>

      {/* 2-column read-only form */}
      <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />

      <hr style={{ margin: "32px 0", borderColor: "#e0e0e0" }} />

      {/* Approval section */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ background: "#1a6fa8", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>5</span>
        <h3 style={{ margin: 0, color: "#1a3c5e", fontSize: 16, fontWeight: 500 }}>Approval</h3>
        <span style={{ fontSize: 12, color: "#888" }}>
          ({layers.filter(l => l.status === "Signed").length} of {total} completed)
        </span>
      </div>

      {layers.map((layer, i) => {
        const layerNum = i + 1;
        const isMine   = myLayer === layerNum && curLayer === layerNum && !alreadyDone;
        return (
          <ApprovalBox
            key={layerNum}
            layer={layerNum}
            totalLayers={total}
            email={layer?.email}
            signedAt={layer?.signedAt}
            status={layer?.status}
            outcome={layer?.outcome}
            isMine={isMine}
            onApprove={isMine ? handleApproveClick : null}
            onReject={isMine ? handleRejectClick : null}
            submitting={isMine && submitting}
          />
        );
      })}

      {alreadyDone && (
        <div style={{ background: "#e6f4ea", border: "1px solid #a8d5b0", borderRadius: 8, padding: "12px 18px", marginTop: 8, color: "#2d6a3f", fontSize: 14 }}>
          You have already actioned this application. Waiting for other approvers to complete.
        </div>
      )}
    </div>
  );
}