import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useMsal, useIsAuthenticated, useMsalAuthentication } from "@azure/msal-react";
import { InteractionType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

import {
  C, globalStyles, fmtDate, fmtCurrency, isYes,
  buildLayers,
  Btn, Field, SectionDivider,
  LoginWaitScreen, PageSkeleton, Screen,
  PageShell, PageFooter,
  UserBadge, ApprovalChain,
} from "./ApprovalShared";

// ── Constants ─────────────────────────────────────────────────────────────────
const FORM_LABELS = {
  "1": "Training Requisition",
  "2": "Training Needs Analysis",
};

const STATUS_FILTERS = [
  "All",
  "Pending",
  "In Review",
  "Approved",
  "Fully Approved",
  "Rejected",
];

const STATUS_STYLE = {
  "Fully Approved": { bg: "#eaf3de", color: "#3b6d11" },
  "Approved":       { bg: "#eaf3de", color: "#3b6d11" },
  "In Review":      { bg: "#EEEDFE", color: "#3C3489" },
  "Pending":        { bg: "#FAEEDA", color: "#854F0B" },
  "Rejected":       { bg: "#FCEBEB", color: "#A32D2D" },
};

const FORM_TAG_STYLE = {
  "1": { bg: "#E6F1FB", color: "#185FA5" },
  "2": { bg: "#E1F5EE", color: "#0F6E56" },
};

// ── Styles (shared across sub-components) ─────────────────────────────────────
const S = {
  card: {
    background: C.white,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: "hidden",
    boxShadow: C.shadow,
  },
  cardHeader: {
    background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
    padding: "16px 22px",
  },
  input: {
    fontFamily: "inherit",
    fontSize: 13,
    color: C.text,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    outline: "none",
    width: "100%",
  },
  select: {
    fontFamily: "inherit",
    fontSize: 13,
    color: C.text,
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    outline: "none",
    cursor: "pointer",
  },
  statCard: {
    background: C.bg,
    borderRadius: 10,
    padding: "12px 16px",
    flex: 1,
    minWidth: 0,
    border: `1px solid ${C.border}`,
  },
};

// ── ReadOnlyForm (mirrors TrainReqApprovePage's version) ─────────────────────
function ReadOnlyForm({ data, formId, formVersion }) {
  if (!data) return null;

  if (formId === "2") {
    return (
      <div style={{ ...S.card }}>
        <div style={S.cardHeader}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
            Training Needs Analysis
          </div>
          <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>
            Version: <strong style={{ fontFamily: "monospace" }}>{formVersion || "—"}</strong>
          </div>
        </div>
        <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
          <SectionDivider number={1} title="Department Info" />
          <Field label="Department"    value={data.department} />
          <Field label="Year"          value={data.year} />
          <Field label="HOD Name"      value={data.hod_name} />
          <Field label="Designation"   value={data.hod_designation} />
          <Field label="HOD Date"      value={fmtDate(data.hod_date)} />
          <Field label="Submitted At"  value={fmtDate(data.submittedAt)} />
          {data.training_needs_html && (
            <div style={{ gridColumn: "1 / -1" }}>
              <SectionDivider number={2} title="Training Needs Table" />
              <div
                style={{ marginTop: 8, padding: 12, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, overflowX: "auto" }}
                dangerouslySetInnerHTML={{ __html: data.training_needs_html }}
              />
            </div>
          )}
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

  // Form 1 — Training Requisition
  const totalCost = [data.trainingFee, data.mileage, data.mealAllowance, data.accommodation, data.otherCost]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0)
    .toFixed(2);

  return (
    <div style={{ ...S.card }}>
      <div style={{ ...S.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
            Training Requisition Form
          </div>
          <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>
            Form ID: <strong style={{ fontFamily: "monospace" }}>#{data.formId || "—"}</strong>
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
        <Field label="Employee Name"     value={data.employeeName} />
        <Field label="Position"          value={data.position} />
        <Field label="Department"        value={data.department} />
        <Field label="Reporting Manager" value={data.reportingManager} />

        <SectionDivider number={2} title="Training Details" />
        <Field label="Course Name"        value={data.courseName} />
        <Field label="Training Provider"  value={data.trainingProvider} />
        <Field label="Start Date / Time"  value={fmtDate(data.startDate)} />
        <Field label="End Date / Time"    value={fmtDate(data.endDate)} />
        <Field label="Training Objective" value={data.trainingObjective} full />
        <Field label="Venue"              value={data.venue} full />

        <SectionDivider number={3} title="Cost Breakdown" />
        <Field label="Training Fee"        value={fmtCurrency(data.trainingFee)} />
        <Field label="Mileage / Transport" value={fmtCurrency(data.mileage)} />
        <Field label="Meal Allowance"      value={fmtCurrency(data.mealAllowance)} />
        <Field label="Accommodation"       value={fmtCurrency(data.accommodation)} />
        <Field label="Other Cost"          value={fmtCurrency(data.otherCost)} />
        <Field label="HRDC Claimable"      value={isYes(data.hrdcApplication) ? "Yes" : "No"} />
        <Field label="Total Cost"          value={`RM ${totalCost}`} full highlight />

        <SectionDivider number={4} title="Submitted By" />
        <Field label="Applicant Name" value={data.applicantName} />
        <Field label="Submitted At"   value={fmtDate(data.submittedAt)} />
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

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={S.statCard}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || C.text }}>
        {value}
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const style = STATUS_STYLE[status] || { bg: C.bg, color: C.textMuted };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20,
      padding: "4px 12px", background: style.bg, color: style.color,
      border: `1px solid ${style.color}30`, whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

// ── Form Tag ──────────────────────────────────────────────────────────────────
function FormTag({ formId }) {
  const style = FORM_TAG_STYLE[formId] || { bg: C.bg, color: C.textMuted };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, borderRadius: 4,
      padding: "2px 7px", background: style.bg, color: style.color,
    }}>
      {FORM_LABELS[formId] || "Form"}
    </span>
  );
}

// ── Submission Row ────────────────────────────────────────────────────────────
function SubmissionRow({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      style={{
        width: "100%", textAlign: "left", background: "transparent",
        border: "none", borderBottom: `1px solid ${C.border}`,
        padding: "14px 20px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 14,
        transition: "background 0.12s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.bg}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Left: info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {item.title || `Submission ${item.submissionId}`}
          </span>
          <FormTag formId={item.formId} />
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>#{item.submissionId}</span>
          <span>·</span>
          <span>v{item.formVersion || "—"}</span>
          <span>·</span>
          <span>{item.totalLayers ? `${item.totalLayers}-layer approval` : ""}</span>
          <span>·</span>
          <span>{fmtDate(item.submittedAt)}</span>
        </div>
      </div>

      {/* Right: status + chevron */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <StatusBadge status={item.formStatus} />
        <span style={{ fontSize: 18, color: C.textMuted, lineHeight: 1 }}>›</span>
      </div>
    </button>
  );
}

// ── Filter Chip ───────────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, borderRadius: 20, padding: "5px 12px",
        border: `1px solid ${active ? C.purple : C.border}`,
        background: active ? C.purple : "transparent",
        color: active ? C.white : C.textMuted,
        cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({ items, onRowClick, userEmail, onLogout, onSwitch }) {
  const [search, setSearch]         = useState("");
  const [activeStatus, setStatus]   = useState("All");
  const [sort, setSort]             = useState("date-desc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let data = [...items];

    if (activeStatus !== "All") {
      data = data.filter(i => i.formStatus === activeStatus);
    }

    if (q) {
      data = data.filter(i =>
        (i.title || "").toLowerCase().includes(q) ||
        (i.submissionId || "").toLowerCase().includes(q) ||
        (FORM_LABELS[i.formId] || "").toLowerCase().includes(q)
      );
    }

    if (sort === "date-desc") data.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    else if (sort === "date-asc") data.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    else if (sort === "status")   data.sort((a, b) => (a.formStatus || "").localeCompare(b.formStatus || ""));
    else if (sort === "title")    data.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    return data;
  }, [items, search, activeStatus, sort]);

  // Stats (always from full unfiltered list)
  const totalCount    = items.length;
  const pendingCount  = items.filter(i => ["Pending", "In Review"].includes(i.formStatus)).length;
  const approvedCount = items.filter(i => ["Approved", "Fully Approved"].includes(i.formStatus)).length;
  const rejectedCount = items.filter(i => i.formStatus === "Rejected").length;

  return (
    <PageShell>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <UserBadge userEmail={userEmail} onLogout={onLogout} onSwitch={onSwitch} />
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Total Submissions" value={totalCount} />
        <StatCard label="Pending / In Review" value={pendingCount} color="#854F0B" />
        <StatCard label="Approved" value={approvedCount} color="#3b6d11" />
        <StatCard label="Rejected" value={rejectedCount} color="#A32D2D" />
      </div>

      {/* Search + Sort row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by title, submission ID, form type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...S.input, flex: 1, minWidth: 200 }}
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{ ...S.select, minWidth: 160 }}
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="status">By status</option>
          <option value="title">By title A–Z</option>
        </select>
      </div>

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(s => (
          <FilterChip
            key={s}
            label={s}
            active={activeStatus === s}
            onClick={() => setStatus(s)}
          />
        ))}
      </div>

      {/* List */}
      <div style={{ ...S.card }}>
        {/* Card header */}
        <div style={{ ...S.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
              My Submissions
            </div>
            <div style={{ fontSize: 15, color: C.white, fontFamily: "'DM Serif Display', serif" }}>
              {filtered.length} of {totalCount} submission{totalCount !== 1 ? "s" : ""}
            </div>
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {userEmail}
          </span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No submissions match your search or filter.
          </div>
        ) : (
          <div>
            {filtered.map((item, idx) => (
              <div key={item.id} style={{ ...(idx === filtered.length - 1 ? { borderBottom: "none" } : {}) }}>
                <SubmissionRow item={item} onClick={onRowClick} />
              </div>
            ))}
          </div>
        )}
      </div>

      <PageFooter />
    </PageShell>
  );
}

// ── Detail View (read-only) ───────────────────────────────────────────────────
function DetailView({ item, userEmail, onLogout, onSwitch, onBack }) {
  const [detailData, setDetailData] = useState(null);
  const [detailStatus, setDetailStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setDetailStatus("loading");
    setDetailData(null);

    fetch(process.env.REACT_APP_FLOW_URL_FETCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail,
        submissionId: item.submissionId,
        formId: item.formId,
        mode: "readonly",
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setDetailData(data);
        setDetailStatus("ready");
      })
      .catch(err => {
        setErrorMsg(err.message || "Failed to load submission details.");
        setDetailStatus("error");
      });
  }, [item.submissionId, item.formId, userEmail]);

  // ── Back button (always visible) ───────────────────────────────────────────
  const BackBtn = (
    <div style={{ marginBottom: 20 }}>
      <UserBadge userEmail={userEmail} onLogout={onLogout} onSwitch={onSwitch} />
      <button
        onClick={onBack}
        style={{
          marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: C.purple, background: "transparent",
          border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
        }}
      >
        ← Back to my submissions
      </button>
    </div>
  );

  if (detailStatus === "loading") {
    return (
      <PageShell>
        {BackBtn}
        <PageSkeleton userEmail={userEmail} />
      </PageShell>
    );
  }

  if (detailStatus === "error") {
    return (
      <PageShell>
        {BackBtn}
        <Screen icon="❌" title="Failed to Load" message={errorMsg} color={C.red}>
          <Btn onClick={onBack} variant="primary">Go back</Btn>
        </Screen>
      </PageShell>
    );
  }

  const { submissionData, formId, formVersion, totalLayers } = detailData;
  const total  = parseInt(totalLayers || 1);
  const layers = buildLayers(detailData, total);

  return (
    <PageShell>
      {BackBtn}

      {/* Read-only form — identical to approval page */}
      <ReadOnlyForm
        data={submissionData}
        formId={formId}
        formVersion={formVersion}
      />

      {/* Approval chain — readOnly disables all action buttons */}
      <ApprovalChain
        layers={layers}
        totalLayers={total}
        subject={submissionData?.subject}
        readOnly
        chainSectionNumber={formId === "2" ? 2 : 5}
      />

      <PageFooter />
    </PageShell>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardViewPage() {
  const { error: msalError } = useMsalAuthentication(InteractionType.Redirect, loginRequest);
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [status, setStatus]     = useState("idle");
  const [items, setItems]       = useState([]);
  const [selected, setSelected] = useState(null); // lightweight item from list
  const [errorMsg, setErrorMsg] = useState("");

  const userEmail = accounts[0]?.username || "";

  const handleLogout = useCallback(() => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.href });
  }, [instance]);

  const handleSwitch = useCallback(() => {
    instance
      .logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.href, onRedirectNavigate: () => false })
      .catch(() => instance.loginRedirect({ ...loginRequest, prompt: "select_account" }));
  }, [instance, accounts]);

  // MSAL error guard
  useEffect(() => {
    if (msalError && msalError.errorCode !== "interaction_in_progress") {
      setStatus("error");
      setErrorMsg(msalError.message || "Authentication error.");
    }
  }, [msalError]);

  // Fetch lightweight list once authenticated
  useEffect(() => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    if (accounts.length === 0 || status !== "idle") return;

    setStatus("loading");

    fetch(process.env.REACT_APP_FLOW_DASHBOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: accounts[0].username }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
        setStatus("ready");
      })
      .catch(err => {
        setErrorMsg(err.message || "Failed to load your submissions.");
        setStatus("error");
      });
  }, [isAuthenticated, inProgress, accounts, status]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!isAuthenticated || inProgress !== InteractionStatus.None) {
    return <LoginWaitScreen />;
  }

  if (status === "idle" || status === "loading") {
    return <PageSkeleton userEmail={userEmail} />;
  }

  if (status === "error") {
    return (
      <Screen icon="❌" title="Something Went Wrong" message={errorMsg} color={C.red}>
        <Btn onClick={() => { setStatus("idle"); }} variant="primary">Try again</Btn>
      </Screen>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    return (
      <DetailView
        item={selected}
        userEmail={userEmail}
        onLogout={handleLogout}
        onSwitch={handleSwitch}
        onBack={() => setSelected(null)}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <ListView
      items={items}
      onRowClick={setSelected}
      userEmail={userEmail}
      onLogout={handleLogout}
      onSwitch={handleSwitch}
    />
  );
}