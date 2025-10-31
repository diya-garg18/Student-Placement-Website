// src/pages/ResetPassword.jsx
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";

export default function ResetPassword() {
  const { token } = useParams();

  return (
    <div className="auth-container">
      <h2>Reset Password</h2>
      <form className="auth-form">
        <input type="password" placeholder="New Password" required />
        <input type="password" placeholder="Confirm Password" required />
        <button type="submit">Reset Password</button>
      </form>
      <div className="auth-links">
        <p>
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
