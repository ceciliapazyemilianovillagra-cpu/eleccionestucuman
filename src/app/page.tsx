"use client";

import { FormEvent, useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, AppUser, roleNames } from "./panel/shared";
import { manageUsers } from "./panel/shared";
import { Login } from "./panel/Login";
import { Users } from "./panel/Users";
import { Padron } from "./panel/Padron";
import { Colaboradores } from "./panel/Colaboradores";
import { Agenda } from "./panel/Agenda";
import { Configuracion } from "./panel/Configuracion";
import { AlertsBell } from "./panel/AlertsBell";

type ModuleKey = "padron" | "colaboradores" | "agenda" | "users" | "config";

export default function Home() {
  const [token, setToken] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [moduleOpen, setModuleOpen] = useState<ModuleKey | null>(null);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const saved = localStorage.getItem("et_session");
        if (!saved) return;

        const session = JSON.parse(saved);
        const stillValid = session.access_token && (!session.expires_at || session.expires_at * 1000 > Date.now() + 60000);

        if (stillValid) {
          if (active) setToken(session.access_token);
          return;
        }

        if (!session.refresh_token) {
          localStorage.removeItem("et_session");
          return;
        }

        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const refreshed = await response.json();

        if (!response.ok) {
          localStorage.removeItem("et_session");
          return;
        }

        localStorage.setItem("et_session", JSON.stringify(refreshed));
        if (active) setToken(refreshed.access_token);
      } catch {
        localStorage.removeItem("et_session");
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    let active = true;
    manageUsers(token, { action: "me" })
      .then((data) => {
        if (active) setCurrentUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem("et_session");
        if (active) {
          setToken("");
          setError("Tu usuario no tiene acceso a la aplicación.");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) return setError("Correo o contraseña incorrectos.");
    localStorage.setItem("et_session", JSON.stringify(data));
    setToken(data.access_token);
  }

  if (checkingSession)
    return (
      <main className="login-page">
        <img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán" />
      </main>
    );
  if (!token) return <Login email={email} password={password} error={error} setEmail={setEmail} setPassword={setPassword} submit={login} />;
  if (!currentUser)
    return (
      <main className="login-page">
        <img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán" />
      </main>
    );

  const canUsePadron = currentUser.allowed_modules.includes("padron");
  const isAdmin = currentUser.user_type === "superadmin";

  const MODULES: { key: ModuleKey; visible: boolean; icon: string; className?: string; label: string; desc: string }[] = [
    { key: "padron", visible: canUsePadron, icon: "⌕", label: "PADRÓN", desc: "Buscar, consultar y editar votantes" },
    { key: "colaboradores", visible: canUsePadron, icon: "🤝", label: "COLABORADORES", desc: "Carga interna y export de colaboradores" },
    { key: "agenda", visible: true, icon: "🗓", label: "AGENDA", desc: "Reuniones, capacitaciones y eventos" },
    { key: "users", visible: isAdmin, icon: "♙", className: "users-card", label: "USUARIOS", desc: "Crear accesos y asignar módulos" },
    { key: "config", visible: isAdmin, icon: "⚙", label: "CONFIGURACIÓN", desc: "Logs y ajustes de la aplicación" },
  ];
  const availableModules = MODULES.filter((m) => m.visible);

  if (moduleOpen === "padron") return <Padron token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "colaboradores") return <Colaboradores token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "agenda") return <Agenda token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "users") return <Users token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "config") return <Configuracion token={token} close={() => setModuleOpen(null)} />;

  return (
    <main className="app-shell">
      <section className="mobile-page">
        <header className="topbar">
          <div className="brand">
            <img src="/icon.svg" alt="Logo" />
            <div>
              <small>ELECCIONES TUCUMÁN</small>
              <b className="brand-email">{currentUser.email}</b>
              <span className="brand-role">{roleNames[currentUser.user_type]}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertsBell token={token} />
            <button
              className="logout"
              onClick={() => {
                localStorage.removeItem("et_session");
                setToken("");
              }}
            >
              Salir
            </button>
          </div>
        </header>
        <section className="module-section">
          <div className="section-title">
            <h3>Módulos</h3>
            <span>{availableModules.length} disponibles</span>
          </div>
          {availableModules.map((m) => (
            <button key={m.key} className={`module-card ${m.className ?? ""}`} onClick={() => setModuleOpen(m.key)}>
              <span className="module-icon">{m.icon}</span>
              <div>
                <b>{m.label}</b>
                <p>{m.desc}</p>
              </div>
              <span className="arrow">›</span>
            </button>
          ))}
          {!availableModules.length && <p className="empty">No tenés módulos habilitados. Consultá al administrador.</p>}
        </section>
      </section>
    </main>
  );
}
