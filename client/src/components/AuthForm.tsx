import { useState, type FormEvent } from "react";

import { getErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "register";

const inputStyle = { display: "block", width: "100%", marginTop: 8, padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, color: "#111827" };
const primaryButtonStyle = { background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", cursor: "pointer" };

export function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password || (isRegister && !name.trim())) {
      setError(isRegister ? "Name, email and password are required." : "Email and password are required.");
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError(null);
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, color: "#111827" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32 }}>{isRegister ? "Create account" : "Log in"}</h1>
        <p style={{ margin: "0 0 20px", color: "#4b5563" }}>{isRegister ? "Sign up to join the chat." : "Welcome back."}</p>

        <div style={{ display: "grid", gap: 16 }}>
          {isRegister ? (
            <label style={{ fontWeight: 600 }}>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" style={inputStyle} />
            </label>
          ) : null}

          <label style={{ fontWeight: 600 }}>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" style={inputStyle} />
          </label>

          <label style={{ fontWeight: 600 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              style={inputStyle}
            />
          </label>

          {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}

          <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Please wait..." : isRegister ? "Create account" : "Log in"}
          </button>

          <button type="button" onClick={switchMode} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, justifySelf: "start" }}>
            {isRegister ? "Already have an account? Log in" : "No account? Create one"}
          </button>
        </div>
      </form>
    </main>
  );
}
