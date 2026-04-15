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
  mountSignatureQuestion, useSignatureCleanup, useSurveyEvent,
} from "./FormShared";
import { useFormAuth } from "../formAuthContext";

const FORM_ID = "1";
const FORM_VERSION = "1.0";
const FORM_TITLE = "TRAINING REQUISITION FORM";

const toUTC = (localDateTime) => {
  if (!localDateTime) return null;
  return new Date(localDateTime).toISOString();
};


const surveyJson = {
  checkErrorsMode: "onValueChanged",
  textUpdateMode: "onTyping",
  title: FORM_TITLE,
  pages: [{
    name: "page1",
    elements: [
      {
        type: "panel", name: "employeeDetails", state: "expanded", title: "1. Employee Details",
        elements: [
          { type: "text", name: "employeeName", title: "Employee Name", isRequired: true },
          { type: "text", name: "position", title: "Position", isRequired: true },
          { type: "dropdown", name: "department", title: "Department", isRequired: true, startWithNewLine: false, choices: ["HR", "Finance", "IT", "Logistics", "Accounting"] },
          { type: "text", name: "reportingManager", title: "Reporting Manager", isRequired: true },
        ]
      },
      {
        type: "panel", name: "trainingDetails", state: "collapsed", title: "2. Training Details",
        elements: [
          { type: "text", name: "courseName", title: "Course Name", isRequired: true },
          { type: "comment", name: "trainingObjective", title: "Training Objective", isRequired: true },
          { type: "text", name: "trainingProvider", title: "Training Provider", isRequired: true },
          { type: "comment", name: "venue", title: "Venue", isRequired: true },
          { type: "text", inputType: "datetime-local", name: "startDate", min: "today", title: "Start Date/Time", isRequired: true, validators: [{ type: "expression", expression: "{startDate} > today()", text: "Date Invalid" }] },
          { type: "text", inputType: "datetime-local", name: "endDate", min: "today", title: "End Date/Time", isRequired: true, startWithNewLine: false, validators: [{ type: "expression", expression: "{endDate} > today()", text: "Date Invalid" }] },
        ]
      },
      {
        type: "panel", name: "cost", state: "collapsed", title: "3. Cost",
        elements: [
          {
            type: "multipletext", name: "cost_details", titleLocation: "hidden", colCount: 1,
            items: [
              { name: "training_fee", title: "Training Fee (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
              { name: "mileage", title: "Mileage / Transportation Fees (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
              { name: "meal_allowance", title: "Meals Allowance X days of training (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
              { name: "accommodation", title: "Accommodation (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
              { name: "other_cost", title: "Other Cost (Toll / Parking) (RM)", inputType: "number", step: 0.01, validators: [{ type: "numeric", text: "Enter a valid amount (e.g. 10.50)" }] },
            ]
          },
          {
            type: "expression", name: "total_cost", title: "Total Cost (RM)",
            expression: "({cost_details.training_fee} || 0) + ({cost_details.mileage} || 0) + ({cost_details.meal_allowance} || 0) + ({cost_details.accommodation} || 0) + ({cost_details.other_cost} || 0)",
            displayStyle: "currency", currency: "MYR",
          }
        ]
      },
      {
        type: "radiogroup", name: "hrdc_application", title: "4. HRDC Claimable",
        choices: [{ value: "true", text: "Yes" }, { value: "false", text: "No" }],
        colCount: 0, isRequired: true,
      },
      {
        type: "panel", name: "approval_section", title: "5. Requested By",
        elements: [
          { type: "signaturepad", name: "applicant_signature", title: "Applicant Signature", isRequired: true, signatureWidth: 400, signatureHeight: 200, penColor: "#000000" },
          { type: "text", name: "applicant_name", title: "Full Name", isRequired: true, startWithNewLine: false },
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
  const { userEmail } = useFormAuth();

  const survey = useMemo(() => new Model(surveyJson), []);

  // Apply SurveyJS theme on dark toggle
  React.useEffect(() => { survey.applyTheme(isDark ? LayeredDarkPanelless : LayeredLightPanelless); }, [isDark, survey]);

  // Mount custom signature widget
  const onAfterRenderQuestion = useCallback((_, options) => {
    mountSignatureQuestion(options, signatureRoots, "Applicant Signature");
  }, []);
  survey.onAfterRenderQuestion.add(onAfterRenderQuestion);
  survey.showCompletedPage = false;
  useSignatureCleanup(signatureRoots);

  // Submit
  const onComplete = useCallback(async (sender) => {
    setSubmitStatus("loading");
    try {
      const res = await fetch(process.env.REACT_APP_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sender.data,
          startDate: toUTC(sender.data.startDate),
          endDate: toUTC(sender.data.endDate),
          formId: FORM_ID,
          formVersion: FORM_VERSION,
          submittedAt: new Date().toISOString(),
          baseUrl: window.location.origin,
          ...(userEmail && { submittedByEmail: userEmail }),
        }),
      });
      setSubmitStatus(res.ok ? "success" : "error");
    } catch {
      setSubmitStatus("error");
    }
  }, [userEmail]); // ← add userEmail here
  useSurveyEvent(survey, survey.onComplete, onComplete);
  useSurveyEvent(survey, survey.onAfterRenderQuestion, onAfterRenderQuestion);

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.3s" }}>
      <style>{globalStyles}</style>
      <PageHeader isDark={isDark} onToggleDark={() => setIsDark(d => !d)} title={FORM_TITLE} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>

        {submitStatus === "success" ? (
          <SuccessScreen onBack={() => navigate("/")} />
        ) : (
          <>
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