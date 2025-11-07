import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api.js";
import "../styles/dashboard.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [resumeTextAnalyze, setResumeTextAnalyze] = useState("");
  const [resumeTextMatch, setResumeTextMatch] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
const [analyzeLoading, setAnalyzeLoading] = useState(false);
const [matchLoading, setMatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [resumes, setResumes] = useState([]);
  const navigate = useNavigate();

  // ✅ Fetch profile
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

  // ✅ Fetch resume history
  const fetchResumes = async () => {
    const res = await api.get("/resume/history");
    setResumes(res.data);
  };

  // ✅ Reset all on refresh
  useEffect(() => {
    setResumeTextAnalyze("");
    setResumeTextMatch("");
    setJobDescription("");
    setAnalysis(null);
    setMatchResult(null);
    setActiveTab("dashboard");
  }, []);

  // 🔹 Helper: format analysis as plaintext
  const formatAnalysis = (data) => {
    if (!data) return "";
    const { score, summary, strengths, weaknesses, suggestions } = data;
    let output = `🎯 Resume Readiness Score: ${score}/100\n\n`;
    if (summary) output += `📝 Summary:\n${summary}\n\n`;
    if (strengths?.length) {
      output += `✅ Strengths:\n`;
      strengths.forEach((s) => (output += `- ${s}\n`));
      output += `\n`;
    }
    if (weaknesses?.length) {
      output += `⚠️ Weaknesses:\n`;
      weaknesses.forEach((w) => (output += `- ${w}\n`));
      output += `\n`;
    }
    if (suggestions?.length) {
      output += `💡 Suggestions:\n`;
      suggestions.forEach((s) => (output += `- ${s}\n`));
    }
    return output.trim();
  };

  // 🔹 Helper: format match results as plaintext
  const formatMatchResult = (data) => {
    if (!data) return "";
    const { match_score, summary, matching_keywords, missing_keywords, suggested_courses } = data;
    let output = `🎯 Match Score: ${match_score}/100\n\n`;
    if (summary) output += `📝 Summary:\n${summary}\n\n`;
    if (matching_keywords?.length) output += `✅ Matching Keywords:\n- ${matching_keywords.join("\n- ")}\n\n`;
    if (missing_keywords?.length) output += `❌ Missing Keywords:\n- ${missing_keywords.join("\n- ")}\n\n`;
    if (suggested_courses?.length) {
      output += `🎓 Recommended Courses:\n`;
      suggested_courses.forEach((course) => {
        output += `- ${course.name} (${course.reason})\n  Link: ${course.link}\n`;
      });
    }
    return output.trim();
  };

  // ✅ Analyze Resume
const handleAnalyze = async () => {
  if (!resumeTextAnalyze.trim()) return alert("Please paste your resume text!");
  setAnalyzeLoading(true);
  try {
    const res = await api.post("/resume/upload", { resumeText: resumeTextAnalyze });
    setAnalysis(res.data.data); // store raw JSON, format later
    setResumeTextAnalyze("");
    fetchResumes();
  } catch {
    alert("Error analyzing resume");
  } finally {
    setAnalyzeLoading(false);
  }
};

// ✅ Match Resume with Job Description
const handleMatch = async () => {
  if (!resumeTextMatch.trim() || !jobDescription.trim()) {
    return alert("Please paste both resume and job description!");
  }
  setMatchLoading(true);
  try {
    const res = await api.post("/resume/match", {
      resumeText: resumeTextMatch,
      jobDescription,
    });
    setMatchResult(res.data.data);
  } catch {
    alert("Error matching resume and job description");
  } finally {
    setMatchLoading(false);
  }
};

  // ✅ Logout
  const handleLogout = async () => {
    await api.post("/auth/logout");
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>My Dashboard</h2>
        {user && (
          <p className="logged-in">
            Logged in as <b>{user.name}</b>
          </p>
        )}
        <ul className="sidebar-menu">
          <li onClick={() => setActiveTab("dashboard")}>🏠 Overview</li>
          <li
            onClick={() => {
              setActiveTab("resumes");
              fetchResumes();
            }}
          >
            📄 My Resumes
          </li>
          <li>⚙️ Settings</li>
        </ul>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === "dashboard" && (
          <>
            <h1>Welcome, {user ? user.name : "User"}!</h1>

            <div className="card-grid">
              {/* Analyze Resume Card */}
              <div className="card">
                <h3>📤 Upload & Analyze Resume</h3>
                <textarea
                  placeholder="Paste your resume text here..."
                  value={resumeTextAnalyze}
                  onChange={(e) => setResumeTextAnalyze(e.target.value)}
                />
                <button type="button" onClick={handleAnalyze} disabled={analyzeLoading}>
  {analyzeLoading ? "Analyzing..." : "Analyze"}
</button>

                {analysis && (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "10px",
                      fontSize: "0.95rem",
                      color: "#111827",
                    }}
                  >
                    {formatAnalysis(analysis)}
                  </pre>
                )}
              </div>

              {/* Match Resume Card */}
              <div className="card">
                <h3>💼 Match Resume with Job Description</h3>
                <textarea
                  placeholder="Paste your resume text here..."
                  value={resumeTextMatch}
                  onChange={(e) => setResumeTextMatch(e.target.value)}
                  style={{ marginBottom: "10px" }}
                />
                <textarea
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
                <button type="button" onClick={handleMatch} disabled={matchLoading}>
  {matchLoading ? "Matching..." : "Match Now"}
</button>

                {matchResult && (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "10px",
                      fontSize: "0.95rem",
                      color: "#111827",
                    }}
                  >
                    {formatMatchResult(matchResult)}
                  </pre>
                )}
              </div>
            </div>
          </>
        )}

        {/* Resume History Tab */}
        {/* Resume History Tab */}
{activeTab === "resumes" && (
  <div className="resumes-page">
    <h2>My Uploaded Resumes</h2>

    {resumes.length === 0 && <p>No resumes analyzed yet.</p>}

    {resumes.map((r) => {
      // Parse JSON feedback safely
      let parsedFeedback;
      try {
        parsedFeedback = JSON.parse(r.feedback);
      } catch {
        parsedFeedback = { summary: r.feedback };
      }

      return (
        <details key={r.id} className="resume-item">
          <summary>
            <span>Resume #{r.id}</span>
            <span className="score-tag">{r.readiness_score}/100</span>
          </summary>

          <div className="resume-details">
            <p>
              <strong>Date:</strong> {new Date(r.created_at).toLocaleString()}
            </p>

            {parsedFeedback.summary && (
              <p style={{ marginTop: "10px" }}>
                <strong>Summary:</strong> {parsedFeedback.summary}
              </p>
            )}

            {parsedFeedback.strengths && (
              <div className="feedback-section">
                <strong>Strengths:</strong>
                <ul>
                  {parsedFeedback.strengths.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedFeedback.weaknesses && (
              <div className="feedback-section">
                <strong>Weaknesses:</strong>
                <ul>
                  {parsedFeedback.weaknesses.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedFeedback.suggestions && (
              <div className="feedback-section">
                <strong>Suggestions:</strong>
                <ul>
                  {parsedFeedback.suggestions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      );
    })}
  </div>
)}

      </main>
    </div>
  );
}
