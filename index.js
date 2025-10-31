import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { Pool } from 'pg';
import dotenv from 'dotenv';

import storage from './config/storage.js'; // ✅ keep the .js here

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
const upload=multer({storage});
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Mail setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}
// Register
app.post('/api/auth/register', async (req, res) => {
  const { user_name, email, phoneno, password } = req.body;
  // 🛡️ Field Validation
  if (!user_name || !email || !phoneno || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    // 🔍 Check for existing user (email, phone, or username)
    const checkExisting = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phoneno = $2 OR user_name = $3',
      [email, phoneno, user_name]
    );
    if (checkExisting.rows.length > 0) {
      return res.status(409).json({ message: 'User with this email, phone, or username already exists' });
    }
    // 🔐 Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // 💾 Store new user
    await pool.query(
      'INSERT INTO users (user_name, email, phoneno, password) VALUES ($1, $2, $3, $4)',
      [user_name, email, phoneno, hashedPassword]
    );
    return res.status(201).json({ message: '✅ User registered successfully. Please login.' });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    return res.status(500).json({ message: 'Server error during registration. Please try again later.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: '⚠️ Identifier and password are required.' });
  }
  try {
    const userRes = await pool.query(
      `SELECT * FROM users 
       WHERE email = $1 OR phoneno = $1 OR user_name = $1`,
      [identifier]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: '❌ No account found with the provided credentials.' });
    }
    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: '❌ Incorrect password.' });
    }
    const token = jwt.sign({
      id: user.user_id,
      user_name: user.user_name,
      email: user.email,
      phoneno: user.phoneno
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({
      message: '✅ Login successful!',
      token,
      user: {
        user_name: user.user_name,
        email: user.email,
        phoneno: user.phoneno,
        user_id: user.user_id
      }
    });
  } catch (err) {
    console.error('❌ Login error:', err.message || err);
    res.status(500).json({ message: '🚨 Server error while logging in. Please try again later.' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, isSeller } = req.body;
  // ✅ Basic validation
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: '⚠️ Please provide a valid email address.' });
  }
  try {
    const table = isSeller ? 'sellers' : 'users';
    const emailField = isSeller ? 'contact_email' : 'email';
    const userRes = await pool.query(`SELECT * FROM ${table} WHERE ${emailField} = $1`, [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: '❌ No account found with this email.' });
    }
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      `UPDATE ${table} SET reset_token = $1, reset_token_expiry = $2 WHERE ${emailField} = $3`,
      [token, expiry, email]
    );
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await transporter.sendMail({
      from: `"E-Shop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Reset your password',
      html: `
        <p>Hello,</p>
        <p>Click the link below to reset your password. This link will expire in 15 minutes:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request this, please ignore this email.</p>
        <br><p>Thanks,<br>E-Shop Team</p>
      `
    });
    res.json({ message: '✅ A password reset link has been sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err.message || err);
    res.status(500).json({ message: '🚨 Something went wrong while sending the reset email.' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    return res.status(400).json({
      message: '⚠️ Please provide a valid token and a password with at least 6 characters.'
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email } = decoded;
    let user, table, emailField;
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
      table = 'users';
      emailField = 'email';
    } else {
      const sellerRes = await pool.query('SELECT * FROM sellers WHERE contact_email = $1', [email]);
      if (sellerRes.rows.length > 0) {
        user = sellerRes.rows[0];
        table = 'sellers';
        emailField = 'contact_email';
      }
    }
    if (
      !user ||
      user.reset_token !== token ||
      !user.reset_token_expiry ||
      new Date() > new Date(user.reset_token_expiry)
    ) {
      return res.status(400).json({ message: '❌ Invalid or expired reset link.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE ${table}
       SET password = $1, reset_token = NULL, reset_token_expiry = NULL
       WHERE ${emailField} = $2`,
      [hashed, email]
    );
    res.json({ message: '✅ Your password has been successfully reset. Please log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message || err);
    return res.status(400).json({ message: '❌ Invalid or expired reset token.' });
  }
});
