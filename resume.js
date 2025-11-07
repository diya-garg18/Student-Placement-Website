import express from "express";
import dotenv from "dotenv";
import db from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import OpenAI from "openai";

dotenv.config();

const router = express.Router();
console.log("🔑 GROQ_API_KEY loaded:", !!process.env.GROQ_API_KEY);

// ✅ Create Groq client (OpenAI-compatible)
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// 🔹 Helper to call Groq API
async function callGroqAPI(prompt) {
  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices[0].message.content.trim();
    return text;
  } catch (error) {
    console.error("❌ Groq API Error:", error);
    throw new Error("Groq API call failed");
  }
}

// ✅ Fetch user’s resume history
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

// ✅ Resume upload + analysis
router.post("/upload", authMiddleware, async (req, res) => {
  try {
    const { resumeText } = req.body;
    const userId = req.user.id;

    if (!resumeText || resumeText.trim().length < 30) {
      return res.status(400).json({ error: "Please paste a valid resume text." });
    }

    // 🧠 Prompt for Groq (cleaner + consistent format)
    const prompt = `
You are an expert career advisor and resume evaluator.

Analyze the following resume and return your response in **strict JSON** following this structure:

{
  "score": <0–100>,
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "suggestions": []
}

Guidelines:
- "score" reflects how strong the resume is overall.
- Be concise and objective in "summary".
- "strengths" should highlight well-presented areas.
- "weaknesses" should point out gaps or unclear sections.
- "suggestions" should give 3–5 specific improvement actions (e.g., “Add quantifiable results”, “Include technical skills section”).
- Do NOT include markdown or extra text outside JSON.

Resume:
${resumeText}
`;

    // 🔹 Call Groq API
    const response = await callGroqAPI(prompt);

    // 🧹 Clean JSON
    const cleaned = response.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (err) {
      console.warn("⚠️ Could not parse JSON, using fallback parser");
      const scoreMatch = response.match(/"score"\s*:\s*(\d+)/);
      result = {
        summary: "Partial analysis due to formatting issue.",
        score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
        strengths: [],
        weaknesses: [],
        suggestions: []
      };
    }

    const readinessScore = Math.min(result.score || 0, 100);

    // ✅ Save in DB
    const dbResult = await db.query(
      "INSERT INTO resumes (user_id, resume_text, readiness_score, feedback) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, resumeText, readinessScore, JSON.stringify(result, null, 2)]
    );

    // ✅ Return consistent structure
    res.json({
      message: "✅ Resume analyzed successfully!",
      data: result,
      resume: dbResult.rows[0],
    });

  } catch (err) {
    console.error("❌ Resume analysis failed:", err);
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

// ✅ Match Resume with Job Description
router.post("/match", authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;
    const userId = req.user.id;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: "Please provide both resume text and job description." });
    }

    // 🧠 Prompt for Groq
    const prompt = `
You are an AI resume-job matcher and career advisor.

Compare the following resume and job description. Perform these tasks:

1. Compute a similarity score (0–100).
2. Extract matching and missing keywords.
3. Provide a short summary of how well the candidate fits the job.
4. Suggest **specific online courses or certifications** that will help the candidate bridge the gap.
   - Include 3–5 recommendations.
   - Prefer Coursera, Udemy, Google Career Certificates, or LinkedIn Learning.
   - Provide **course name, short reason, and direct link**.

Return only valid JSON in this format:

{
  "match_score": <0–100>,
  "matching_keywords": [],
  "missing_keywords": [],
  "summary": "",
  "suggested_courses": [
    {
      "name": "",
      "reason": "",
      "link": ""
    }
  ]
}

Resume:
${resumeText}

Job Description:
${jobDescription}
`;


    const response = await callGroqAPI(prompt);

    let jsonString = response
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let matchData = { match_score: 0, matching_keywords: [], missing_keywords: [], summary: "" };
    try {
      matchData = JSON.parse(jsonString);
    } catch (err) {
      console.warn("⚠️ Could not parse Groq JSON, fallback to regex");
      const scoreMatch = response.match(/"match_score"\s*:\s*(\d+)/);
      matchData.match_score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    }

    // ✅ Save to DB (optional)
    await db.query(
  `UPDATE resumes 
   SET job_description = $1 
   WHERE id = (
     SELECT id FROM resumes 
     WHERE user_id = $2 
     ORDER BY created_at DESC 
     LIMIT 1
   )`,
  [jobDescription, userId]
);


    res.json({
      message: "✅ Resume-job match completed",
      data: matchData,
    });
  } catch (err) {
    console.error("❌ Match analysis failed:", err);
    res.status(500).json({ error: "Failed to analyze resume-job match" });
  }
});



export default router;
