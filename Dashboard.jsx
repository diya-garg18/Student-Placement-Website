import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api.js";
import "../styles/dashboard.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [resumes, setResumes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/profile/me");
        setUser(res.data.user);
      } catch {
        navigate("/login");
      }
    };
    fetchProfile();
  }, [navigate]);

  const fetchResumes = async () => {
    const res = await api.get("/resume/history");
    setResumes(res.data);
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim()) return alert("Please paste your resume text!");
    setLoading(true);
    try {
      const res = await api.post("/resume/upload", { resumeText });
      setAnalysis(res.data);
      setResumeText("");
      fetchResumes();
    } catch {
      alert("Error analyzing resume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2>My Dashboard</h2>
        {user && <p className="logged-in">Logged in as <b>{user.name}</b></p>}
        <ul className="sidebar-menu">
          <li onClick={() => setActiveTab("dashboard")}>🏠 Overview</li>
          <li onClick={() => { setActiveTab("resumes"); fetchResumes(); }}>📄 My Resumes</li>
          <li>🏆 Certifications</li>
          <li>⚙️ Settings</li>
        </ul>
        <button className="logout-btn" onClick={async ()=>{await api.post("/auth/logout");navigate("/login");}}>
          Logout
        </button>
      </aside>

      <main className="main-content">
        {activeTab === "dashboard" && (
          <>
            <h1>Welcome, {user ? user.name : "User"}!</h1>
            <div className="card-grid">
              <div className="card">
                <h3>📤 Upload & Analyze Resume</h3>
                <p>Paste your resume text and get analysis instantly.</p>
                <div className="analyze-section">
                  <textarea
                    placeholder="Paste your resume text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <button onClick={handleAnalyze} disabled={loading}>
                    {loading ? "Analyzing..." : "Analyze"}
                  </button>
                </div>
                {analysis && (
  <div className="analysis-result">
    <h3>Resume Readiness Score: {analysis.score}/100</h3>
    <pre>{analysis.feedback}</pre>
    <button
      onClick={() => setAnalysis(null)}
      style={{
        marginTop: "10px",
        background: "#e11d48",
        color: "white",
        border: "none",
        borderRadius: "6px",
        padding: "8px 12px",
        cursor: "pointer",
      }}
    >
      Clear Result
    </button>
  </div>
)}

              </div>

              <div className="card">
                <h3>💼 Match Resume with Job Description</h3>
                <p>Paste a job description and check your compatibility.</p>
                <button>Match Now</button>
              </div>
            </div>
          </>
        )}

        {activeTab === "resumes" && (
          <div className="resumes-page">
            <h2>My Uploaded Resumes</h2>
            {resumes.length === 0 && <p>No resumes analyzed yet.</p>}
            {resumes.map((r) => (
              <details key={r.id} className="resume-item">
                <summary>
                  <span>Resume #{r.id}</span>
                  <span className="score-tag">{r.readiness_score}/100</span>
                </summary>
                <div className="resume-details">
                  <p><strong>Date:</strong> {new Date(r.created_at).toLocaleString()}</p>
                  <p><strong>Feedback:</strong></p>
                  <pre>{r.feedback}</pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
