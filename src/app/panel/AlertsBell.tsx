"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { rpc } from "./shared";

export function AlertsBell({ token, onOpenAlerts }: { token: string; onOpenAlerts?: () => void }) {
  const [total, setTotal] = useState(0);

  async function load() {
    const [c, a] = await Promise.all([
      rpc(token, "list_voter_claims").catch(() => []),
      rpc(token, "list_upcoming_agenda", { p_days: 7 }).catch(() => []),
    ]);
    setTotal((c?.length || 0) + (a?.length || 0));
  }

  useEffect(() => {
    load();
  }, [token]);

  return (
    <button className="bell-btn" onClick={onOpenAlerts} aria-label="Alertas" disabled={!onOpenAlerts}>
      <Bell size={19} strokeWidth={2} />
      {total > 0 && <span className="bell-badge">{total}</span>}
    </button>
  );
}
