"use client";
import { useEffect, useState } from "react";
import { rpc, formatDateTime } from "./shared";

type Claim = {
  id: string;
  created_at: string;
  voter_dni: string;
  voter_nombre: string;
  actor_dni: string;
  actor_nombre: string;
  owner_nombre: string | null;
  owner_internal_email: string | null;
};

type AgendaItem = { id: number; title: string; starts_at: string };

export function AlertsBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);

  async function load() {
    const [c, a] = await Promise.all([
      rpc(token, "list_voter_claims").catch(() => []),
      rpc(token, "list_upcoming_agenda", { p_days: 7 }).catch(() => []),
    ]);
    setClaims(c || []);
    setAgenda(a || []);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function resolve(id: string) {
    await rpc(token, "resolve_voter_claim", { p_id: id }).catch(() => {});
    setClaims((prev) => prev.filter((c) => c.id !== id));
  }

  const total = claims.length + agenda.length;

  return (
    <div className="alerts-bell">
      <button
        className="bell-btn"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label="Alertas"
      >
        🔔
        {total > 0 && <span className="bell-badge">{total}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          <p className="eyebrow" style={{ margin: "0 0 8px" }}>RECLAMOS DE COLABORADORES</p>
          {!claims.length && <p className="empty" style={{ padding: 10 }}>Sin reclamos pendientes.</p>}
          {claims.map((c) => (
            <div key={c.id} className="bell-item">
              <p>
                <b>{c.actor_nombre}</b> (DNI {c.actor_dni}) reclama a <b>{c.voter_nombre}</b> (DNI {c.voter_dni}), cargado por{" "}
                <b>{c.owner_nombre || c.owner_internal_email || "un interno"}</b>.
              </p>
              <button className="ext-btn secondary" onClick={() => resolve(c.id)}>
                MARCAR RESUELTO
              </button>
            </div>
          ))}
          <p className="eyebrow" style={{ margin: "14px 0 8px" }}>AGENDA PRÓXIMA (7 DÍAS)</p>
          {!agenda.length && <p className="empty" style={{ padding: 10 }}>Sin eventos próximos.</p>}
          {agenda.map((a) => (
            <div key={a.id} className="bell-item">
              <p>
                <b>{a.title}</b> · {formatDateTime(a.starts_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
