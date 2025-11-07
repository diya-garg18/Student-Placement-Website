import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../config/db.js";
import sendMail from "../utils/mailer.js";

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
      [name, email, hashed]
    );
    res.json({ message: "User registered successfully!" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Email already exists" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    console.log("🟢 Login attempt:", req.body);

    const { email, password } = req.body;

    // Step 1: Check if email exists
    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    console.log("🟢 DB result:", result.rows);

    const user = result.rows[0];
    if (!user) {
      console.log("❌ User not found for email:", email);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Step 2: Compare password
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log("🟢 Password valid?", valid);

    if (!valid) {
      console.log("❌ Invalid password for:", email);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Step 3: Check JWT secret
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing in .env");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    // Step 4: Generate token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    console.log("🟢 Login success! Token generated.");
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});


// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!result.rows.length)
      return res.status(400).json({ error: "Email not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      "UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3",
      [token, expires, email]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await sendMail(email, "Password Reset", `Click here to reset: ${resetLink}`);

    res.json({ message: "Password reset link sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error sending reset link" });
  }
});

// RESET PASSWORD
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = await db.query(
      "SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()",
      [token]
    );
    if (!result.rows.length)
      return res.status(400).json({ error: "Invalid or expired token" });

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      "UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE reset_token=$2",
      [hashed, token]
    );

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Password reset failed" });
  }
});
const handleLogout = () => {
  // 🧹 Clear any saved authentication data
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.clear(); // optional — clears temporary session data too

  // ✅ Redirect to login page
  navigate("/login");
};


export default router;
