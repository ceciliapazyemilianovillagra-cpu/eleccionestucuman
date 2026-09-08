"use client";
import { useEffect, useState } from "react";
import { Bell, Database, HardDrive } from "lucide-react";
import { rpc } from "./shared";

type Usage = { level: "green" | "yellow" | "red"; db_pct: number; storage_pct: number };

const LEVEL_COLOR: Record<Usage["level"], string> = { green: "#147a4c", yellow: "#a9822c", red: "#a3231e" };
const LEVEL_LABEL: Record<Usage["level"], string> = { green: "Todo en orden", yellow: "Para vigilar", red: "Atención" };

export function AlertsBell({ token, onOpenAlerts, isSuperadmin }: { token: string; onOpenAlerts?: () => void; isSuperadmin?: boolean }) {
  const [total, setTotal] = useState(0);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [c, a] = await Promise.all([
      rpc(token, "list_voter_claims").catch(() => []),
      rpc(token, "list_upcoming_agenda", { p_days: 7 }).catch(() => []),
    ]);
    setTotal((c?.length || 0) + (a?.length || 0));
  }

  async function loadUsage() {
    try {
      setUsage(await rpc(token, "supabase_usage_semaforo"));
    } catch {
      setUsage(null);
    }
  }

  useEffect(() => {
    load();
    if (isSuperadmin) loadUsage();
  }, [token, isSuperadmin]);

  if (!isSuperadmin) {
    return (
      <button className="bell-btn" onClick={onOpenAlerts} aria-label="Alertas" disabled={!onOpenAlerts}>
        <Bell size={19} strokeWidth={2} />
        {total > 0 && <span className="bell-badge">{total}</span>}
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button className="bell-btn" onClick={() => setOpen((v) => !v)} aria-label="Alertas y uso de Supabase">
        <Bell size={19} strokeWidth={2} />
        {total > 0 && <span className="bell-badge">{total}</span>}
        {usage && <span className="bell-semaforo" style={{ background: LEVEL_COLOR[usage.level] }} />}
      </button>
      {open && (
        <>
          <div className="bell-popover-backdrop" onClick={() => setOpen(false)} />
          <div className="bell-popover">
            <button
              className="bell-popover-row"
              onClick={() => {
                setOpen(false);
                onOpenAlerts?.();
              }}
            >
              <b>Alertas</b>
              <span className="badge sm neutral">{total}</span>
            </button>
            <div className="bell-popover-divider" />
            <p className="bell-popover-title">Uso de Supabase</p>
            {usage ? (
              <>
                <div className="bell-popover-row" style={{ cursor: "default" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Database size={13} strokeWidth={2} /> Base de datos
                  </span>
                  <span style={{ fontWeight: 700, color: LEVEL_COLOR[usage.level] }}>{usage.db_pct}%</span>
                </div>
                <div className="bell-popover-row" style={{ cursor: "default" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <HardDrive size={13} strokeWidth={2} /> Almacenamiento
                  </span>
                  <span style={{ fontWeight: 700, color: LEVEL_COLOR[usage.level] }}>{usage.storage_pct}%</span>
                </div>
                <p className="bell-popover-status" style={{ color: LEVEL_COLOR[usage.level] }}>
                  <span className="bell-semaforo-inline" style={{ background: LEVEL_COLOR[usage.level] }} />
                  {LEVEL_LABEL[usage.level]}
                </p>
              </>
            ) : (
              <p className="empty" style={{ padding: "6px 0" }}>Sin datos.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
