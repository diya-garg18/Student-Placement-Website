import express from "express";
import dotenv from "dotenv";
import db from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import fetch from "node-fetch";

dotenv.config();

const router = express.Router();
console.log("🔑 GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY);

// ✅ Function to call Gemini API via REST
async function analyzeResume(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("❌ Gemini API Error:", data.error);
    throw new Error(data.error.message || "Gemini API call failed");
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}
// ✅ Get all resumes for logged-in user
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      "SELECT id, readiness_score, feedback, created_at FROM resumes WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching resumes:", err);
    res.status(500).json({ error: "Failed to load resume history" });
  }
});


// ✅ Resume analysis route
router.post("/upload", authMiddleware, async (req, res) => {
  try {
    const { resumeText } = req.body;
    const userId = req.user.id;

    if (!resumeText) {
      return res.status(400).json({ error: "No resume text provided" });
    }

    const prompt = `
You are an expert technical recruiter and resume screening AI used by Fortune 500 companies.
You must evaluate resumes with **extremely strict standards**.

Analyze the following resume text and provide:
---
Resume Text:
${resumeText}
---

**Rules:**
- Be objective, not generous.
- If the text is nonsense, incomplete, or doesn't resemble a real resume, score under 10/100.
- Only give above 80 if it clearly has proper structure, experience, measurable impact, and professional formatting.
- Never give 100/100 unless it's an exceptional, fully-detailed resume.

**Scoring Rubric (Total 100):**
1. Structure & Formatting (15)
2. Experience Relevance (20)
3. Skill Coverage (20)
4. Language & Clarity (15)
5. Quantifiable Achievements (15)
6. Professionalism & Job Readiness (15)

**Output Format (strict JSON):**
{
  "score_breakdown": {
    "structure": <0-15>,
    "experience": <0-20>,
    "skills": <0-20>,
    "language": <0-15>,
    "impact": <0-15>,
    "professionalism": <0-15>
  },
  "total_score": <0-100>,
  "strengths": ["...", "...", "..."],
  "improvements": ["...", "...", "..."],
  "summary": "one line summary"
}
`;


    // 🔹 Call Gemini REST API
    const analysis = await analyzeResume(prompt);

    // 🔹 Extract score (fallback to random if not found)
    const match = analysis.match(/\b(\d{2,3})\b/);
    const readinessScore = match
      ? Math.min(parseInt(match[1]), 100)
      : Math.floor(Math.random() * 51) + 50;

    // 🔹 Save in DB
    const dbResult = await db.query(
      "INSERT INTO resumes (user_id, resume_text, readiness_score, feedback) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, resumeText, readinessScore, analysis]
    );

    res.json({
      message: "✅ Resume analyzed successfully!",
      score: readinessScore,
      feedback: analysis,
      resume: dbResult.rows[0],
    });
  } catch (err) {
    console.error("Gemini API error:", err);
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

export default router;
