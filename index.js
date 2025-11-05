import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import resumeRoutes from "./routes/resume.js";
import profileRoutes from "./routes/profile.js";

dotenv.config();

const app = express();

// ✅ Fix CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());
app.use(bodyParser.json());

app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/profile", profileRoutes);

app.listen(4000, () => console.log("✅ Server running on port 4000"));
