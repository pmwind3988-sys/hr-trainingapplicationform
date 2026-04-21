import React, { useMemo, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { LayeredDarkPanelless, LayeredLightPanelless } from "survey-core/themes";
import "survey-core/survey-core.min.css";
import SuccessScreen from "../utils/successScreen";
import {
  globalStyles, useDarkTokens, useBodyTheme,
  PageHeader, DocumentHeader, StatusMessages, FormFooter,
  mountSignatureQuestion, useSignatureCleanup, useSurveyEvent
} from "./FormShared";
import { ratingMatrixToHtml } from "../utils/ratingMatrixToHtml";
import { useFormAuth, LoggedInBanner, GuestBanner } from "../formAuthWrapper";

const FORM_ID = "3";
const FORM_VERSION = "1.0";
const FORM_TITLE = "TRAINING EVALUATION FORM";

// ─── Survey definition ────────────────────────────────────────────────────────
const surveyJson = {
  checkErrorsMode: "onValueChanged",
  textUpdateMode: "onTyping",
  title: FORM_TITLE,
  pages: [
    {
      name: "page1",
      elements: [
        // ── Employee Details ──────────────────────────────────────────────────
        {
          type: "panel",
          name: "employee_details",
          title: "1. Employee Details",
          state: "expanded",
          elements: [
            {
              type: "text",
              name: "employee_name",
              title: "Employee Name",
              isRequired: true,
            },
            {
              type: "text",
              name: "employee_id",
              title: "Employee ID",
              isRequired: true,
              startWithNewLine: false,
            },
            {
              type: "text",
              name: "position",
              title: "Position",
              isRequired: true,
            },
            {
              type: "dropdown",
              name: "department",
              title: "Department",
              isRequired: true,
              startWithNewLine: false,
              choices: ["HR", "Finance", "IT", "Logistics", "Accounting"],
            },
          ],
        },

        // ── Training Details ──────────────────────────────────────────────────
        {
          type: "panel",
          name: "training_details",
          title: "2. Training Details",
          state: "expanded",
          elements: [
            {
              type: "text",
              name: "training_title",
              title: "Training Title",
              isRequired: true,
            },
            {
              type: "text",
              name: "date_and_duration",
              title: "Date & Duration",
              isRequired: true,
              startWithNewLine: false,
            },
            {
              type: "comment",
              name: "training_objective",
              title: "Training Objective",
              isRequired: true,
            },
            {
              type: "radiogroup",
              name: "training_type",
              title: "Training Type",
              isRequired: true,
              colCount: 0,
              startWithNewLine: false,
              choices: [
                { value: "in-house", text: "In-house" },
                { value: "external", text: "External" },
              ],
            },
          ],
        },

        // ── Section A: Contents of the Course ────────────────────────────────
        {
          type: "panel",
          name: "contents_section",
          title: "3. Contents of the Course",
          description:
            "Please rate the following aspects on a scale of 1 – 4, where: 1 = Disagree, 2 = Neutral, 3 = Agree, 4 = Strongly Agree",
          state: "expanded",
          elements: [
            {
              type: "matrix",
              name: "course_contents_rating",
              title: "Rate each item:",
              titleLocation: "hidden",
              isRequired: true,
              columns: [
                { value: 1, text: "1 – Disagree" },
                { value: 2, text: "2 – Neutral" },
                { value: 3, text: "3 – Agree" },
                { value: 4, text: "4 – Strongly Agree" },
              ],
              rows: [
                {
                  value: "facilities",
                  text: "The training room and facilities were adequate and comfortable",
                },
                {
                  value: "time_allocated",
                  text: "The time allocated for the training was sufficient",
                },
                {
                  value: "assessment_methods",
                  text: "The assessment methods used were fair and relevant",
                },
                {
                  value: "questions_opportunity",
                  text: "There were opportunities to ask questions and seek clarifications",
                },
                {
                  value: "interaction",
                  text: "The training encouraged interaction and engagement",
                },
              ],
            },
            {
              type: "radiogroup",
              name: "overall_rating",
              title: "Overall rating of the Training Program:",
              isRequired: true,
              colCount: 0,
              choices: [
                { value: "excellent", text: "Excellent" },
                { value: "good", text: "Good" },
                { value: "fair", text: "Fair" },
                { value: "poor", text: "Poor" },
              ],
            },
          ],
        },

        // ── Section B: Effectiveness of the Training ──────────────────────────
        {
          type: "panel",
          name: "effectiveness_section",
          title: "4. Effectiveness of the Training",
          description:
            "Please rate the following aspects on a scale of 1 – 4, where: 1 = Disagree, 2 = Neutral, 3 = Agree, 4 = Strongly Agree",
          state: "expanded",
          elements: [
            {
              type: "matrix",
              name: "effectiveness_rating",
              title: "Rate each item:",
              titleLocation: "hidden",
              isRequired: true,
              columns: [
                { value: 1, text: "1 – Disagree" },
                { value: 2, text: "2 – Neutral" },
                { value: 3, text: "3 – Agree" },
                { value: 4, text: "4 – Strongly Agree" },
              ],
              rows: [
                {
                  value: "objectives_met",
                  text: "The objectives of the training were met and clearly stated",
                },
                {
                  value: "relevant_to_job",
                  text: "The training was relevant to my job role / I can apply what I learned in my day-to-day work",
                },
                {
                  value: "improve_skills",
                  text: "The training was relevant to improve the knowledge/skills I need to accomplish my job",
                },
                {
                  value: "appropriate_level",
                  text: "The course information was at an appropriate level to understand the learning objectives",
                },
              ],
            },
          ],
        },

        // ── Comments / Feedback ───────────────────────────────────────────────
        {
          type: "panel",
          name: "feedback_section",
          title: "5. Comments / Feedback",
          state: "expanded",
          elements: [
            {
              type: "comment",
              name: "comments_feedback",
              title: "Comments / Feedback",
              titleLocation: "hidden",
              placeholder: "Enter any comments or feedback here…",
              rows: 5,
            },
          ],
        },

        // ── Acknowledgement ───────────────────────────────────────────────────
        {
          type: "panel",
          name: "acknowledgement_section",
          title: "6. Acknowledgement",
          state: "expanded",
          elements: [
            {
              type: "signaturepad",
              name: "employee_signature",
              title: "Employee Signature",
              isRequired: true,
              signatureWidth: 400,
              signatureHeight: 200,
              penColor: "#000000",
            },
            {
              type: "text",
              name: "acknowledgement_date",
              title: "Date",
              readOnly: true,
              startWithNewLine: false,
            },
          ],
        },
      ],
    },
  ],
};

// ─── Page component ───────────────────────────────────────────────────────────
export default function FormPage() {
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isDark, setIsDark] = useState(false);
  useBodyTheme(isDark);
  const signatureRoots = useRef([]);
  const lastDataRef = useRef(null);
  const navigate = useNavigate();
  const { bg } = useDarkTokens(isDark);
  const { userEmail, authState, onLogin, onLogout } = useFormAuth();

  const survey = useMemo(() => new Model(surveyJson), []);

  // Apply SurveyJS theme on dark toggle
  React.useEffect(() => {
    survey.applyTheme(isDark ? LayeredDarkPanelless : LayeredLightPanelless);
  }, [isDark, survey]);

  // Live clock for acknowledgement date
  React.useEffect(() => {
    const interval = setInterval(() => {
      const formatted = new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      survey.setValue("acknowledgement_date", formatted);
    }, 1000);
    return () => clearInterval(interval);
  }, [survey]);

  // ── Wire up events directly like Form 2 ──────────────────────────────────
  const onAfterRenderQuestion = useCallback((_, options) => {
    mountSignatureQuestion(options, signatureRoots, "Employee Signature");
  }, []);
  survey.onAfterRenderQuestion.add(onAfterRenderQuestion);
  survey.showCompletedPage = false;
  useSignatureCleanup(signatureRoots);

  const onCompleting = useCallback((sender) => {
    lastDataRef.current = { ...sender.data };
  }, []);

  // Submit handler — reads sender.data directly like Form 2, no lastDataRef needed
  const onComplete = useCallback(
    async (sender) => {
      setSubmitStatus("loading");
      try {
        const data = lastDataRef.current ?? {};

        // Row label mappings to make the HTML table readable
        const contentLabels = {
          facilities: "Facilities & Comfort",
          time_allocated: "Time Sufficiency",
          assessment_methods: "Fairness of Assessment",
          questions_opportunity: "Opportunity for Q&A",
          interaction: "Engagement & Interaction"
        };

        const effectivenessLabels = {
          objectives_met: "Objectives clearly stated/met",
          relevant_to_job: "Relevant to job role",
          improve_skills: "Improved knowledge/skills",
          appropriate_level: "Appropriate learning level"
        };

        const payload = {
          ...data,
          contents_html: ratingMatrixToHtml(data.course_contents_rating, contentLabels),
          effectiveness_html: ratingMatrixToHtml(data.effectiveness_rating, effectivenessLabels),
          acknowledgement_date: new Date().toISOString(),
          formId: FORM_ID,
          formVersion: FORM_VERSION,
          submittedAt: new Date().toISOString(),
          baseUrl: window.location.origin,
          submittedByEmail: userEmail ?? "",
        };

        const res = await fetch(process.env.REACT_APP_FLOW_3, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setSubmitStatus("success");
        } else {
          setSubmitStatus("error");
          sender.clear(false, false);
          sender.start();
          Object.entries(lastDataRef.current).forEach(([k, v]) => sender.setValue(k, v));
        }
      } catch {
        setSubmitStatus("error");
        sender.clear(false, false);
        sender.start();
        Object.entries(lastDataRef.current).forEach(([k, v]) => sender.setValue(k, v));
      }
    },
    [userEmail]
  );
  useSurveyEvent(survey, survey.onCompleting, onCompleting);   // ← add this
  useSurveyEvent(survey, survey.onComplete, onComplete);
  useSurveyEvent(survey, survey.onAfterRenderQuestion, onAfterRenderQuestion);

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.3s" }}>
      <style>{globalStyles}</style>
      <PageHeader
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
        title={FORM_TITLE}
      />

      {/* 2. Auth banner — rendered HERE, after PageHeader, so it's never above it.
                            The banner itself is sticky at top:56px so it stays pinned while scrolling. */}
      {authState === "loggedin" && <LoggedInBanner userEmail={userEmail} onLogout={onLogout} />}
      {authState === "guest" && <GuestBanner onLogin={onLogin} />}

      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "28px 24px",
          animation: "fadeUp 0.3s ease",
        }}
      >
        {submitStatus === "success" ? (
          <SuccessScreen onBack={() => navigate("/")} />
        ) : (
          <>
            <DocumentHeader
              formTitle={FORM_TITLE}
              formVersion={FORM_VERSION}
              formId={FORM_ID}
              isDark={isDark}
            />
            <Survey model={survey} />
            <StatusMessages status={submitStatus} />
          </>
        )}

        <FormFooter isDark={isDark} />
      </div>
    </div>
  );
}