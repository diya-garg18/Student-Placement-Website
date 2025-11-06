import express from "express";
import dotenv from "dotenv";
import db from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";
import fetch from "node-fetch";
import OpenAI from "openai";

dotenv.config();

const router = express.Router();
console.log("🔑 GROQ_API_KEY loaded:", !!process.env.GROQ_API_KEY);

// ✅ Create Groq client (OpenAI compatible)
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// 🔹 Helper function to call Groq API
async function callGroqAPI(prompt) {
  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices[0].message.content;
    return text.trim();
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

// ✅ Resume analysis route
router.post("/upload", authMiddleware, async (req, res) => {
  try {
    const { resumeText } = req.body;
    const userId = req.user.id;

    if (!resumeText || resumeText.trim().length < 30) {
      return res.status(400).json({ error: "Please paste a valid resume text." });
    }

    // 🧠 New unified extraction + analysis prompt
    const analysisPrompt = `
You are a professional resume parsing and career analysis expert.

From the given *plain text resume*, first extract structured information in pure JSON format using this schema:

{
  "name": "",
  "email": "",
  "phone": "",
  "linkedin": "",
  "github": "",
  "education": [
    {
      "degree": "",
      "institution": "",
      "year_of_graduation": "",
      "gpa_or_percentage": ""
    }
  ],
  "skills": [],
  "projects": [
    {
      "title": "",
      "description": "",
      "technologies_used": []
    }
  ],
  "experience": [
    {
      "role": "",
      "organization": "",
      "duration": "",
      "achievements": ""
    }
  ],
  "certifications": [],
  "achievements": [],
  "career_objective": ""
}

Resume Text:
${resumeText}

After extracting JSON, immediately perform a **career analysis** using that structured data and generate a professional evaluation report covering:

1. **Overall Summary** – Brief overview of the candidate.
2. **Skillset Evaluation** – Assess balance and relevance of technical + soft skills.
3. **Education Analysis** – Comment on academic strength and clarity.
4. **Projects & Experience** – Highlight impact, depth, and relevance.
5. **Career Objective Assessment** – Evaluate alignment with experience.
6. **Strengths & Achievements** – Identify standout qualities.
7. **Improvement Areas** – Suggest missing or improvable areas.
8. **Recommended Career Paths** – Suggest 2–3 roles that fit the profile.
9. **Final Verdict** – One-paragraph summary.

Finally, assign a **readiness score (0–100)** based on:

| Category | Weight |
|-----------|---------|
| Structure & Clarity | 15 |
| Skill Relevance | 20 |
| Experience / Projects | 20 |
| Education | 15 |
| Language & Professionalism | 15 |
| Quantifiable Impact | 15 |

Use this scoring guide:
0–20: Unusable or irrelevant
21–40: Poor quality
41–60: Basic / Entry-level
61–75: Average
76–85: Strong
86–100: Exceptional and recruiter-ready

Return plain textin the following format:

{
  "parsed_resume": { ... },
  "analysis": {
    "overall_summary": "",
    "skills_evaluation": "",
    "education_analysis": "",
    "projects_experience": "",
    "career_objective_assessment": "",
    "strengths": [],
    "improvement_areas": [],
    "recommended_roles": [],
    "final_verdict": ""
  },
  "score_breakdown": {
    "structure": <0-15>,
    "skills": <0-20>,
    "experience": <0-20>,
    "education": <0-15>,
    "language": <0-15>,
    "impact": <0-15>
  },
  "total_score": <0-100>
}
`;

    const analysis = await callGroqAPI(analysisPrompt);

    // Extract total score
    const match = analysis.match(/"total_score"\s*:\s*(\d+)/);
    const readinessScore = match ? Math.min(parseInt(match[1]), 100) : 0;

    // Save result in DB
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
    console.error("❌ Resume analysis failed:", err);
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

export default router;
