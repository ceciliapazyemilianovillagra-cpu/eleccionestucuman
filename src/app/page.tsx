"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search, Handshake, CalendarDays, Settings, Landmark } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, AppUser, roleNames } from "./panel/shared";
import { manageUsers } from "./panel/shared";
import { Login } from "./panel/Login";
import { Padron } from "./panel/Padron";
import { Colaboradores } from "./panel/Colaboradores";
import { Agenda } from "./panel/Agenda";
import { Comicios } from "./panel/Comicios";
import { Configuracion, ConfigTabKey } from "./panel/Configuracion";
import { AlertsBell } from "./panel/AlertsBell";
import { useRealtime } from "./panel/realtime";

type ModuleKey = "padron" | "colaboradores" | "agenda" | "comicios" | "config";

export default function Home() {
  const [token, setToken] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [moduleOpen, setModuleOpen] = useState<ModuleKey | null>(null);
  const [configTab, setConfigTab] = useState<ConfigTabKey>("usuarios");
  const [bgUrl, setBgUrl] = useState("");
  const [bgOpacity, setBgOpacity] = useState(15);

  async function loadAppearance() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=key,value&key=in.(background_image_url,background_opacity)`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
      const rows: { key: string; value: string | null }[] = await res.json();
      setBgUrl(rows.find((r) => r.key === "background_image_url")?.value ?? "");
      const op = rows.find((r) => r.key === "background_opacity")?.value;
      setBgOpacity(op ? Number(op) : 15);
    } catch {
      /* sin fondo si falla */
    }
  }

  useEffect(() => {
    if (token) loadAppearance();
  }, [token]);

  useRealtime(["app_settings"], token, loadAppearance);

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
  const isAdmin = currentUser.user_type === "superadmin" || currentUser.user_type === "administrador";

  const MODULES: { key: ModuleKey; visible: boolean; icon: typeof Search; color: string; label: string; desc: string }[] = [
    { key: "padron", visible: canUsePadron, icon: Search, color: "sky", label: "PADRÓN", desc: "Buscar, consultar y editar votantes" },
    { key: "colaboradores", visible: canUsePadron, icon: Handshake, color: "sky", label: "COLABORADORES", desc: "Carga interna y export de colaboradores" },
    { key: "agenda", visible: true, icon: CalendarDays, color: "sky", label: "AGENDA", desc: "Reuniones, capacitaciones y eventos" },
    { key: "comicios", visible: canUsePadron, icon: Landmark, color: "sky", label: "COMICIOS", desc: "Seguimiento de fiscales el día de la elección" },
    { key: "config", visible: isAdmin, icon: Settings, color: "sky", label: "CONFIGURACIÓN", desc: "Usuarios, alertas, enlaces y logs" },
  ];
  const availableModules = MODULES.filter((m) => m.visible);

  if (moduleOpen === "padron") return <Padron token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "colaboradores") return <Colaboradores token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "agenda") return <Agenda token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "comicios") return <Comicios token={token} close={() => setModuleOpen(null)} />;
  if (moduleOpen === "config") return <Configuracion token={token} close={() => setModuleOpen(null)} initialTab={configTab} isSuperadmin={currentUser.user_type === "superadmin"} />;

  return (
    <main className="app-shell">
      <section className="mobile-page">
        {bgUrl && <img src={bgUrl} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: bgOpacity / 100, zIndex: 0, pointerEvents: "none" }} />}
        <header className="topbar" style={{ position: "relative", zIndex: 1 }}>
          <div className="brand">
            <img src="/icon.svg" alt="Logo" />
            <div>
              <small>ELECCIONES TUCUMÁN</small>
              <b className="brand-email">{currentUser.email}</b>
              <span className="brand-role">{roleNames[currentUser.user_type]}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertsBell
              token={token}
              onOpenAlerts={
                isAdmin
                  ? () => {
                      setConfigTab("alertas");
                      setModuleOpen("config");
                    }
                  : undefined
              }
            />
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
        <section className="module-section" style={{ position: "relative", zIndex: 1 }}>
          {availableModules.map((m) => (
            <button key={m.key} className="module-card" onClick={() => setModuleOpen(m.key)}>
              <span className={`module-icon ${m.color}`}>
                <m.icon size={22} strokeWidth={2} />
              </span>
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
