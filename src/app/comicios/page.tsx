"use client";
import { FormEvent, useEffect, useState } from "react";
import "../external/external.css";
import "../panel/panel.css";
import { callFn, clearToken, loadToken, saveToken } from "../external/api";
import { ExternalLoginCard, ExternalShell } from "../external/ExternalShell";
import { CandidatoSection } from "../external/CandidatoSection";
import { FiscalSection } from "../external/FiscalSection";
import { MovilizadorChoferSection } from "../external/MovilizadorChoferSection";
import { DirigenteSection } from "../external/DirigenteSection";

const FN = "comicios";
const FISCAL_ROLES = ["fiscal", "fiscal_general", "fiscal_mesa", "fiscal_suplente", "coordinador_circuito", "coordinador_general"];

type TabKey = "candidato" | "dirigente" | "movilizador" | "fiscal";

export default function Comicios() {
  const [token, setToken] = useState("");
  const [person, setPerson] = useState("");
  const [dni, setDni] = useState("");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [tab, setTab] = useState<TabKey | null>(null);

  useEffect(() => {
    const saved = loadToken(FN);
    if (saved) {
      setToken(saved);
      callFn(FN, saved, { action: "me" }).then((d) => {
        if (Array.isArray(d.roles)) {
          setRoles(d.roles);
          setPerson(d.person?.nombre ?? "");
        }
        else {
          clearToken(FN);
          setToken("");
        }
      });
    }
  }, []);

  const isCandidato = roles.includes("candidato");
  const isDirigente = roles.includes("dirigente");
  const isMovilizador = roles.includes("movilizador");
  const isChofer = roles.includes("chofer");
  const isFiscal = roles.some((r) => FISCAL_ROLES.includes(r));

  const availableTabs: { key: TabKey; label: string; sub: string }[] = [
    ...(isCandidato ? [{ key: "candidato" as const, label: "Sala de situación", sub: "Candidato" }] : []),
    ...(isDirigente ? [{ key: "dirigente" as const, label: "Asignar roles", sub: "Dirigente" }] : []),
    ...(isMovilizador || isChofer ? [{ key: "movilizador" as const, label: "Traslados", sub: "Movilizadores" }] : []),
    ...(isFiscal ? [{ key: "fiscal" as const, label: "Jornada electoral", sub: "Fiscales" }] : []),
  ];

  useEffect(() => {
    if (!tab && availableTabs.length) setTab(availableTabs[0].key);
  }, [availableTabs.length]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const d = await callFn(FN, "", { action: "login", dni, code });
    setLoggingIn(false);
    if (d.token) {
      setToken(d.token);
      setPerson(d.person?.nombre ?? "");
      setRoles(d.roles || []);
      saveToken(FN, d.token);
    } else {
      setLoginError(d.error || "No se pudo ingresar.");
    }
  }

  async function logout() {
    await callFn(FN, token, { action: "logout" });
    clearToken(FN);
    setToken("");
    setRoles([]);
    setTab(null);
    setDni("");
    setCode("");
  }

  if (!token) {
    return (
      <ExternalLoginCard>
        <form onSubmit={login}>
          <img src="/icon.svg" alt="Elecciones Tucumán" />
          <small>ACCESO EXTERNO</small>
          <h1>Comicios</h1>
          <p>Ingresá con tu DNI y el código único que te entregaron.</p>
          <label>DNI</label>
          <input required inputMode="numeric" placeholder="Tu DNI" value={dni} onChange={(e) => setDni(e.target.value)} />
          <label>Código único</label>
          <input required placeholder="Código de acceso" value={code} onChange={(e) => setCode(e.target.value)} />
          <button disabled={loggingIn}>{loggingIn ? "INGRESANDO..." : "INGRESAR"}</button>
          {loginError && <b className="ext-error">{loginError}</b>}
        </form>
      </ExternalLoginCard>
    );
  }

  if (!availableTabs.length) {
    return (
      <ExternalShell eyebrow="COMICIOS" title="Sin rol asignado" person={person} onLogout={logout}>
        <p className="empty">Todavía no tenés ningún rol asignado en el equipo. Consultá a tu dirigente.</p>
      </ExternalShell>
    );
  }

  return (
    <ExternalShell eyebrow="COMICIOS" title={availableTabs.find((t) => t.key === tab)?.label ?? ""} person={person} onLogout={logout}>
      {availableTabs.length > 1 && (
        <div className="config-tabs" style={{ marginBottom: 14 }}>
          {availableTabs.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
              {t.label.toUpperCase()} <span className="config-tab-sub">{t.sub.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
      {tab === "candidato" && <CandidatoSection token={token} />}
      {tab === "dirigente" && <DirigenteSection token={token} />}
      {tab === "movilizador" && <MovilizadorChoferSection token={token} isMovilizador={isMovilizador} isChofer={isChofer} />}
      {tab === "fiscal" && <FiscalSection token={token} />}
    </ExternalShell>
  );
}
