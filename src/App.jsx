import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "./routes";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import HomePage from "./pages/HomePage";
import HrTrainReqPage from "./pages/HrTrainingRequisition";
import HrTrainNeedsIdenPage from "./pages/HrTrainingNeedsAnalysis";
import HrTrainEvaluationPage from "./pages/HrTrainingEvaluation";
import TrainReqApprovePage from "./pages/TrainReqApprovalPage";
import TrainNeedsApprovePage from "./pages/TrainNeedsApprovalPage";
import TrainEvaluateApprovePage from "./pages/TrainEvaluateApprovalPage";
import FormAuthWrapper from "./formAuthWrapper";
import AdminFormBuilder from "./pages/AdminFormBuilder";
import DynamicFormPage from "./pages/DynamicFormPage";


function TitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = ROUTES.find(r => pathname.startsWith(r.path) && r.path !== "/")
      ?? ROUTES.find(r => r.path === "/");
    document.title = match?.title ?? "PMW HR Forms";
  }, [pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <TitleManager />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/hr-training-requisition-form"
          element={
            <FormAuthWrapper formTitle="Training Requisition Form">
              <HrTrainReqPage />
            </FormAuthWrapper>
          }
        />
        <Route
          path="/hr-training-needs-analysis-form"
          element={
            <FormAuthWrapper formTitle="Training Needs Analysis Form">
              <HrTrainNeedsIdenPage />
            </FormAuthWrapper>
          }
        />
        <Route
          path="/hr-training-evaluation-form"
          element={
            <FormAuthWrapper formTitle="Training Evaluation Form">
              <HrTrainEvaluationPage />
            </FormAuthWrapper>
          }
        />
        <Route path="/approve-hr1" element={<TrainReqApprovePage />} />
        <Route path="/approve-hr2" element={<TrainNeedsApprovePage />} />
        <Route path="/approve-hr3" element={<TrainEvaluateApprovePage />} />
        <Route path="/admin/builder" element={<AdminFormBuilder />} />
        <Route path="/admin/builder/:formTitle" element={<AdminFormBuilder />} />
        <Route path="/forms/:slug" element={<DynamicFormPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;