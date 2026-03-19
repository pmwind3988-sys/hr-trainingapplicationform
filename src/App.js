import React, { useMemo, useCallback, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";

const surveyJson = {
  title: "HR Training Application Form",
  pages: [
    {
      name: "page1",
      elements: [
        {
          type: "panel",
          name: "Employee Details",
          state: "expanded",
          title: "1. Employee Details",
          elements:[
            {
              type: "text",
              name: "Employee Name",
              isRequired: "true"
            },
            {
              type: "text",
              name: "Position",
              isRequired: "true"
            },
            {
              type: "dropdown",
              name: "Department",
              isRequired: "true",
              choices: ["HR", "Finance", "IT", "Logistics", "Accounting"]
            }
          ]
        },
        {
          type: "comment",
          name: "message",
          title: "Your Message"
        }
      ]
    }
  ]
};

function App() {
  const [submitStatus, setSubmitStatus] = useState(null); // null | "loading" | "success" | "error"

  const survey = useMemo(() => new Model(surveyJson), []);

  const onComplete = useCallback(async (sender) => {
    const results = sender.data;
    console.log("Survey results:", results);
    console.log("Flow URL:", process.env.REACT_APP_FLOW_URL); // ADD THIS LINE
    setSubmitStatus("loading");

    try {
      const response = await fetch(process.env.REACT_APP_FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(results)
      });

      if (response.ok) {
        setSubmitStatus("success");
        console.log("Submitted to Power Automate successfully!");
      } else {
        setSubmitStatus("error");
        console.error("Power Automate returned an error:", response.status);
      }
    } catch (error) {
      setSubmitStatus("error");
      console.error("Network error submitting to Power Automate:", error);
    }
  }, []);

  survey.onComplete.add(onComplete);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <Survey model={survey} />

      {submitStatus === "loading" && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "#e8f4fd",
          border: "1px solid #b3d9f7",
          borderRadius: "8px",
          color: "#1a6fa8",
          textAlign: "center"
        }}>
          ⏳ Submitting your response, please wait...
        </div>
      )}

      {submitStatus === "success" && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "#e6f4ea",
          border: "1px solid #a8d5b0",
          borderRadius: "8px",
          color: "#2d6a3f",
          textAlign: "center"
        }}>
          ✅ Your response has been submitted successfully!
        </div>
      )}

      {submitStatus === "error" && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "#fdecea",
          border: "1px solid #f5b7b1",
          borderRadius: "8px",
          color: "#a93226",
          textAlign: "center"
        }}>
          ❌ Something went wrong. Please try again or contact support.
        </div>
      )}
    </div>
  );
}

export default App;