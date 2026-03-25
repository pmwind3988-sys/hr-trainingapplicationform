import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useMsal, useIsAuthenticated, useMsalAuthentication } from "@azure/msal-react";
import { InteractionType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import { getAccessToken } from "../utils/getAccessToken";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

function SkeletonField() {
  return (
    <div style={{ marginBottom: 14 }}>
      <Skeleton width={110} height={11} style={{ marginBottom: 6 }} />
      <Skeleton height={38} radius={6} />
    </div>
  );
}

function SkeletonSection() {
  return (
    <div>
      <Skeleton width={160} height={15} style={{ marginBottom: 14, marginTop: 24 }} />
      <SkeletonField /><SkeletonField /><SkeletonField /><SkeletonField />
    </div>
  );
}

function SkeletonApprovalBox() {
  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "18px 20px", marginBottom: 12, background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Skeleton width={140} height={14} />
        <Skeleton width={80} height={22} radius={20} />
      </div>
      <div style={{ display: "flex", gap: 32 }}>
        <div style={{ flex: 1 }}><Skeleton width={60} height={11} style={{ marginBottom: 6 }} /><Skeleton height={14} /></div>
        <div style={{ flex: 1 }}><Skeleton width={70} height={11} style={{ marginBottom: 6 }} /><Skeleton height={14} /></div>
      </div>
    </div>
  );
}

function PageSkeleton({ userEmail }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ background: "#e8f4fd", border: "1px solid #b3d9f7", borderRadius: 8, padding: "12px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 16, height: 16, border: "2px solid #b3d9f7", borderTop: "2px solid #1a6fa8", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: "#1a6fa8" }}>
          Signed in as <strong>{userEmail}</strong> — Loading application data...
        </span>
      </div>
      <SkeletonSection /><SkeletonSection /><SkeletonSection />
      <hr style={{ margin: "32px 0", borderColor: "#e0e0e0" }} />
      <Skeleton width={140} height={15} style={{ marginBottom: 16 }} />
      <SkeletonApprovalBox /><SkeletonApprovalBox />
    </div>
  );
}

function LoginWaitScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f8fa", padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ width: 44, height: 44, border: "3px solid #e0e0e0", borderTop: "3px solid #1a6fa8", borderRadius: "50%", animation: "spin 0.9s linear infinite", marginBottom: 24 }} />
      <h2 style={{ color: "#1a3c5e", fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Signing you in...</h2>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>Redirecting to Microsoft 365. Please wait.</p>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <Skeleton width={200} height={14} style={{ marginBottom: 14 }} />
          <Skeleton height={36} style={{ marginBottom: 10 }} />
          <Skeleton height={36} style={{ marginBottom: 10 }} />
          <Skeleton height={36} />
        </div>
      </div>
    </div>
  );
}

// ── Screens ───────────────────────────────────────────────────────────────────

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
      {items.map(({ label, value }) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
          <div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function SuccessPage({ userEmail, layer, signedAt }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8fa", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "44px 40px", textAlign: "center", maxWidth: 460, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#2d6a3f", fontWeight: 500, fontSize: 20, marginBottom: 8 }}>Approval Submitted</h2>
        <p style={{ color: "#666", marginBottom: 4, lineHeight: 1.6 }}>Your Layer {layer} signature has been recorded successfully.</p>
        <DetailCard items={[
          { label: "Signed by",      value: userEmail },
          { label: "Approval layer", value: `Layer ${layer}` },
          { label: "Date / Time",    value: new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) },
        ]} />
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 20 }}>You may close this window.</p>
      </div>
    </div>
  );
}

function AlreadySignedPage({ userEmail, layer, signedAt }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8fa", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "44px 40px", textAlign: "center", maxWidth: 460, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <h2 style={{ color: "#1a6fa8", fontWeight: 500, fontSize: 20, marginBottom: 8 }}>Already Approved</h2>
        <p style={{ color: "#666", marginBottom: 4, lineHeight: 1.6 }}>You have already submitted your Layer {layer} approval. This link is now locked.</p>
        <DetailCard items={[
          { label: "Approved by",    value: userEmail },
          { label: "Layer",          value: `Layer ${layer}` },
          { label: "Signed at",      value: signedAt ? new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—" },
        ]} />
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 20 }}>You may close this window.</p>
      </div>
    </div>
  );
}

// ── Read-only form ────────────────────────────────────────────────────────────

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
      <div style={{ padding: "9px 13px", background: "#f7f8fa", borderRadius: 6, border: "1px solid #eaeaea", fontSize: 14, color: "#333", minHeight: 38 }}>{value || "—"}</div>
    </div>
  );
}

function SectionTitle({ number, children }) {
  return (
    <h3 style={{ margin: "28px 0 14px", color: "#1a3c5e", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
      {number && (
        <span style={{ background: "#1a6fa8", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          {number}
        </span>
      )}
      {children}
    </h3>
  );
}

function ReadOnlyForm({ data, formId }) {
  if (!data) return null;
  const fmt = (v) => (v !== undefined && v !== null && v !== "") ? `RM ${parseFloat(v).toFixed(2)}` : "RM 0.00";
  const isYes = (v) => v === true || v === "true" || v === "Yes" || v === 1;

  return (
    <div>
      <div style={{ background: "#f7f8fa", border: "1px solid #eaeaea", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#888" }}>
        Form reference: <strong style={{ color: "#1a3c5e", fontFamily: "monospace" }}>{formId || "—"}</strong>
      </div>
      <SectionTitle number="1">Employee Details</SectionTitle>
      <Field label="Employee Name"     value={data.employeeName} />
      <Field label="Position"          value={data.position} />
      <Field label="Department"        value={data.department} />
      <Field label="Reporting Manager" value={data.reportingManager} />

      <SectionTitle number="2">Training Details</SectionTitle>
      <Field label="Course Name"        value={data.courseName} />
      <Field label="Training Objective" value={data.trainingObjective} />
      <Field label="Training Provider"  value={data.trainingProvider} />
      <Field label="Venue"              value={data.venue} />
      <Field label="Start Date / Time"  value={data.startDate ? new Date(data.startDate).toLocaleString("en-MY") : "—"} />
      <Field label="End Date / Time"    value={data.endDate   ? new Date(data.endDate).toLocaleString("en-MY")   : "—"} />

      <SectionTitle number="3">Cost Breakdown</SectionTitle>
      <Field label="Training Fee"     value={fmt(data.trainingFee)} />
      <Field label="Mileage"          value={fmt(data.mileage)} />
      <Field label="Meal Allowance"   value={fmt(data.mealAllowance)} />
      <Field label="Accommodation"    value={fmt(data.accommodation)} />
      <Field label="Other Cost"       value={fmt(data.otherCost)} />
      <Field label="Total Cost"       value={fmt(data.totalCost)} />
      <Field label="HRDC Application" value={isYes(data.hrdcApplication) ? "Yes" : "No"} />

      <SectionTitle number="4">Submitted By</SectionTitle>
      <Field label="Applicant Name" value={data.applicantName} />
      <Field label="Submitted At"   value={data.submittedAt ? new Date(data.submittedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—"} />
      {data.applicantSignature && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.4px" }}>Applicant Signature</div>
          <div style={{ padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #eaeaea", display: "inline-block" }}>
            <img src={data.applicantSignature} alt="Applicant signature" style={{ maxWidth: 300, maxHeight: 120, display: "block" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approval boxes ────────────────────────────────────────────────────────────

function SignaturePad({ onSign, signing }) {
  const survey = useMemo(() => {
    const m = new Model({
      pages: [{ elements: [{
        type: "signaturepad",
        name: "approver_signature",
        title: "Sign here to approve",
        isRequired: true,
        signatureWidth: 460,
        signatureHeight: 180,
        penColor: "#000000",
      }] }],
      showNavigationButtons: false,
      showCompletedPage: false,
      showTitle: false,
    });
    m.onComplete.add((sender) => onSign(sender.data.approver_signature));
    return m;
  }, [onSign]);

  if (signing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: "#1a6fa8" }}>
        <div style={{ width: 18, height: 18, border: "2px solid #b3d9f7", borderTop: "2px solid #1a6fa8", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
        Submitting your signature...
      </div>
    );
  }
  return <Survey model={survey} />;
}

function ApprovalBox({ layer, email, signedAt, status, isMine, onSign, signing }) {
  const signed = status === "Signed";
  const colors = {
    border: signed ? "#a8d5b0" : isMine ? "#b3d9f7" : "#e0e0e0",
    bg:     signed ? "#e6f4ea" : isMine ? "#e8f4fd" : "#fafafa",
    badge:  signed ? { bg: "#a8d5b0", color: "#1e5c32" } : isMine ? { bg: "#b3d9f7", color: "#0c447c" } : { bg: "#e8e8e8", color: "#888" },
  };

  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 12, background: colors.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: "#1a3c5e" }}>Layer {layer} Approval</div>
        <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 12px", borderRadius: 20, background: colors.badge.bg, color: colors.badge.color }}>
          {signed ? "Signed" : isMine ? "Awaiting your signature" : "Pending"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Approver</div>
          <div style={{ fontSize: 14, color: "#444" }}>{email || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Date / Time Signed</div>
          <div style={{ fontSize: 14, color: "#444" }}>
            {signedAt ? new Date(signedAt).toLocaleString("en-MY", { dateStyle: "long", timeStyle: "short" }) : "—"}
          </div>
        </div>
      </div>

      {signed && (
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>Signature</div>
          <div style={{ padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e0e0e0", display: "inline-block" }}>
            <span style={{ color: "#aaa", fontSize: 13 }}>Signature on file</span>
          </div>
        </div>
      )}

      {isMine && !signed && (
        <div style={{ marginTop: 4 }}>
          <SignaturePad onSign={onSign} signing={signing} />
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ApprovePage() {
  // useMsalAuthentication handles login automatically and correctly
  // It does NOT loop because it checks inProgress state internally
  const { login, error: msalError } = useMsalAuthentication(InteractionType.Redirect, loginRequest);
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // status: idle | loading | ready | signing | done | already_signed | unauthorized | error
  const [status,     setStatus]     = useState("idle");
  const [data,       setData]       = useState(null);
  const [signResult, setSignResult] = useState(null);
  const [errorMsg,   setErrorMsg]   = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  // Show error if MSAL itself fails
  useEffect(() => {
    if (msalError) {
      console.error("MSAL error:", msalError);
      // Don't show error for interaction_in_progress — that's normal during redirect
      if (msalError.errorCode !== "interaction_in_progress") {
        setStatus("error");
        setErrorMsg("Microsoft login failed. Please close this tab and try the link again.");
      }
    }
  }, [msalError]);

  // Once authenticated, call Power Automate fetch flow
  useEffect(() => {
    // Wait until MSAL is fully done (not in the middle of a redirect)
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    if (!token || accounts.length === 0) return;
    if (status !== "idle") return; // only run once

    const userEmail = accounts[0].username;
    setStatus("loading");

    // Get Bearer token first, then call Power Automate
    
    getAccessToken(instance, accounts).then((accessToken) => {
      const headers = {
        "Content-Type": "application/json",
        //...(accessToken && { "Authorization": `Bearer ${accessToken}` }),
      };

      fetch(process.env.REACT_APP_FLOW_URL_FETCH, {
        method: "POST",
        headers,
        body: JSON.stringify({ token, userEmail }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d) => {
          if (d.alreadySigned) {
            setData(d);
            setStatus("already_signed");
            return;
          }
          if (!d.authorized) {
            setStatus("unauthorized");
            setErrorMsg(d.message || "You are not authorised to view this application.");
            return;
          }
          setData(d);
          setStatus("ready");
        })
        .catch((e) => {
          console.error("Fetch flow error:", e);
          setStatus("error");
          setErrorMsg("Unable to load the application. Please try again or contact HR.");
        });
    });
  }, [isAuthenticated, inProgress, accounts, token, status, instance]);

  // Submit signature
  const handleSign = useCallback(async (signature) => {
    if (!data || !accounts.length) return;
    const userEmail = accounts[0].username;
    const signedAt  = new Date().toISOString();
    setStatus("signing");

    try {
      const accessToken = await getAccessToken(instance, accounts);
      const headers = {
        "Content-Type": "application/json",
        //...(accessToken && { "Authorization": `Bearer ${accessToken}` }),
      };

      const res = await fetch(process.env.REACT_APP_FLOW_URL_SIGN, {
        method: "POST",
        headers,
        body: JSON.stringify({ token, userEmail, userLayer: data.userLayer, signature, signedAt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSignResult({ signedAt });
      setStatus("done");
    } catch (e) {
      console.error("Sign flow error:", e);
      setStatus("error");
      setErrorMsg("Failed to submit your signature. Please try again or contact HR.");
    }
  }, [data, token, accounts, instance]);

  const userEmail = accounts[0]?.username || "";

  // ── Render states ─────────────────────────────────────────

  // Still logging in or MSAL processing redirect
  if (!isAuthenticated || inProgress !== InteractionStatus.None) {
    return <LoginWaitScreen />;
  }

  if (status === "idle" || status === "loading") {
    return <PageSkeleton userEmail={userEmail} />;
  }

  if (status === "unauthorized") {
    return <Screen icon="🔒" title="Access Denied" message={errorMsg} color="#a93226" />;
  }

  if (status === "error") {
    return (
      <Screen icon="❌" title="Something Went Wrong" message={errorMsg} color="#a93226">
        <button
          onClick={() => { setStatus("idle"); window.location.reload(); }}
          style={{ background: "#1a6fa8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}
        >
          Try again
        </button>
      </Screen>
    );
  }

  if (status === "already_signed") {
    const layerData = data?.[`l${data?.userLayer}`];
    return <AlreadySignedPage userEmail={userEmail} layer={data?.userLayer} signedAt={layerData?.signedAt} />;
  }

  if (status === "done") {
    return <SuccessPage userEmail={userEmail} layer={data?.userLayer} signedAt={signResult?.signedAt} />;
  }

  // ── Main form view ────────────────────────────────────────

  const { submissionData, formId, totalLayers, userLayer, currentLayer, l1, l2, l3 } = data;
  const layers = [l1, l2, l3].slice(0, parseInt(totalLayers));
  const isSigning = status === "signing";
  const alreadySignedThisLayer = parseInt(userLayer) < parseInt(currentLayer);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ background: "#e8f4fd", border: "1px solid #b3d9f7", borderRadius: 8, padding: "12px 18px", marginBottom: 28, fontSize: 14, color: "#1a6fa8", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span>Signed in as <strong>{userEmail}</strong>{" — "}{alreadySignedThisLayer ? `You already approved this (Layer ${userLayer})` : `You are the Layer ${userLayer} approver`}</span>
        <span style={{ fontSize: 11, background: "#b3d9f7", color: "#0c447c", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>
          Layer {userLayer} of {totalLayers}
        </span>
      </div>

      <ReadOnlyForm data={submissionData} formId={formId} />

      <hr style={{ margin: "32px 0", borderColor: "#e0e0e0" }} />

      <SectionTitle number="5">Approval</SectionTitle>

      {layers.map((layer, i) => {
        const layerNum = i + 1;
        const isMine   = parseInt(userLayer) === layerNum && parseInt(currentLayer) === layerNum && !alreadySignedThisLayer;
        return (
          <ApprovalBox
            key={layerNum}
            layer={layerNum}
            email={layer?.email}
            signedAt={layer?.signedAt}
            status={layer?.status}
            isMine={isMine}
            onSign={isMine ? handleSign : null}
            signing={isMine && isSigning}
          />
        );
      })}

      {alreadySignedThisLayer && (
        <div style={{ background: "#e6f4ea", border: "1px solid #a8d5b0", borderRadius: 8, padding: "12px 18px", marginTop: 8, color: "#2d6a3f", fontSize: 14 }}>
          You have already approved this application. Waiting for other approvers to complete.
        </div>
      )}
    </div>
  );
}