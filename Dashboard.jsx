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
const [jobDescription, setJobDescription] = useState("");
const [matchResult, setMatchResult] = useState(null);

const handleMatch = async () => {
  if (!resumeText.trim() || !jobDescription.trim()) {
    return alert("Please paste both resume and job description!");
  }
  setLoading(true);
  try {
    const res = await api.post("/resume/match", { resumeText, jobDescription });
    setMatchResult(res.data.data);
  } catch {
    alert("Error matching resume and job description");
  } finally {
    setLoading(false);
  }
};

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
  useEffect(() => {
  // Reset everything when page refreshes
  setResumeText("");
  setJobDescription("");
  setAnalysis(null);
  setMatchResult(null);
  setActiveTab("dashboard");
}, []);


const handleAnalyze = async () => {
  if (!resumeText.trim()) return alert("Please paste your resume text!");
  setLoading(true);
  try {
    const res = await api.post("/resume/upload", { resumeText });

    const result = {
      score: res.data.score || 0,
      feedback: res.data.feedback || "No feedback available.",
    };

    setAnalysis(result); // ✅ only keep needed fields
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
    <div
      style={{
        background: "#f3f4f6",
        borderRadius: "10px",
        padding: "15px",
        marginBottom: "15px",
        textAlign: "center",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
      }}
    >
      <h2 style={{ margin: "0", color: "#1e3a8a" }}>
        🎯 Resume Readiness Score
      </h2>
      <h1 style={{ margin: "5px 0", color: "#2563eb" }}>
        {analysis.score}/100
      </h1>
      <p style={{ color: "#4b5563" }}>
        {analysis.score >= 85
          ? "Excellent! Recruiter-ready resume 💼"
          : analysis.score >= 70
          ? "Good — just refine a few areas 🚀"
          : analysis.score >= 50
          ? "Average — needs noticeable improvement 🧠"
          : "Weak resume — needs restructuring ❗"}
      </p>
    </div>

    <h3>🧠 Detailed Analysis</h3>
    <pre
      style={{
        whiteSpace: "pre-wrap",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "0.95rem",
        color: "#111827"
      }}
    >
      {analysis.feedback}
    </pre>
  </div>
)}


              </div>

              <div className="card">
  <h3>💼 Match Resume with Job Description</h3>
  <p>Paste your resume and a job description to check compatibility.</p>

  <div className="analyze-section">
    <textarea
      placeholder="Paste your resume text here..."
      value={resumeText}
      onChange={(e) => setResumeText(e.target.value)}
      style={{ marginBottom: "10px" }}
    />
    <textarea
      placeholder="Paste the job description here..."
      value={jobDescription}
      onChange={(e) => setJobDescription(e.target.value)}
    />
    <button onClick={handleMatch} disabled={loading}>
      {loading ? "Matching..." : "Match Now"}
    </button>
  </div>

  {matchResult && (
    <div className="analysis-result">
      <h2 style={{ color: "#1e3a8a" }}>🎯 Match Score: {matchResult.match_score}%</h2>
      <p style={{ color: "#4b5563" }}>{matchResult.summary}</p>
      <div>
        <h4>✅ Matching Keywords</h4>
        <p>{matchResult.matching_keywords.join(", ")}</p>

        <h4>❌ Missing Keywords</h4>
        <p>{matchResult.missing_keywords.join(", ")}</p>
        {matchResult.suggested_courses && matchResult.suggested_courses.length > 0 && (
  <div style={{ marginTop: "15px" }}>
    <h4>🎓 Recommended Courses & Certifications</h4>
    <ul>
      {matchResult.suggested_courses.map((course, i) => (
        <li key={i} style={{ marginBottom: "8px" }}>
          <strong>{course.name}</strong> – {course.reason}
          <br />
          <a href={course.link} target="_blank" rel="noopener noreferrer">
            {course.link}
          </a>
        </li>
      ))}
    </ul>
  </div>
)}

      </div>
    </div>
  )}
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
