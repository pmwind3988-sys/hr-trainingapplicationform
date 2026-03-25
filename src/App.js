import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import HrTrainAppPage from "./pages/HrTrainingApplication";
import ApprovePage from "./pages/ApprovalPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/hr-training-application-form" element={<HrTrainAppPage />} />

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