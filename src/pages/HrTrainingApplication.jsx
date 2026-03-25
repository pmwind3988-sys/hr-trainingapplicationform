import React, { useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";

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
            {
              type: "text",
              name: "employeeName",
              title: "Employee Name",
              isRequired: "true"
            },
            {
              type: "text",
              name: "position",
              title: "Position",
              isRequired: "true"
            },
            {
              type: "dropdown",
              name: "department",
              title: "Department",
              isRequired: "true",
              choices: ["HR", "Finance", "IT", "Logistics", "Accounting"]
            },
            {
              type: "text",
              name: "reportingManager",
              title: "Reporting Manager",
              isRequired: "true"
            }
          ]
        },
        {
          type: "panel",
          name: "Training Details",
          state: "collapsed",
          title: "2. Training Details",
          elements: [
            {
              type: "text",
              name: "courseName",
              title: "Course Name",
              isRequired: "true"
            },
            {
              type: "comment",
              name: "trainingObjective",
              title: "Training Objective",
              isRequired: "true"
            },
            {
              type: "text",
              name: "trainingProvider",
              title: "Training Provider",
              isRequired: "true"
            },
            {
              type: "comment",
              name: "venue",
              title: "Venue",
              isRequired: "true"
            },
            {
              type: "text",
              inputType: "datetime-local",
              name: "startDate",
              min: "today",
              title: "Start Date/Time",
              isRequired: "true",
              validators: [
                {
                  type: "expression",
                  expression: "{startDate} > today()",
                  text: "Date Invalid",
                  notificationType: "error"
                }
              ]
            },
            {
              type: "text",
              inputType: "datetime-local",
              name: "endDate",
              min: "today",
              title: "End Date/Time",
              isRequired: "true",
              validators: [
                {
                  type: "expression",
                  expression: "{endDate} > today()",
                  text: "Date Invalid",
                  notificationType: "error"
                }
              ]
            }
          ]
        },
        {
          type: "panel",
          name: "cost",
          state: "expanded",
          title: "3. Cost",
          elements: [
            {
              type: "multipletext",
              name: "cost_details",
              titleLocation: "hidden",
              colCount: 1,
              items: [
                {
                  name: "training_fee",
                  title: "Training Fee (RM)",
                  inputType: "number",
                  step: 0.01,
                  validators: [
                    {
                      type: "numeric",
                      text: "Enter a valid amount (e.g. 10.50)",
                      notificationType: "error"
                    }
                  ]
                },
                {
                  name: "mileage",
                  title: "Travelling Cost: Mileage (RM)",
                  inputType: "number",
                  step: 0.01,
                  validators: [
                    {
                      type: "numeric",
                      text: "Enter a valid amount (e.g. 10.50)",
                      notificationType: "error"
                    }
                  ]

                },
                {
                  name: "meal_allowance",
                  title: "Travelling Cost: Meals Allowance (RM)",
                  inputType: "number",
                  step: 0.01,
                  validators: [
                    {
                      type: "numeric",
                      text: "Enter a valid amount (e.g. 10.50)",
                      notificationType: "error"
                    }
                  ]

                },
                {
                  name: "accommodation",
                  title: "Accommodation (RM)",
                  inputType: "number",
                  step: 0.01,
                  validators: [
                    {
                      type: "numeric",
                      text: "Enter a valid amount (e.g. 10.50)",
                      notificationType: "error"
                    }
                  ]
                },
                {
                  name: "other_cost",
                  title: "Other Cost (RM)",
                  inputType: "number",
                  step: 0.01,
                  validators: [
                    {
                      type: "numeric",
                      text: "Enter a valid amount (e.g. 10.50)",
                      notificationType: "error"
                    }
                  ]
                }
              ]
            },
            {
              type: "expression",
              name: "total_cost",
              title: "Total Cost (RM)",
              // Note: We sum all 5 specific items now
              expression: "({cost_details.training_fee} || 0) + ({cost_details.mileage} || 0) + ({cost_details.meal_allowance} || 0) + ({cost_details.accommodation} || 0) + ({cost_details.other_cost} || 0)",
              displayStyle: "currency",
              currency: "MYR"
            }
          ]
        },
        {
          type: "radiogroup",
          name: "hrdc_application",
          title: "HRDC Application?",
          "choices": [
            { "value": "true", "text": "Yes" },
            { "value": "false", "text": "No" }
          ],
          colCount: 0, // This puts them side-by-side
          isRequired: true
        },
        {
          "type": "panel",
          "name": "approval_section",
          "title": "Approved By",
          "elements": [
            {
              "type": "signaturepad",
              "name": "applicant_signature",
              "title": "Applicant Signature",
              "isRequired": true,
              "signatureWidth": 400,
              "signatureHeight": 200,
              "penColor": "#000000" // Standard black ink
            },
            {
              "type": "text",
              "name": "applicant_name",
              "title": "Full Name",
              "isRequired": true,
              "startWithNewLine": false // Puts the name next to the signature if space allows
            }
          ]
        }
      ]
    }
  ]
};

function FormPage() {
  const [submitStatus, setSubmitStatus] = useState(null);
  const navigate = useNavigate();

  const survey = useMemo(() => new Model(surveyJson), []);

  const onComplete = useCallback(async (sender) => {
    const results = sender.data;
    setSubmitStatus("loading");

    try {
      const response = await fetch(process.env.REACT_APP_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(results)
      });

      if (response.ok) {
        setSubmitStatus("success");
      } else {
        setSubmitStatus("error");
      }
    } catch (error) {
      setSubmitStatus("error");
    }
  }, []);

  survey.onComplete.add(onComplete);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>

      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        style={{
          background: "none",
          border: "1px solid #ccc",
          borderRadius: "6px",
          padding: "8px 16px",
          cursor: "pointer",
          marginBottom: "16px",
          color: "#555",
          fontSize: "14px"
        }}
      >
        ← Back to Home
      </button>

      <Survey model={survey} />

      {submitStatus === "loading" && (
        <div style={{
          marginTop: "20px", padding: "16px",
          backgroundColor: "#e8f4fd", border: "1px solid #b3d9f7",
          borderRadius: "8px", color: "#1a6fa8", textAlign: "center"
        }}>
          ⏳ Submitting your response, please wait...
        </div>
      )}

      {submitStatus === "success" && (
        <div style={{
          marginTop: "20px", padding: "16px",
          backgroundColor: "#e6f4ea", border: "1px solid #a8d5b0",
          borderRadius: "8px", color: "#2d6a3f", textAlign: "center"
        }}>
          ✅ Your response has been submitted successfully!
        </div>
      )}

      {submitStatus === "error" && (
        <div style={{
          marginTop: "20px", padding: "16px",
          backgroundColor: "#fdecea", border: "1px solid #f5b7b1",
          borderRadius: "8px", color: "#a93226", textAlign: "center"
        }}>
          ❌ Something went wrong. Please try again or contact support.
        </div>
      )}
    </div>
  );
}

export default FormPage;