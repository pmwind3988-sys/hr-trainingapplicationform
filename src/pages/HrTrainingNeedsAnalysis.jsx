import React, { useMemo, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { LayeredDarkPanelless, LayeredLightPanelless } from "survey-core/themes";
import "survey-core/survey-core.min.css";
import SuccessScreen from "../utils/successScreen";
import {
  globalStyles, useDarkTokens, useBodyTheme,   // ← add useBodyTheme
  PageHeader, DocumentHeader, BackButton, StatusMessages, FormFooter,
  mountSignatureQuestion, useSignatureCleanup,
} from "./FormShared";

const FORM_ID = "2";
const FORM_VERSION = "1.0";
const FORM_TITLE = "TRAINING NEEDS ANALYSIS FORM";


const surveyJson = {
  checkErrorsMode: "onValueChanged",
  textUpdateMode: "onTyping",
  title: FORM_TITLE,
  pages: [{
    name: "page1",
    elements: [
      { type: "dropdown", name: "department", title: "Department", isRequired: true, choices: ["HR", "Finance", "IT", "Logistics", "Accounting"] },
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
        titleLocation: "hidden",
        addRowText: "Add Row",
        showIndexColumn: true, indexColumnHeader: "No.",
        columns: [
          { name: "employee_no", title: "Emp. ID", cellType: "text", isRequired: true },
          { name: "trainee_name", title: "Name", cellType: "text", isRequired: true },
          { name: "training_needs", title: "Training Needs", cellType: "comment", isRequired: true },
          { name: "current_skill_level", title: "Current Skill Level", cellType: "checkbox", choices: ["Low", "Medium", "High"], maxSelectedChoices: 1, minSelectedChoices: 1 },
          { name: "required_skill_level", title: "Required Skill Level", cellType: "checkbox", choices: ["Low", "Medium", "High"], maxSelectedChoices: 1, minSelectedChoices: 1 },
          { name: "priority", title: "Priority", cellType: "checkbox", choices: ["Low", "Medium", "High"], maxSelectedChoices: 1, minSelectedChoices: 1 },
          { name: "relevance_to_job_function", title: "Please state relevancy to the job function", cellType: "comment" },
          { name: "tentative_date", title: "Tentative Date", cellType: "comment" },
        ],
        rowCount: 1, minRowCount: 1,
      },
      {
        type: "panel", name: "preparedby_section", title: "Prepared By",
        elements: [
          { type: "text", name: "hod_name", title: "Name of HOD", isRequired: true, startWithNewLine: false },
          { type: "text", name: "hod_designation", title: "Designation", isRequired: true, startWithNewLine: false },
          {
            type: "text",
            name: "hod_date",
            title: "Date",
            readOnly: true
          },
          { type: "signaturepad", name: "hod_signature", title: "Signature", isRequired: true, signatureWidth: 400, signatureHeight: 200, penColor: "#000000" },
        ]
      }
    ]
  }]
};


export default function FormPage() {
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isDark, setIsDark] = useState(false);
  useBodyTheme(isDark);
  const signatureRoots = useRef([]);
  const navigate = useNavigate();
  const { bg } = useDarkTokens(isDark);

  const survey = useMemo(() => new Model(surveyJson), []);

  React.useEffect(() => { survey.applyTheme(isDark ? LayeredDarkPanelless : LayeredLightPanelless); }, [isDark, survey]);

  const onAfterRenderQuestion = useCallback((_, options) => {
    mountSignatureQuestion(options, signatureRoots, "HOD Signature");
  }, []);
  survey.onAfterRenderQuestion.add(onAfterRenderQuestion);
  survey.showCompletedPage = false;
  useSignatureCleanup(signatureRoots);

  React.useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();

    const formatted = now.toLocaleString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true // 24-hour format (optional)
    });

    survey.setValue("hod_date", formatted);
  }, 1000);

  return () => clearInterval(interval);
}, [survey]);

  const onComplete = useCallback(async (sender) => {
    setSubmitStatus("loading");
    try {
      const res = await fetch(process.env.REACT_APP_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sender.data, hod_date: new Date().toISOString(), formId: FORM_ID, formVersion: FORM_VERSION, submittedAt: new Date().toISOString(), baseUrl: window.location.origin }),
      });
      setSubmitStatus(res.ok ? "success" : "error");
    } catch { setSubmitStatus("error"); }
  }, []);
  survey.onComplete.add(onComplete);

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.3s" }}>
      <style>{globalStyles}</style>
      <PageHeader isDark={isDark} onToggleDark={() => setIsDark(d => !d)} title={FORM_TITLE} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>

        {submitStatus === "success" ? (
          <SuccessScreen onBack={() => navigate("/")} />
        ) : (
          <>
            <BackButton onClick={() => navigate("/")} isDark={isDark} />
            <DocumentHeader formTitle={FORM_TITLE} formVersion={FORM_VERSION} formId={FORM_ID} isDark={isDark} />
            <Survey model={survey} />
            <StatusMessages status={submitStatus} />
          </>
        )}

        <FormFooter isDark={isDark} />
      </div>
    </div>
  );
}
