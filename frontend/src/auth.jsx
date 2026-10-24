import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) return setReady(true);
    api("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setReady(true));
  }, []);

  const signIn = async (path, body) => {
    const r = await api(path, { method: "POST", body });
    localStorage.setItem("token", r.token);
    setUser(r.user);
  };
  const signOut = () => {
    localStorage.removeItem("token");
    setUser(null);
  };
  return <Ctx.Provider value={{ user, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}
