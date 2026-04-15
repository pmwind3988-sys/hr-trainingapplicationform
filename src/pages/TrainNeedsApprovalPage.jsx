/**
 * TrainNeedsApprovePage.jsx  — Training Needs Analysis approval page
 * Uses shared primitives from ApprovalShared.jsx
 *
 * Key differences from TrainReqApprovePage:
 *  • Different ReadOnlyForm  — shows department, year, TNA table + HOD section
 *  • Single approval layer   — Layer 1 = "Head of Department"
 *  • chainSectionNumber = 4  — section badge matches the form's section count
 *  • Uses REACT_APP_FLOW2_URL_FETCH / REACT_APP_FLOW_SIGN env vars
 *  • No subject field — uses useTnaApprovalPage instead of useApprovalPage
 */

import React, { useEffect, useCallback, useState } from "react";
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
  ApprovalChain, TerminalBanner,
} from "./ApprovalShared";

const TNA_LAYER_TITLES = ["Head of Human Resources"];
const TNA_SECTION_LABELS = ["Approved By"];   // ← Layer 1 = "Approved By", not "Recommended By"

// ── Blocking M365 Login Prompt ────────────────────────────────────────────────
function ApprovalLoginPrompt({ onLogin, loading }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 56, position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 1px 0 rgba(91,33,182,0.06)",
      }}>
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
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: C.textPrimary, marginBottom: 10 }}>Sign in to approve</h2>
          <p style={{ color: C.textSecond, fontSize: 13, lineHeight: 1.75, marginBottom: 10 }}>
            This approval portal requires a <strong>Microsoft 365 organisational account</strong>. Your identity is used to verify your approver role and record your decision.
          </p>
          <div style={{ background: C.purplePale, border: `1px solid ${C.purpleMid}`, borderRadius: 10, padding: "12px 16px", marginBottom: 28, display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
            {[
              { icon: "🔐", text: "Only authorised approvers can access this link" },
              { icon: "📋", text: "Your signature will be recorded against this submission" },
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

// ── TNA-specific ReadOnlyForm ─────────────────────────────────────────────────
function ReadOnlyForm({ data, formId, formVersion }) {
  if (!data) return null;
  const rows = Array.isArray(data.training_needs_employee) ? data.training_needs_employee : [];

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow }}>
      <div style={{ background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Training Needs Analysis Form</div>
          <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>Form ID: <strong style={{ fontFamily: "monospace" }}>#{formId || "—"}</strong></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Submitted: {fmtDate(data.submittedAt)}</div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 11, color: C.purpleMid, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)" }}>Version: {formVersion || "—"}</span>
        </div>
      </div>

      <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
        <SectionDivider number={1} title="General Information" />
        <Field label="Department" value={data.department} />
        <Field label="Year" value={data.year} />

        <SectionDivider number={2} title="Training Needs" />
        <div style={{ gridColumn: "1 / -1" }}>
          {data.training_needs_html ? (
            <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, lineHeight: 1.6, color: C.textPrimary }} dangerouslySetInnerHTML={{ __html: data.training_needs_html }} />
          ) : rows.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["No.", "Emp. ID", "Name", "Training Needs", "Current Skill", "Required Skill", "Priority", "Relevance", "Tentative Date"].map(h => <th key={h} style={{ border: `1px solid ${C.border}`, padding: "8px 10px", background: C.offWhite, textAlign: "left", fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>{rows.map((row, i) => <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.offWhite }}>{[i + 1, row.employee_no, row.trainee_name, row.training_needs, (row.current_skill_level ?? []).join(", "), (row.required_skill_level ?? []).join(", "), (row.priority ?? []).join(", "), row.relevance_to_job_function, row.tentative_date].map((cell, ci) => <td key={ci} style={{ border: `1px solid ${C.border}`, padding: "8px 10px", verticalAlign: "top", color: C.textPrimary }}>{cell || "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "16px", color: C.textMuted, fontSize: 13 }}>No training needs entries found.</div>
          )}
        </div>

        <SectionDivider number={3} title="Prepared By (HOD)" />
        <Field label="Name of HOD" value={data.hod_name} />
        <Field label="Designation" value={data.hod_designation} />
        <Field label="Date" value={data.hod_date} />
        {data.hod_signature && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>HOD Signature</div>
            <div style={{ padding: 12, background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, display: "inline-block" }}>
              <img src={data.hod_signature} alt="HOD signature" style={{ maxWidth: 280, maxHeight: 100, display: "block" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TNA-specific load hook (no subject/unassigned check) ──────────────────────
function useTnaApprovalPage({ fetchUrl, signUrl }) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [signResult, setSignResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dialog, setDialog] = useState(null);
  const [pendingSig, setPendingSig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const retryFnRef = React.useRef(null);
  const token = new URLSearchParams(window.location.search).get("token");

  const load = useCallback(async ({ userEmail, isAllowed }) => {
    if (!isAllowed) { setStatus("wrong_tenant"); return; }
    setStatus("loading");
    try {
      const r = await fetch(fetchUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, userEmail }) });
      const d = await r.json();
      const payload = d.body ?? d;

      if (payload.alreadySigned) { setData(payload); setStatus("already_signed"); return; }
      if (!payload.authorized) { setStatus("unauthorized"); setErrorMsg(payload.message || "You are not authorised."); return; }

      // ── No subject check for TNA ──────────────────────────────────────────
      const total = parseInt(payload.totalLayers) || 0;
      const layers = buildLayers(payload, total);
      const formStatus = deriveFormStatus(layers, payload.formStatus);
      const isTerminal = formStatus === "rejected" || formStatus === "fullyApproved";

      setData({ ...payload, formStatus });
      setStatus(isTerminal ? "terminal" : "ready");
      if (isTerminal) setShowOverlay(true);
    } catch (e) {
      console.error("TNA fetch error:", e);
      setStatus("error");
      setErrorMsg("Unable to load the application. Please try again or contact HR.");
    }
  }, [fetchUrl, token]);

  const submitAction = useCallback(async ({ action, signature = "", rejectionReason = "", userEmail, userLayer, formId, submissionID }) => {
    const signedAt = new Date().toISOString();
    const doSubmit = async () => {
      setSubmitting(true); setStatus("ready"); setDialog(null);
      try {
        const res = await fetch(signUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: String(token), userEmail: String(userEmail), userLayer: String(userLayer), signature: String(signature), signedAt: String(signedAt), action: String(action), formID: String(formId || ""), submissionID: String(submissionID || ""), rejectionReason: String(rejectionReason) }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSignResult({ signedAt, action });
        setStatus("done");
        retryFnRef.current = null;
      } catch (e) {
        console.error(e);
        setErrorMsg(`Failed to submit ${action}. Please try again.`);
        setStatus("submit_error");
      } finally { setSubmitting(false); }
    };
    retryFnRef.current = doSubmit;
    await doSubmit();
  }, [signUrl, token]);

  const handleApproveClick = useCallback((sig) => { setPendingSig(sig); setDialog("approve"); }, []);
  const handleRejectClick = useCallback(() => { setPendingSig(null); setDialog("reject"); }, []);

  return { status, setStatus, data, signResult, errorMsg, dialog, setDialog, pendingSig, submitting, showOverlay, setShowOverlay, token, retryFnRef, load, submitAction, handleApproveClick, handleRejectClick };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrainNeedsApprovePage() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [loginLoading, setLoginLoading] = useState(false);

  const { status, setStatus, data, signResult, errorMsg, dialog, setDialog, pendingSig, submitting, showOverlay, setShowOverlay, retryFnRef, load, submitAction, handleApproveClick, handleRejectClick } = useTnaApprovalPage({
    fetchUrl: process.env.REACT_APP_FLOW2_URL_FETCH,
    signUrl: process.env.REACT_APP_FLOW_URL_SIGN,
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

  const handleConfirmApprove = useCallback(() => submitAction({ action: "approved", signature: pendingSig, userEmail, userLayer: data?.userLayer, formId: data?.formId, submissionID: data?.submissionID }), [submitAction, pendingSig, userEmail, data]);
  const handleConfirmReject = useCallback((reason) => submitAction({ action: "rejected", rejectionReason: reason, userEmail, userLayer: data?.userLayer, formId: data?.formId, submissionID: data?.submissionID }), [submitAction, userEmail, data]);

  // ── MUST check inProgress first ───────────────────────────────────────────
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
  if (status === "unauthorized") return (
    <Screen icon="🔒" title="Access Denied" message={errorMsg} color={C.red}>
      <Btn onClick={handleLogout} variant="ghost">🚪 Sign out</Btn>
    </Screen>
  );
  if (status === "error") return <Screen icon="❌" title="Something Went Wrong" message={errorMsg} color={C.red}><Btn onClick={() => { setStatus("idle"); window.location.reload(); }} variant="primary">Try again</Btn></Screen>;
  if (status === "submit_error") return <Screen icon="❌" title="Submission Failed" message={errorMsg} color={C.red}><Btn onClick={() => retryFnRef.current?.()} variant="primary">Try again</Btn></Screen>;
  if (status === "done") return <SuccessPage userEmail={userEmail} layer={data?.userLayer} signedAt={signResult?.signedAt} action={signResult?.action} />;
  if (status === "already_signed") {
    const ld = data?.[`l${data?.userLayer}`];
    return <AlreadySignedPage userEmail={userEmail} signedEmail={ld?.email || userEmail} layer={data?.userLayer} signedAt={ld?.signedAt} action={ld?.outcome || ld?.status} rejectionReason={ld?.rejectionReason} />;
  }
  if (!data) return null;

  const { submissionData, formId, formVersion, totalLayers } = data;
  const total = parseInt(totalLayers);
  const layers = buildLayers(data, total);

  if (status === "terminal") {
    return (
      <PageShell>
        {showOverlay && <StatusOverlayModal formStatus={data.formStatus} layers={layers} totalLayers={total} onViewDetails={() => setShowOverlay(false)} />}
        <TerminalBanner formStatus={data.formStatus} showOverlay={showOverlay} onShowOverlay={() => setShowOverlay(true)} />
        <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />
        <ApprovalChain
          layers={layers} totalLayers={total}
          subject={null}
          customLayerTitles={TNA_LAYER_TITLES}
          customSectionLabels={TNA_SECTION_LABELS}   // ← add
          readOnly
          chainSectionNumber={4}
        />
        <PageFooter />
      </PageShell>
    );
  }

  const myLayer = parseInt(data.userLayer);
  const curLayer = parseInt(data.currentLayer);
  const alreadyDone = myLayer < curLayer;

  if (myLayer > curLayer) return <WaitingForLayersScreen userLayer={myLayer} totalLayers={total} layers={layers} userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;

  return (
    <PageShell>
      {dialog && <ConfirmDialog type={dialog} loading={submitting} userEmail={userEmail} onConfirm={dialog === "approve" ? handleConfirmApprove : handleConfirmReject} onCancel={() => setDialog(null)} />}
      <div style={{ marginBottom: 24 }}>
        <UserBadge userEmail={userEmail} layer={myLayer} total={total} alreadyDone={alreadyDone} onLogout={handleLogout} onSwitch={handleSwitch} />
      </div>
      <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />
      <ApprovalChain
        layers={layers} totalLayers={total}
        myLayer={myLayer} curLayer={curLayer} alreadyDone={alreadyDone}
        subject={null}
        customLayerTitles={TNA_LAYER_TITLES}
        customSectionLabels={TNA_SECTION_LABELS}   // ← add
        submitting={submitting}
        onApprove={handleApproveClick}
        onReject={handleRejectClick}
        chainSectionNumber={4}
      />
      <PageFooter />
    </PageShell>
  );
}