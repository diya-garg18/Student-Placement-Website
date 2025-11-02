const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db");
const sendMail = require("../utils/mailer");

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)", [name, email, hashed]);
    res.json({ message: "User registered successfully!" });
  } catch (err) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
  if (!result.rows.length) return res.status(400).json({ error: "Email not found" });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour
  await db.query("UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3", [token, expires, email]);

  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  await sendMail(email, "Password Reset", `Click here to reset: ${resetLink}`);
  res.json({ message: "Password reset link sent to email" });
});

// RESET PASSWORD
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const result = await db.query("SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()", [token]);
  if (!result.rows.length) return res.status(400).json({ error: "Invalid or expired token" });

  const hashed = await bcrypt.hash(password, 10);
  await db.query("UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE reset_token=$2", [hashed, token]);
  res.json({ message: "Password reset successfully" });
});

module.exports = router;
