import React, { useEffect, useCallback } from "react";
import { useMsal, useIsAuthenticated, useMsalAuthentication } from "@azure/msal-react";
import { InteractionType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

import {
  // tokens / helpers
  C, globalStyles, isAllowedTenant, fmtDate, fmtCurrency, isYes,
  buildLayers, layerIsApproved, layerIsRejected, deriveFormStatus,
  // primitives
  Btn, Field, SectionDivider,
  // screens
  PageSkeleton, Screen,
  SuccessPage, AlreadySignedPage, WrongTenantScreen, WaitingForLayersScreen,
  // chrome
  PageShell, PageFooter,
  // approval UI
  UserBadge, StatusOverlayModal, ConfirmDialog,
  ApprovalChain, TerminalBanner,
  // hook
  useApprovalPage,
  PrintPreviewButton,
} from "./ApprovalShared";

// ── Blocking M365 Login Prompt ────────────────────────────────────────────────
function ApprovalLoginPrompt({ onLogin, loading }) {
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite }}>
      <style>{globalStyles}</style>

      {/* Minimal header */}
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

      {/* Centred card */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "60px 20px", minHeight: "calc(100vh - 56px)",
      }}>
        <div style={{
          background: C.white, borderRadius: 16, padding: "40px 36px",
          maxWidth: 420, width: "100%", boxShadow: `0 8px 40px rgba(91,33,182,0.16)`,
          border: `1px solid ${C.border}`, textAlign: "center",
          animation: "fadeUp 0.3s ease",
        }}>

          {/* Lock icon */}
          <div style={{
            width: 60, height: 60, borderRadius: 14, margin: "0 auto 20px",
            background: C.purplePale, border: `1px solid ${C.purpleMid}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke={C.purple} strokeWidth="1.5" />
              <path d="M7 11V7a5 5 0 0110 0v4" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.5" fill={C.purple} />
            </svg>
          </div>

          <h2 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400,
            color: C.textPrimary, marginBottom: 10,
          }}>
            Sign in to approve
          </h2>

          <p style={{
            color: C.textSecond, fontSize: 13, lineHeight: 1.75, marginBottom: 10,
          }}>
            This approval portal requires a <strong>Microsoft 365 organisational account</strong>.
            Your identity is used to verify your approver role and record your decision.
          </p>

          {/* Info strip */}
          <div style={{
            background: C.purplePale, border: `1px solid ${C.purpleMid}`,
            borderRadius: 10, padding: "12px 16px", marginBottom: 28,
            display: "flex", flexDirection: "column", gap: 8, textAlign: "left",
          }}>
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

          {/* Sign in button */}
          <button
            onClick={onLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: 9,
              background: loading ? C.purpleMid : C.purple,
              color: C.white, border: "none",
              fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "background 0.2s",
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)",
                  borderTop: "2px solid white", borderRadius: "50%",
                  animation: "spin 0.9s linear infinite", flexShrink: 0,
                }} />
                Redirecting to Microsoft…
              </>
            ) : (
              <>
                {/* Microsoft logo */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="1" y="1" width="6.5" height="6.5" fill="#F25022" />
                  <rect x="8.5" y="1" width="6.5" height="6.5" fill="#7FBA00" />
                  <rect x="1" y="8.5" width="6.5" height="6.5" fill="#00A4EF" />
                  <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFB900" />
                </svg>
                Sign in with Microsoft 365
              </>
            )}
          </button>

          <p style={{ color: C.textMuted, fontSize: 11, marginTop: 18, lineHeight: 1.6 }}>
            Guest access is not available for approval pages.<br />
            You must sign in with your organisational account to proceed.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Form-specific ReadOnlyForm ────────────────────────────────────────────────
function ReadOnlyForm({ data, formId, formVersion }) {
  if (!data) return null;

  const totalCost = [data.trainingFee, data.mileage, data.mealAllowance, data.accommodation, data.otherCost]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0)
    .toFixed(2);

  return (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadow }}>
      <div style={{ background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Training Requisition Form</div>
          <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>
            Form ID: <strong style={{ fontFamily: "monospace" }}>#{formId || "—"}</strong>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Submitted: {fmtDate(data.submittedAt)}</div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 11, color: C.purpleMid, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)" }}>
            Version: {formVersion || "—"}
          </span>
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
        <Field label="Start Date / Time" value={fmtDate(data.startDate)} />
        <Field label="End Date / Time" value={fmtDate(data.endDate)} />
        <Field label="Training Objective" value={data.trainingObjective} full />
        <Field label="Venue" value={data.venue} full />

        <SectionDivider number={3} title="Cost Breakdown" />
        <Field label="Training Fee" value={fmtCurrency(data.trainingFee)} />
        <Field label="Mileage / Transport" value={fmtCurrency(data.mileage)} />
        <Field label="Meal Allowance" value={fmtCurrency(data.mealAllowance)} />
        <Field label="Accommodation" value={fmtCurrency(data.accommodation)} />
        <Field label="Other Cost" value={fmtCurrency(data.otherCost)} />
        <Field label="HRDC Claimable" value={isYes(data.hrdcApplication) ? "Yes" : "No"} />
        <Field label="Total Cost" value={`RM ${totalCost}`} full highlight />

        <SectionDivider number={4} title="Submitted By" />
        <Field label="Applicant Name" value={data.applicantName} />
        <Field label="Submitted At" value={fmtDate(data.submittedAt)} />
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrainReqApprovePage() {
  // Don't auto-redirect — we want to show our own login prompt instead
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [loginLoading, setLoginLoading] = React.useState(false);

  const {
    status, setStatus, data, signResult, errorMsg,
    dialog, setDialog, pendingSig, submitting,
    showOverlay, setShowOverlay,
    retryFnRef,
    load, submitAction,
    handleApproveClick, handleRejectClick,
  } = useApprovalPage({
    fetchUrl: process.env.REACT_APP_FLOW_URL_FETCH,
    signUrl: process.env.REACT_APP_FLOW_URL_SIGN,
  });

  const userEmail = accounts[0]?.username || "";

  const handleLogin = useCallback(() => {
    setLoginLoading(true);
    instance.loginRedirect({ ...loginRequest, prompt: "select_account" });
  }, [instance]);

  const handleLogout = useCallback(() => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.href });
  }, [instance]);

  const handleSwitch = useCallback(() => {
    instance
      .logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.href, onRedirectNavigate: () => false })
      .catch(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account" }));
  }, [instance, accounts]);

  // Trigger data fetch once authenticated
  useEffect(() => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    if (accounts.length === 0 || status !== "idle") return;
    load({
      userEmail: accounts[0].username,
      isAllowed: isAllowedTenant(accounts[0]),
    });
  }, [isAuthenticated, inProgress, accounts, status, load]);

  const handleConfirmApprove = useCallback(() =>
    submitAction({
      action: "approved",
      signature: pendingSig,
      userEmail,
      userLayer: data?.userLayer,
      formId: data?.formId,
      submissionID: data?.submissionID,
    }), [submitAction, pendingSig, userEmail, data]);

  const handleConfirmReject = useCallback((reason) =>
    submitAction({
      action: "rejected",
      rejectionReason: reason,
      userEmail,
      userLayer: data?.userLayer,
      formId: data?.formId,
      submissionID: data?.submissionID,
    }), [submitAction, userEmail, data]);

  // ── Not signed in → show our blocking login prompt ────────────────────────
  if (!isAuthenticated && inProgress === InteractionStatus.None) {
    return <ApprovalLoginPrompt onLogin={handleLogin} loading={loginLoading} />;
  }

  // ── MSAL in-flight (redirect being processed) → spinner ──────────────────────
  if (inProgress !== InteractionStatus.None) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
        <style>{globalStyles}</style>
        <div style={{
          width: 20, height: 20, border: `2px solid ${C.purpleMid}`,
          borderTop: `2px solid ${C.purple}`, borderRadius: "50%",
          animation: "spin 0.9s linear infinite", marginBottom: 16,
        }} />
        <p style={{ color: C.textMuted, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Signing you in…</p>
      </div>
    );
  }

  // ── Not signed in → show blocking login prompt ────────────────────────────────
  if (!isAuthenticated) {
    return <ApprovalLoginPrompt onLogin={handleLogin} loading={loginLoading} />;
  }

  // ── Authenticated but data still loading ──────────────────────────────────
  if (status === "idle" || status === "loading") return <PageSkeleton userEmail={userEmail} />;

  // ── Error / access states ─────────────────────────────────────────────────
  if (status === "wrong_tenant") return <WrongTenantScreen userEmail={userEmail} onLogout={handleLogout} onSwitch={handleSwitch} />;
   if (status === "unauthorized") return (
      <Screen icon="🔒" title="Access Denied" message={errorMsg} color={C.red}>
        <Btn onClick={handleLogout} variant="ghost">🚪 Sign out</Btn>
      </Screen>
    );
  if (status === "unassigned") return (
    <Screen icon="⚠️" title="No Subject Assigned" color={C.amber}
      message="This training application has not been assigned a subject (Managerial / Non-Managerial). Please contact HR to update the form before approval can proceed." />
  );
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

  // ── Outcome screens ───────────────────────────────────────────────────────
  if (status === "done") return (
    <SuccessPage userEmail={userEmail} layer={data?.userLayer} signedAt={signResult?.signedAt} action={signResult?.action} />
  );
  if (status === "already_signed") {
    const ld = data?.[`l${data?.userLayer}`];
    return (
      <AlreadySignedPage
        userEmail={userEmail}
        signedEmail={ld?.email || userEmail}
        layer={data?.userLayer}
        signedAt={ld?.signedAt}
        action={ld?.outcome || ld?.status}
        rejectionReason={ld?.rejectionReason}
      />
    );
  }
  if (!data) return null;

  const { submissionData, formId, formVersion, totalLayers } = data;
  const total = parseInt(totalLayers);
  const layers = buildLayers(data, total);

  // ── Terminal state ────────────────────────────────────────────────────────
  if (status === "terminal") {
  const d = submissionData;
  const totalCost = [d.trainingFee, d.mileage, d.mealAllowance, d.accommodation, d.otherCost]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2);

  const printSections = [
    {
      title: "Employee Details",
      fields: [
        { label: "Employee Name",     value: d.employeeName },
        { label: "Position",          value: d.position },
        { label: "Department",        value: d.department },
        { label: "Reporting Manager", value: d.reportingManager },
      ],
    },
    {
      title: "Training Details",
      fields: [
        { label: "Course Name",        value: d.courseName,        full: true },
        { label: "Training Provider",  value: d.trainingProvider,  full: true },
        { label: "Start Date / Time",  value: fmtDate(d.startDate) },
        { label: "End Date / Time",    value: fmtDate(d.endDate) },
        { label: "Venue",              value: d.venue,             full: true },
        { label: "Training Objective", value: d.trainingObjective, full: true },
      ],
    },
    {
      title: "Cost Breakdown",
      fields: [
        { label: "Training Fee",        value: fmtCurrency(d.trainingFee) },
        { label: "Mileage / Transport", value: fmtCurrency(d.mileage) },
        { label: "Meal Allowance",      value: fmtCurrency(d.mealAllowance) },
        { label: "Accommodation",       value: fmtCurrency(d.accommodation) },
        { label: "Other Cost",          value: fmtCurrency(d.otherCost) },
        { label: "HRDC Claimable",      value: isYes(d.hrdcApplication) ? "Yes" : "No" },
        { label: "Total Cost",          value: `RM ${totalCost}`, highlight: true, full: true },
      ],
    },
    {
      title: "Applicant Declaration",
      fields: [
        { label: "Applicant Name", value: d.applicantName },
        { label: "Submitted At",   value: fmtDate(d.submittedAt) },
        { label: "Applicant Signature", value: d.applicantSignature, type: "signature", full: true },
      ],
    },
  ];

  return (
    <PageShell>
      {showOverlay && (
        <StatusOverlayModal formStatus={data.formStatus} layers={layers} totalLayers={total} onViewDetails={() => setShowOverlay(false)} />
      )}
      <TerminalBanner formStatus={data.formStatus} showOverlay={showOverlay} onShowOverlay={() => setShowOverlay(true)} />

      {/* ── Print button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <PrintPreviewButton
          formTitle="Training Requisition Form"
          formId={formId}
          formVersion={formVersion}
          submittedAt={d.submittedAt}
          formStatus={data.formStatus}
          sections={printSections}
          layers={layers}
          totalLayers={total}
          subject={d.subject}
        />
      </div>

      <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />
      <ApprovalChain layers={layers} totalLayers={total} subject={submissionData?.subject} readOnly chainSectionNumber={5} />
      <PageFooter />
    </PageShell>
  );
}

  // ── Normal ready state ────────────────────────────────────────────────────
  const myLayer = parseInt(data.userLayer);
  const curLayer = parseInt(data.currentLayer);
  const alreadyDone = myLayer < curLayer;

  if (myLayer > curLayer) {
    return (
      <WaitingForLayersScreen
        userLayer={myLayer}
        totalLayers={total}
        layers={layers}
        userEmail={userEmail}
        onLogout={handleLogout}
        onSwitch={handleSwitch}
      />
    );
  }

  return (
    <PageShell>
      {dialog && (
        <ConfirmDialog
          type={dialog}
          loading={submitting}
          userEmail={userEmail}   // ← add this
          onConfirm={dialog === "approve" ? handleConfirmApprove : handleConfirmReject}
          onCancel={() => setDialog(null)}
        />
      )}
      <div style={{ marginBottom: 24 }}>
        <UserBadge userEmail={userEmail} layer={myLayer} total={total} alreadyDone={alreadyDone} onLogout={handleLogout} onSwitch={handleSwitch} />
      </div>
      <ReadOnlyForm data={submissionData} formId={formId} formVersion={formVersion} />
      <ApprovalChain
        layers={layers} totalLayers={total}
        myLayer={myLayer} curLayer={curLayer} alreadyDone={alreadyDone}
        subject={submissionData?.subject}
        submitting={submitting}
        onApprove={handleApproveClick}
        onReject={handleRejectClick}
        chainSectionNumber={5}
      />
      <PageFooter />
    </PageShell>
  );
}