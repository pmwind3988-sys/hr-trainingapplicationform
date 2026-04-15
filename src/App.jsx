import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import HomePage               from "./pages/HomePage";
import HrTrainReqPage         from "./pages/HrTrainingRequisition";
import HrTrainNeedsIdenPage   from "./pages/HrTrainingNeedsAnalysis";
import TrainReqApprovePage    from "./pages/TrainReqApprovalPage";
import TrainNeedsApprovePage  from "./pages/TrainNeedsApprovalPage";
import FormAuthWrapper        from "./formAuthWrapper";

function App() {
  return (
    <Router>
      <Routes>

        {/* ── Dashboard (M365 login enforced inside HomePage) ── */}
        <Route path="/" element={<HomePage />} />

        {/* ── Public forms with optional login prompt ── */}
        <Route
          path="/hr-training-requisition-form"
          element={
            <FormAuthWrapper formTitle="Training Requisition Form">
              <HrTrainReqPage />
            </FormAuthWrapper>
          }
        />
        <Route
          path="/hr-training-needs-identification-form"
          element={
            <FormAuthWrapper formTitle="Training Needs Analysis Form">
              <HrTrainNeedsIdenPage />
            </FormAuthWrapper>
          }
        />

        {/* ── Approval pages (M365 login enforced inside each page) ── */}
        {/* Accessed via emailed link: /approve-hr1?token=<guid> */}
        <Route path="/approve-hr1" element={<TrainReqApprovePage />} />
        <Route path="/approve-hr2" element={<TrainNeedsApprovePage />} />

        {/* ── Catch-all → home ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;