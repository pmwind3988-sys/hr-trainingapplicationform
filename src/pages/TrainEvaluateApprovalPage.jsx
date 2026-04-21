/**
 * TrainEvalApprovePage.jsx  — Training Evaluation Form Part II approval page
 * Uses shared primitives from ApprovalShared.jsx
 *
 * Key details:
 *  • Intro dialog    — shown on load: displays form context info + the formal
 *                      "I (HOD) have gone through this form…" declaration that
 *                      the approver must acknowledge before proceeding
 *  • No reject       — this form follows the physical form flow (evaluate only)
 *  • ReadOnlyForm    — shows Part I submission fields
 *  • PartIIFields    — Yes/No performance matrix + compulsory HOD comments
 *                      + Name / Position inline; signature collected by ApprovalChain
 *  • Declaration     — rendered above signature in the chain section
 *  • isApprovalOpen  — soft timing notice only, never blocks
 *  • Uses REACT_APP_FLOW3_FETCH_URL / REACT_APP_FLOW3_SIGN_URL env vars
 */

import React, { useEffect, useCallback, useState, useRef } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

import {
  C, globalStyles, isAllowedTenant, fmtDate,
  buildLayers, deriveFormStatus,
  Btn, Field, SectionDivider,
  PageSkeleton, Screen,
  SuccessPage, AlreadySignedPage, WrongTenantScreen, WaitingForLayersScreen,
  PageShell, PageFooter,
  UserBadge, StatusOverlayModal, ConfirmDialog,
  ApprovalChain, TerminalBanner, PrintPreviewButton
} from "./ApprovalShared";

const EVAL_LAYER_TITLES = ["Immediate Superior / HOD"];
const EVAL_SECTION_LABELS = ["Evaluated By"];

// ─── Intro / context dialog ───────────────────────────────────────────────────
// Shown once when the page first loads (after auth). Approver must click
// "I Understand, Proceed" before the form becomes interactive.
function IntroDialog({ onProceed, isApprovalOpen, targetDateStr, submittedAtStr, employeeName, trainingTitle }) {
  const isEarly = !isApprovalOpen;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(15,15,25,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", backdropFilter: "blur(4px)",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: C.white, borderRadius: 16,
        width: "100%", maxWidth: 520,
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
        border: `1px solid ${C.border}`,
        animation: "fadeUp 0.25s ease",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
          padding: "20px 24px",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Training Evaluation Form
          </div>
          <div style={{ fontSize: 17, color: C.white, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}>
            Part II – HOD / Immediate Superior Evaluation
          </div>
        </div>

        {/* Timing notice */}
        <div style={{
          background: isEarly ? "#fffbeb" : C.purplePale,
          borderBottom: `1px solid ${isEarly ? "#fde68a" : C.purpleMid}`,
          padding: "12px 24px",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{isEarly ? "⏳" : "📋"}</span>
          <div style={{ fontSize: 13, color: isEarly ? "#78350f" : C.textPrimary, lineHeight: 1.65 }}>
            {isEarly ? (
              <>This evaluation is <strong>not yet due</strong>. It should be completed <strong>3 months after the training date</strong>. You may still proceed early if needed.</>
            ) : (
              <>This evaluation is <strong>now due</strong>. Please complete Part II below to record your assessment of the training's effectiveness.</>
            )}
          </div>
        </div>

        {/* Submission context grid */}
        <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
          {[
            { label: "Employee", value: employeeName },
            { label: "Training", value: trainingTitle },
            { label: "Form Submitted", value: submittedAtStr },
            { label: "Evaluation Due", value: targetDateStr, highlight: true },
          ].filter(r => r.value).map(({ label, value, highlight }) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color: highlight ? C.purple : C.textPrimary, fontWeight: highlight ? 600 : 400 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Action */}
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onProceed}
            style={{
              width: "100%", padding: "13px 20px",
              borderRadius: 9, border: "none",
              background: C.purple, color: C.white,
              fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.2s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            I Understand — Proceed to Evaluate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Blocking M365 Login Prompt ────────────────────────────────────────────────
function ApprovalLoginPrompt({ onLogin, loading }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 0 rgba(91,33,182,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h7M2 10h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: C.textPrimary }}>Approval</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.purple, background: C.purplePale, borderRadius: 20, padding: "3px 10px", border: `1px solid ${C.purpleMid}`, letterSpacing: "0.04em", textTransform: "uppercase" }}>HR Forms</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", minHeight: "calc(100vh - 56px)" }}>
        <div style={{ background: C.white, borderRadius: 16, padding: "40px 36px", maxWidth: 420, width: "100%", boxShadow: `0 8px 40px rgba(91,33,182,0.16)`, border: `1px solid ${C.border}`, textAlign: "center", animation: "fadeUp 0.3s ease" }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, margin: "0 auto 20px", background: C.purplePale, border: `1px solid ${C.purpleMid}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke={C.purple} strokeWidth="1.5" />
              <path d="M7 11V7a5 5 0 0110 0v4" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.5" fill={C.purple} />
            </svg>
          </div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: C.textPrimary, marginBottom: 10 }}>Sign in to evaluate</h2>
          <p style={{ color: C.textSecond, fontSize: 13, lineHeight: 1.75, marginBottom: 10 }}>
            This approval portal requires a <strong>Microsoft 365 organisational account</strong>. Your identity is used to verify your approver role and record your evaluation.
          </p>
          <div style={{ background: C.purplePale, border: `1px solid ${C.purpleMid}`, borderRadius: 10, padding: "12px 16px", marginBottom: 28, display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
            {[
              { icon: "🔐", text: "Only authorised approvers can access this link" },
              { icon: "📋", text: "Your evaluation will be recorded against this submission" },
              { icon: "🏢", text: "Must be a PMW International organisational account" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, color: C.textPrimary }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <span style={{ lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
          <button onClick={onLogin} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 9, background: loading ? C.purpleMid : C.purple, color: C.white, border: "none", fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "background 0.2s" }}>
            {loading ? (
              <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />Redirecting to Microsoft…</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><rect x="1" y="1" width="6.5" height="6.5" fill="#F25022" /><rect x="8.5" y="1" width="6.5" height="6.5" fill="#7FBA00" /><rect x="1" y="8.5" width="6.5" height="6.5" fill="#00A4EF" /><rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFB900" /></svg>Sign in with Microsoft 365</>
            )}
          </button>
          <p style={{ color: C.textMuted, fontSize: 11, marginTop: 18, lineHeight: 1.6 }}>Guest access is not available for approval pages.<br />You must sign in with your organisational account to proceed.</p>
        </div>
      </div>
    </div>
  );
}

// ── Soft timing banner (shown inline on page, non-blocking) ───────────────────
function PartIINoticeBanner({ isApprovalOpen, targetDateStr, submittedAtStr, employeeName, trainingTitle }) {
  const isEarly = !isApprovalOpen;
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `1.5px solid ${isEarly ? "#d97706" : C.purple}`, marginBottom: 24 }}>
      <div style={{ background: isEarly ? "#92400e" : C.purpleDark, padding: "11px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>{isEarly ? "⏳" : "✅"}</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          PART II – To be filled by the Immediate Superior / HOD{isEarly ? " (3 months after training)" : ""}
        </span>
      </div>
      <div style={{ background: isEarly ? "rgba(255,251,235,0.97)" : C.purplePale, padding: "12px 18px", display: "flex", flexWrap: "wrap", gap: "8px 28px", fontSize: 13, color: isEarly ? "#78350f" : C.textPrimary, borderBottom: `1px solid ${isEarly ? "#fde68a" : C.purpleMid}` }}>
        {employeeName && <span><strong>Employee:</strong> {employeeName}</span>}
        {trainingTitle && <span><strong>Training:</strong> {trainingTitle}</span>}
        {submittedAtStr && <span><strong>Form Submitted:</strong> {submittedAtStr}</span>}
        {targetDateStr && <span><strong>Evaluation Due:</strong> <strong style={{ color: isEarly ? "#b45309" : C.purple }}>{targetDateStr}</strong></span>}
      </div>
      <div style={{ background: isEarly ? "#fffbeb" : C.white, padding: "11px 18px", fontSize: 13, color: isEarly ? "#92400e" : C.textSecond, lineHeight: 1.7 }}>
        {isEarly
          ? <>This evaluation is not yet due. It should be completed <strong>3 months after the training date</strong>. You may still proceed and submit early if needed.</>
          : <>Please complete this evaluation to confirm whether the training has achieved its intended outcomes on the employee's performance and job effectiveness.</>
        }
      </div>
    </div>
  );
}

// ── Part I ReadOnlyForm ───────────────────────────────────────────────────────
function ReadOnlyForm({ data, formId, formVersion }) {
  if (!data) return null;

  const overallMap = { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" };

  function cleanHtml(raw = "") {
    return raw
      .replace(/<div[^>]*class="ExternalClass[^"]*"[^>]*>/gi, '<div style="overflow-x:auto">')
      .replace(/<p[^>]*class="editor-paragraph"[^>]*>/gi, "")
      .replace(/<\/p>/gi, "");
  }

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow, marginBottom: 24 }}>
      <div style={{ background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Training Evaluation Form — Part I</div>
          <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>Form ID: <strong style={{ fontFamily: "monospace" }}>#{formId || "—"}</strong></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Submitted: {fmtDate(data.employeeSignedAt)}</div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 11, color: C.purpleMid, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)" }}>v{formVersion || "—"}</span>
        </div>
      </div>

      <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
        <SectionDivider number={1} title="Employee Details" />
        <Field label="Employee Name" value={data.employeeName} />
        <Field label="Employee ID" value={data.employeeID} />
        <Field label="Position" value={data.position} />
        <Field label="Department" value={data.department} />

        <SectionDivider number={2} title="Training Details" />
        <Field label="Training Title" value={data.trainingTitle} />
        <Field label="Date & Duration" value={data.dateDuration} />
        <Field label="Training Type" value={data.trainingType} />
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Training Objective" value={data.trainingObjective} />
        </div>

        <SectionDivider number={3} title="Contents of the Course" />
        <div style={{ gridColumn: "1 / -1" }}>
          {data.evaluationItem ? (
            <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: cleanHtml(data.evaluationItem) }} />
          ) : (
            <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No course content ratings recorded.</p>
          )}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Overall Rating" value={overallMap[data.overallRating] || data.overallRating} />
        </div>

        <SectionDivider number={4} title="Effectiveness of the Training" />
        <div style={{ gridColumn: "1 / -1" }}>
          {data.effectivenessOfTraining ? (
            <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: cleanHtml(data.effectivenessOfTraining) }} />
          ) : (
            <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No effectiveness ratings recorded.</p>
          )}
        </div>

        {data.commentsFeedback && (
          <>
            <SectionDivider number={5} title="Comments / Feedback" />
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Comments" value={data.commentsFeedback} />
            </div>
          </>
        )}

        <SectionDivider number={6} title="Employee Acknowledgement" />
        <Field label="Date Signed" value={data.employeeSignedAt ? fmtDate(data.employeeSignedAt) : "—"} />
        {data.employeeSignature && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Employee Signature</div>
            <div style={{ padding: 12, background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, display: "inline-block" }}>
              <img src={data.employeeSignature} alt="Employee signature" style={{ maxWidth: 280, maxHeight: 100, display: "block" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Part II editable fields ───────────────────────────────────────────────────
function PartIIFields({ values, onChange, errors }) {
  const perfRows = [
    { key: "objective_met", label: "Training objective met" },
    { key: "improve_skills", label: "Improve on required skills" },
    { key: "productivity_increase", label: "The employee's productivity level increase" },
    { key: "quality_improved", label: "I agree that overall quality of employee has improved" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* A – Performance Indication */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.textPrimary, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: C.purple, color: C.white, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>A</span>
          Performance Indication
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ border: `1px solid ${C.border}`, padding: "8px 12px", background: C.offWhite, textAlign: "left", fontWeight: 600, color: C.textPrimary }}>Performance Indicator</th>
              <th style={{ border: `1px solid ${C.border}`, padding: "8px 12px", background: C.offWhite, textAlign: "center", fontWeight: 600, color: C.textPrimary, width: 60 }}>Yes</th>
              <th style={{ border: `1px solid ${C.border}`, padding: "8px 12px", background: C.offWhite, textAlign: "center", fontWeight: 600, color: C.textPrimary, width: 60 }}>No</th>
            </tr>
          </thead>
          <tbody>
            {perfRows.map(({ key, label }, i) => (
              <tr key={key} style={{ background: i % 2 === 0 ? C.white : C.offWhite }}>
                <td style={{ border: `1px solid ${C.border}`, padding: "9px 12px", color: C.textPrimary }}>{label}</td>
                {["yes", "no"].map((opt) => (
                  <td key={opt} style={{ border: `1px solid ${C.border}`, padding: "9px 12px", textAlign: "center" }}>
                    <input
                      type="radio"
                      name={`perf_${key}`}
                      value={opt}
                      checked={(values.performance_indication?.[key] ?? "") === opt}
                      onChange={() => onChange("performance_indication", { ...(values.performance_indication || {}), [key]: opt })}
                      style={{ accentColor: C.purple, width: 16, height: 16, cursor: "pointer" }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {errors?.performance_indication && (
          <p style={{ color: C.red, fontSize: 12, marginTop: 6 }}>Please select Yes or No for all items.</p>
        )}
      </div>

      {/* B – HOD Comments */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.textPrimary, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: C.purple, color: C.white, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>B</span>
          Immediate Superior / HOD Comments
          <span style={{ fontSize: 11, color: C.red, fontWeight: 500 }}>(Compulsory)</span>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
          Justifications or remarks for the above performance indication.
        </p>
        <textarea
          value={values.hod_comments || ""}
          onChange={(e) => onChange("hod_comments", e.target.value)}
          placeholder="Enter justifications or remarks…"
          rows={5}
          style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${errors?.hod_comments ? C.red : C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.textPrimary, fontFamily: "inherit", resize: "vertical", outline: "none", background: C.white, lineHeight: 1.6 }}
        />
        {errors?.hod_comments && (
          <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>This field is required.</p>
        )}
      </div>

      {/* Declaration statement — mirrors physical form wording */}
      <div style={{
        background: C.offWhite,
        border: `1.5px solid ${C.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        fontSize: 13,
        color: C.textPrimary,
        lineHeight: 1.8,
      }}>
        <strong>I (Immediate Superior/HOD)</strong> have gone through this form and evaluated the effectiveness of the training program attended by the employee.
      </div>

      {/* Name & Position */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Name</label>
          <input
            type="text"
            value={values.hod_name || ""}
            onChange={(e) => onChange("hod_name", e.target.value)}
            placeholder="Full name"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${errors?.hod_name ? C.red : C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.textPrimary, fontFamily: "inherit", outline: "none", background: C.white }}
          />
          {errors?.hod_name && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>Required.</p>}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Position</label>
          <input
            type="text"
            value={values.hod_position || ""}
            onChange={(e) => onChange("hod_position", e.target.value)}
            placeholder="Job title / position"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${errors?.hod_position ? C.red : C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.textPrimary, fontFamily: "inherit", outline: "none", background: C.white }}
          />
          {errors?.hod_position && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>Required.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
function validatePartII(values) {
  const errors = {};
  const perfKeys = ["objective_met", "improve_skills", "productivity_increase", "quality_improved"];
  const perf = values.performance_indication || {};
  if (perfKeys.some((k) => !perf[k])) errors.performance_indication = true;
  if (!values.hod_comments?.trim()) errors.hod_comments = true;
  if (!values.hod_name?.trim()) errors.hod_name = true;
  if (!values.hod_position?.trim()) errors.hod_position = true;
  return errors;
}

// ── Performance indication HTML for payload ───────────────────────────────────
function buildPerformanceHtml(perfData = {}) {
  const rows = [
    { key: "objective_met", label: "Training objective met" },
    { key: "improve_skills", label: "Improve on required skills" },
    { key: "productivity_increase", label: "The employee's productivity level increase" },
    { key: "quality_improved", label: "I agree that overall quality of employee has improved" },
  ];
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:13px;">
    <thead><tr style="background:#f3f4f6;">
      <th style="text-align:left;padding:8px 12px;">Performance Indicator</th>
      <th style="width:60px;text-align:center;">Yes</th>
      <th style="width:60px;text-align:center;">No</th>
    </tr></thead>
    <tbody>${rows.map(({ key, label }, i) => {
    const v = perfData[key];
    return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
        <td style="padding:8px 12px;">${label}</td>
        <td style="text-align:center;">${v === "yes" ? "✓" : ""}</td>
        <td style="text-align:center;">${v === "no" ? "✓" : ""}</td>
      </tr>`;
  }).join("")}</tbody>
  </table>`;
}

// ── Load & action hook ────────────────────────────────────────────────────────
function useEvalApprovalPage({ fetchUrl, signUrl }) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [signResult, setSignResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dialog, setDialog] = useState(null);   // "approve" only
  const [pendingSig, setPendingSig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showIntroDialog, setShowIntroDialog] = useState(true);
  const retryFnRef = useRef(null);
  const token = new URLSearchParams(window.location.search).get("token");

  const [partIIValues, setPartIIValues] = useState({});
  const [partIIErrors, setPartIIErrors] = useState({});

  const handlePartIIChange = useCallback((field, value) => {
    setPartIIValues((prev) => ({ ...prev, [field]: value }));
    setPartIIErrors((prev) => ({ ...prev, [field]: false }));
  }, []);

  const load = useCallback(async ({ userEmail, isAllowed }) => {
    if (!isAllowed) { setStatus("wrong_tenant"); return; }
    setStatus("loading");
    try {
      const r = await fetch(fetchUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, userEmail }) });
      const d = await r.json();
      const payload = d.body ?? d;

      if (payload.alreadySigned) { setData(payload); setStatus("already_signed"); return; }
      if (!payload.authorized) { setStatus("unauthorized"); setErrorMsg(payload.message || "You are not authorised."); return; }

      const total = parseInt(payload.totalLayers) || 0;
      const layers = buildLayers(payload, total);
      const formStatus = deriveFormStatus(layers, payload.formStatus);
      const isTerminal = formStatus === "rejected" || formStatus === "fullyApproved";

      setData({ ...payload, formStatus });
      setStatus(isTerminal ? "terminal" : "ready");
      if (isTerminal) { setShowOverlay(true); setShowIntroDialog(false); }
    } catch (e) {
      console.error("Eval fetch error:", e);
      setStatus("error");
      setErrorMsg("Unable to load the application. Please try again or contact HR.");
    }
  }, [fetchUrl, token]);

  const submitAction = useCallback(async ({ signature = "", userEmail, userLayer, formId, submissionID }) => {
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
            action: "approved",
            formID: String(formId || ""),
            submissionID: String(submissionID || ""),
            performance_indication: partIIValues.performance_indication,
            performance_indication_html: buildPerformanceHtml(partIIValues.performance_indication),
            hod_comments: partIIValues.hod_comments,
            hod_name: partIIValues.hod_name,
            hod_position: partIIValues.hod_position,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSignResult({ signedAt, action: "approved" });
        setStatus("done");
        retryFnRef.current = null;
      } catch (e) {
        console.error(e);
        setErrorMsg("Failed to submit. Please try again.");
        setStatus("submit_error");
      } finally { setSubmitting(false); }
    };
    retryFnRef.current = doSubmit;
    await doSubmit();
  }, [signUrl, token, partIIValues]);

  // Called by ApprovalChain when approver draws signature and clicks submit
  const handleApproveClick = useCallback((sig) => {
    const errors = validatePartII(partIIValues);
    if (Object.keys(errors).length > 0) {
      setPartIIErrors(errors);
      document.getElementById("partii-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setPendingSig(sig);
    setDialog("approve");
  }, [partIIValues]);

  return {
    status, setStatus, data, signResult, errorMsg,
    dialog, setDialog, pendingSig, submitting, showOverlay, setShowOverlay,
    showIntroDialog, setShowIntroDialog,
    retryFnRef, load, submitAction, handleApproveClick,
    partIIValues, partIIErrors, handlePartIIChange,
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrainEvalApprovePage() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [loginLoading, setLoginLoading] = useState(false);

  const {
    status, setStatus, data, signResult, errorMsg,
    dialog, setDialog, pendingSig, submitting, showOverlay, setShowOverlay,
    showIntroDialog, setShowIntroDialog,
    retryFnRef, load, submitAction, handleApproveClick,
    partIIValues, partIIErrors, handlePartIIChange,
  } = useEvalApprovalPage({
    fetchUrl: process.env.REACT_APP_FLOW3_FETCH_URL,
    signUrl: process.env.REACT_APP_FLOW3_URL_SIGN,
  });

  const userEmail = accounts[0]?.username || "";

  const handleLogin = useCallback(() => { setLoginLoading(true); instance.loginRedirect({ ...loginRequest, prompt: "select_account" }); }, [instance]);
  const handleLogout = useCallback(() => { instance.logoutRedirect({ postLogoutRedirectUri: window.location.href }); }, [instance]);
  const handleSwitch = useCallback(() => {
    instance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.href, onRedirectNavigate: () => false })
      .catch(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account" }));
  }, [instance, accounts]);

  useEffect(() => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    if (accounts.length === 0 || status !== "idle") return;
    load({ userEmail: accounts[0].username, isAllowed: isAllowedTenant(accounts[0]) });
  }, [isAuthenticated, inProgress, accounts, status, load]);

  const handleConfirmApprove = useCallback(() =>
    submitAction({ signature: pendingSig, userEmail, userLayer: data?.userLayer, formId: data?.formId, submissionID: data?.submissionID }),
    [submitAction, pendingSig, userEmail, data]);

  // Derived context values
  const submissionData = data?.submissionData ?? {};
  const isApprovalOpen = data?.isApprovalOpen === true || data?.isApprovalOpen === "true";
  const submittedAt = submissionData.employeeSignedAt ?? data?.submittedAt ?? null;
  const targetDateStr = submittedAt ? (() => {
    const d = new Date(submittedAt); d.setMonth(d.getMonth() + 3);
    return d.toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "long", day: "numeric" });
  })() : null;
  const submittedAtStr = submittedAt
    ? new Date(submittedAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "long", day: "numeric" })
    : null;

  // ── Auth / status guards ───────────────────────────────────────────────────
  if (inProgress !== InteractionStatus.None) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
        <style>{globalStyles}</style>
        <div style={{ width: 20, height: 20, border: `2px solid ${C.purpleMid}`, borderTop: `2px solid ${C.purple}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", marginBottom: 16 }} />
        <p style={{ color: C.textMuted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Signing you in…</p>
      </div>
    );
  }

  if (!isAuthenticated) return <ApprovalLoginPrompt onLogin={handleLogin} loading={loginLoading} />;
  if (status === "idle" || status === "loading") return <PageSkeleton userEmail={userEmail} />;
  if (status === "wrong_tenant") return <WrongTenantScreen userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;
  if (status === "unauthorized") return <Screen icon="🔒" title="Access Denied" message={errorMsg} color={C.red}><Btn onClick={handleLogout} variant="ghost">🚪 Sign out</Btn></Screen>;
  if (status === "error") return <Screen icon="❌" title="Something Went Wrong" message={errorMsg} color={C.red}><Btn onClick={() => { setStatus("idle"); window.location.reload(); }} variant="primary">Try again</Btn></Screen>;
  if (status === "submit_error") return <Screen icon="❌" title="Submission Failed" message={errorMsg} color={C.red}><Btn onClick={() => retryFnRef.current?.()} variant="primary">Try again</Btn></Screen>;
  if (status === "done") return <SuccessPage userEmail={userEmail} layer={data?.userLayer} signedAt={signResult?.signedAt} action={signResult?.action} />;
  if (status === "already_signed") {
    const ld = data?.[`l${data?.userLayer}`];
    return <AlreadySignedPage userEmail={userEmail} signedEmail={ld?.email || userEmail} layer={data?.userLayer} signedAt={ld?.signedAt} action={ld?.outcome || ld?.status} rejectionReason={ld?.rejectionReason} />;
  }
  if (!data) return null;

  const { formId, formVersion, totalLayers } = data;
  const total = parseInt(totalLayers);
  const layers = buildLayers(data, total);

  // ── Terminal view ──────────────────────────────────────────────────────────
  if (status === "terminal") {
    const d = submissionData;
    const overallMap = { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" };

    const printSections = [
      {
        title: "Employee Details",
        fields: [
          { label: "Employee Name", value: d.employeeName },
          { label: "Employee ID", value: d.employeeID },
          { label: "Position", value: d.position },
          { label: "Department", value: d.department },
        ],
      },
      {
        title: "Training Details",
        fields: [
          { label: "Training Title", value: d.trainingTitle, full: true },
          { label: "Date & Duration", value: d.dateDuration },
          { label: "Training Type", value: d.trainingType },
          { label: "Training Objective", value: d.trainingObjective, full: true },
        ],
      },
      {
        title: "Contents of the Course",
        fields: [
          { label: "Course Evaluation", value: d.evaluationItem, type: "html", full: true },
          { label: "Overall Rating", value: overallMap[d.overallRating] || d.overallRating },
        ],
      },
      {
        title: "Effectiveness of the Training",
        fields: [
          { label: "Effectiveness Ratings", value: d.effectivenessOfTraining, type: "html", full: true },
        ],
      },
      ...(d.commentsFeedback ? [{
        title: "Comments / Feedback",
        fields: [
          { label: "Comments", value: d.commentsFeedback, full: true },
        ],
      }] : []),
      {
        title: "Employee Acknowledgement (Part I)",
        fields: [
          { label: "Date Signed", value: fmtDate(d.employeeSignedAt) },
          { label: "Employee Signature", value: d.employeeSignature, type: "signature", full: true },
        ],
      },
      // Part II HOD evaluation — stored in l1 layer data after submission
      {
        title: "HOD Evaluation (Part II)",
        fields: [
          { label: "Performance Indication", value: data?.l1?.performance_indication_html, type: "html", full: true },
          { label: "HOD Comments", value: data?.l1?.hod_comments, full: true },
          { label: "Name", value: data?.l1?.hod_name },
          { label: "Position", value: data?.l1?.hod_position },
          { label: "HOD Signature", value: data?.l1?.signature, type: "signature", full: true },
        ].filter(f => f.value), // skip empty Part II fields if somehow missing
      },
    ];

    return (
      <PageShell>
        {showOverlay && (
          <StatusOverlayModal formStatus={data.formStatus} layers={layers} totalLayers={total} onViewDetails={() => setShowOverlay(false)} />
        )}
        <TerminalBanner formStatus={data.formStatus} showOverlay={showOverlay} onShowOverlay={() => setShowOverlay(true)} />
        <PartIINoticeBanner isApprovalOpen={isApprovalOpen} targetDateStr={targetDateStr} submittedAtStr={submittedAtStr} employeeName={d.employeeName} trainingTitle={d.trainingTitle} />

        {/* ── Print button ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <PrintPreviewButton
            formTitle="Training Evaluation Form"
            formId={formId}
            formVersion={formVersion}
            submittedAt={d.employeeSignedAt ?? data?.submittedAt}
            formStatus={data.formStatus}
            sections={printSections}
            layers={layers}
            totalLayers={total}
            subject={null}
            customLayerTitles={EVAL_LAYER_TITLES}
          />
        </div>

        <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />
        <ApprovalChain layers={layers} totalLayers={total} subject={null} customLayerTitles={EVAL_LAYER_TITLES} customSectionLabels={EVAL_SECTION_LABELS} readOnly chainSectionNumber={7} />
        <PageFooter />
      </PageShell>
    );
  }

  const myLayer = parseInt(data.userLayer);
  const curLayer = parseInt(data.currentLayer);
  const alreadyDone = myLayer < curLayer;

  if (myLayer > curLayer) return (
    <WaitingForLayersScreen userLayer={myLayer} totalLayers={total} layers={layers} userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />
  );

  // ── Active evaluation view ─────────────────────────────────────────────────
  return (
    <PageShell>
      {/* Intro dialog — shown once, dismissed by approver */}
      {showIntroDialog && (status === "ready") && (
        <IntroDialog
          onProceed={() => setShowIntroDialog(false)}
          isApprovalOpen={isApprovalOpen}
          targetDateStr={targetDateStr}
          submittedAtStr={submittedAtStr}
          employeeName={submissionData.employeeName}
          trainingTitle={submissionData.trainingTitle}
        />
      )}

      {/* Approve confirm dialog */}
      {dialog === "approve" && (
        <ConfirmDialog
          type="approve"
          loading={submitting}
          userEmail={userEmail}
          onConfirm={handleConfirmApprove}
          onCancel={() => setDialog(null)}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <UserBadge userEmail={userEmail} layer={myLayer} total={total} alreadyDone={alreadyDone} onLogout={handleLogout} onSwitch={handleSwitch} />
      </div>

      {/* Inline timing notice */}
      <PartIINoticeBanner isApprovalOpen={isApprovalOpen} targetDateStr={targetDateStr} submittedAtStr={submittedAtStr} employeeName={submissionData.employeeName} trainingTitle={submissionData.trainingTitle} />

      {/* Part I — read only */}
      <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />

      {/* Part II — editable fields */}
      {!alreadyDone && (
        <div
          id="partii-fields"
          style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow, marginBottom: 24 }}
        >
          <div style={{ background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, padding: "14px 22px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Training Evaluation Form</div>
            <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>
              Part II – Immediate Superior / HOD Evaluation
            </div>
          </div>
          <div style={{ padding: "20px 22px" }}>
            <PartIIFields values={partIIValues} onChange={handlePartIIChange} errors={partIIErrors} />
          </div>
        </div>
      )}

      {/* Approval chain — signature + submit only (no reject) */}
      {/* Scoped style hides reject button without modifying ApprovalShared */}
      <style>{`
        #eval-chain-wrap button[data-action="reject"],
        #eval-chain-wrap [data-reject],
        #eval-chain-wrap .approval-reject-btn { display: none !important; }
      `}</style>
      <div id="eval-chain-wrap">
        <ApprovalChain
          layers={layers} totalLayers={total}
          myLayer={myLayer} curLayer={curLayer} alreadyDone={alreadyDone}
          subject={null}
          customLayerTitles={EVAL_LAYER_TITLES}
          customSectionLabels={EVAL_SECTION_LABELS}
          submitting={submitting}
          onApprove={handleApproveClick}
          onReject={null}
          chainSectionNumber={7}
        />
      </div>
      <PageFooter />
    </PageShell>
  );
}