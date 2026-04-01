import React from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f0f4f8",
      fontFamily: "Segoe UI, sans-serif",
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        padding: "48px 40px",
        maxWidth: "500px",
        width: "100%",
        boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
        <h1 style={{ color: "#1a3c5e", marginBottom: "8px" }}>PMW HR Form</h1>
        <p style={{ color: "#666", marginBottom: "32px", lineHeight: "1.6" }}>
          Select your destination.
        </p>
        <button
          onClick={() => navigate("/hr-training-application-form")}
          style={{
            backgroundColor: "#1a6fa8",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "14px 32px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            width: "100%",
            transition: "background-color 0.2s"
          }}
          onMouseOver={e => e.target.style.backgroundColor = "#155a8a"}
          onMouseOut={e => e.target.style.backgroundColor = "#1a6fa8"}
        >
          Training Application Form →
        </button>
        {/* ✅ New Button */}
<button
  onClick={() => navigate("/hr-training-needs-identification-form")}
  style={{
    backgroundColor: "#2d6a3f",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px 32px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    marginTop: "12px", // 👈 spacing
    transition: "background-color 0.2s"
  }}
  onMouseOver={e => e.target.style.backgroundColor = "#245732"}
  onMouseOut={e => e.target.style.backgroundColor = "#2d6a3f"}
>
  Training Needs Identification Form →
</button>
      </div>
    </div>
    
  );
}

export default HomePage;