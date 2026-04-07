export default function SuccessScreen({ onBack }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f8fa",
      padding: 20
    }}>
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "48px 40px",
        textAlign: "center",
        maxWidth: 420,
        width: "100%",
        boxShadow: "0 6px 28px rgba(0,0,0,0.08)"
      }}>
        
        {/* Animated check */}
        <div style={{
          fontSize: 60,
          marginBottom: 20,
          animation: "pop 0.5s ease-out"
        }}>
          ✅
        </div>

        <h2 style={{
          color: "#2d6a3f",
          fontWeight: 600,
          marginBottom: 10,
          animation: "fadeUp 0.5s ease-out"
        }}>
          Submission Successful
        </h2>

        <p style={{
          color: "#666",
          marginBottom: 24,
          lineHeight: 1.6,
          animation: "fadeUp 0.7s ease-out"
        }}>
          Your form has been submitted successfully.
          You may close this page or return home.
        </p>

        <button
          onClick={onBack}
          style={{
            background: "#1a6fa8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 26px",
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}