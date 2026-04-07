import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import HrTrainReqPage from "./pages/HrTrainingRequisition";
import HrTrainNeedsIdenPage from "./pages/HrTrainingNeedsAnalysis";
import ApprovePage from "./pages/TrainReqApprovalPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/hr-training-requisition-form" element={<HrTrainReqPage />} />
        <Route path="/hr-training-needs-identification-form" element={<HrTrainNeedsIdenPage />} />
        {/* Approval page — requires M365 login (handled inside ApprovePage) */}
        {/* Accessed via link in email: /approve?token=<guid> */}
        <Route path="/approve" element={<ApprovePage />} />
 
        {/* Catch-all — redirect unknown routes to home */}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Router>
  );
}

export default App;