// src/pages/ForgotPassword.jsx
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  return (
    <div className="auth-container">
      <h2>Forgot Password</h2>
      <form className="auth-form">
        <input type="email" placeholder="Enter your email" required />
        <button type="submit">Send Reset Link</button>
      </form>
      <div className="auth-links">
        <p>
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
