import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { user, signIn } = useAuth();
  const [setup, setSetup] = useState(null);
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/auth/status").then((r) => setSetup(r.needs_setup)).catch((e) => setErr(e.message));
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await signIn(setup ? "/auth/setup" : "/auth/login", f);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} className="login-card">
        <h1>conwi<b>Inventory</b></h1>
        <p className="muted">{setup ? "Create your owner account to get started." : "Log in to manage your stock and sales."}</p>
        <label className="field">Username
          <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required />
        </label>
        <label className="field">Password
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
            autoComplete={setup ? "new-password" : "current-password"} required />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy || setup === null}>{setup ? "Create account" : "Log in"}</button>
      </form>
    </div>
  );
}
