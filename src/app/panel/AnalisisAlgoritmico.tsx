"use client";
import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { rpc, formatDateTime, SUPABASE_URL, SUPABASE_KEY } from "./shared";
import { useRealtime } from "./realtime";
import { ScrollTopButton } from "./ScrollTopButton";

type Stats = {
  total: number;
  analizadas: number;
  menciona_tucuman_7d: number;
  menciona_smt_7d: number;
  menciona_nagle_7d: number;
  tono_favorable: number;
  tono_neutro: number;
  tono_desfavorable: number;
};

type Article = {
  id: number;
  source_name: string;
  title: string;
  link: string;
  published_at: string | null;
  mentions_tucuman: boolean;
  mentions_smt: boolean;
  mentions_nagle: boolean;
  tono: "favorable" | "neutro" | "desfavorable" | null;
  analysis_note: string | null;
  analyzed_at: string | null;
};

type Temas = {
  temas: { tema: string; count: number }[];
  otros_mencionados: { nombre: string; count: number }[];
};

type Cobertura = {
  circuito: string;
  circuito_nombre: string | null;
  total_padron: number;
  movilizadores: number;
  fiscales: number;
  colaboradores: number;
  cobertura_pct: number | null;
};

const FILTERS = [
  { key: "todos", label: "Todas" },
  { key: "nagle", label: "Nagle" },
  { key: "smt", label: "San Miguel" },
  { key: "tucuman", label: "Tucumán" },
  { key: "sin_analizar", label: "Sin analizar" },
] as const;

const TONO_LABEL: Record<string, string> = { favorable: "Favorable", neutro: "Neutro", desfavorable: "Desfavorable" };
const TONO_BADGE: Record<string, string> = { favorable: "ok", neutro: "neutral", desfavorable: "danger" };

export function AnalisisAlgoritmico({ token, close, isSuperadmin }: { token: string; close: () => void; isSuperadmin: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [temas, setTemas] = useState<Temas | null>(null);
  const [cobertura, setCobertura] = useState<Cobertura[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("nagle");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function load(f = filter) {
    setLoading(true);
    try {
      const [s, a, t, c] = await Promise.all([
        rpc(token, "media_monitor_stats"),
        rpc(token, "media_monitor_articles", { p_filter: f, p_limit: 60 }),
        rpc(token, "media_monitor_temas", { p_days: 30 }).catch(() => null),
        rpc(token, "territorio_cobertura").catch(() => []),
      ]);
      setStats(s);
      setArticles(a || []);
      setTemas(t);
      setCobertura(c || []);
    } catch {
      setStats(null);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
  }, [token, filter]);

  useRealtime(["media_articles"], token, () => load(filter));

  async function runNow() {
    setRunning(true);
    setMessage("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/media-monitor`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_now" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo ejecutar.");
      setMessage(`Listo: ${data.analyzed} notas analizadas en esta pasada.`);
      await load(filter);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo ejecutar el barrido.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>ANÁLISIS ALGORÍTMICO</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <p className="ext-note" style={{ marginTop: 0 }}>
          Barrido diario (automático, 8am) de medios digitales de Tucumán, clasificado con IA: menciones de Tucumán, San Miguel de Tucumán y Ernesto Nagle, con el tono de cada nota.
        </p>

        {stats && (
          <div className="stats-grid">
            <div className="stat-card"><b>{stats.menciona_nagle_7d}</b><p>Nagle · 7 días</p></div>
            <div className="stat-card"><b>{stats.menciona_smt_7d}</b><p>San Miguel · 7 días</p></div>
            <div className="stat-card"><b>{stats.menciona_tucuman_7d}</b><p>Tucumán · 7 días</p></div>
            <div className="stat-card"><b>{stats.total}</b><p>Notas rastreadas</p></div>
          </div>
        )}

        {stats && stats.tono_favorable + stats.tono_neutro + stats.tono_desfavorable > 0 && (
          <div className="log-list" style={{ marginBottom: 16 }}>
            <div className="log-row" style={{ cursor: "default" }}>
              <span className="badge ok">{stats.tono_favorable}</span>
              <div><b>Favorable</b></div>
            </div>
            <div className="log-row" style={{ cursor: "default" }}>
              <span className="badge neutral">{stats.tono_neutro}</span>
              <div><b>Neutro</b></div>
            </div>
            <div className="log-row" style={{ cursor: "default" }}>
              <span className="badge danger">{stats.tono_desfavorable}</span>
              <div><b>Desfavorable</b></div>
            </div>
          </div>
        )}

        {isSuperadmin && (
          <div style={{ marginBottom: 16 }}>
            <button className="ext-btn full" onClick={runNow} disabled={running}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} strokeWidth={2.5} className={running ? "spin" : ""} /> {running ? "ANALIZANDO…" : "ACTUALIZAR AHORA"}
              </span>
            </button>
            {message && <p className="ext-note">{message}</p>}
          </div>
        )}

        {temas && (temas.temas?.length > 0 || temas.otros_mencionados?.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            <p className="bell-popover-title" style={{ margin: "0 0 8px 2px" }}>Temas en la prensa · últimos 30 días</p>
            {temas.temas?.length > 0 && (
              <div className="log-list" style={{ marginBottom: temas.otros_mencionados?.length ? 8 : 0 }}>
                {temas.temas.slice(0, 6).map((t) => (
                  <div key={t.tema} className="log-row" style={{ cursor: "default" }}>
                    <span className="badge neutral">{t.count}</span>
                    <div><b>{t.tema}</b></div>
                  </div>
                ))}
              </div>
            )}
            {temas.otros_mencionados?.length > 0 && (
              <div className="log-list">
                {temas.otros_mencionados.slice(0, 6).map((o) => (
                  <div key={o.nombre} className="log-row" style={{ cursor: "default" }}>
                    <span className="badge sm neutral">{o.count}</span>
                    <div><b>{o.nombre}</b><p>Mencionado junto a la cobertura política</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {cobertura.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p className="bell-popover-title" style={{ margin: "0 0 8px 2px" }}>Territorio: circuitos con menor cobertura</p>
            <p className="ext-note" style={{ marginTop: 0, marginBottom: 8 }}>
              % de votantes del padrón con algún rol asignado (movilizador, fiscal o votante en rol), por circuito.
            </p>
            <div className="log-list">
              {cobertura.slice(0, 8).map((c) => (
                <div key={c.circuito} className="log-row" style={{ cursor: "default" }}>
                  <span className={`badge ${c.cobertura_pct != null && c.cobertura_pct < 2 ? "danger" : c.cobertura_pct != null && c.cobertura_pct < 5 ? "neutral" : "ok"}`}>
                    {c.cobertura_pct != null ? `${c.cobertura_pct}%` : "—"}
                  </span>
                  <div>
                    <b>Circuito {c.circuito}{c.circuito_nombre ? ` · ${c.circuito_nombre}` : ""}</b>
                    <p>{c.total_padron.toLocaleString("es-AR")} votantes · {c.movilizadores + c.fiscales + c.colaboradores} con rol asignado</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="config-tabs" style={{ marginBottom: 14 }}>
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        {loading && <p className="empty">Cargando…</p>}
        {!loading && !articles.length && <p className="empty">No hay notas para este filtro todavía.</p>}
        <div className="log-list">
          {articles.map((a) => (
            <a key={a.id} href={a.link} target="_blank" rel="noreferrer" className="log-row" style={{ alignItems: "flex-start", textDecoration: "none", color: "inherit" }}>
              {a.tono ? (
                <span className={`badge ${TONO_BADGE[a.tono]}`}>{TONO_LABEL[a.tono]}</span>
              ) : (
                <span className="badge neutral">{a.analyzed_at ? "—" : "Pendiente"}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{a.title}</b>
                <p>
                  {a.source_name} {a.published_at ? `· ${formatDateTime(a.published_at)}` : ""}
                </p>
                {a.analysis_note && <p style={{ fontStyle: "italic" }}>{a.analysis_note}</p>}
              </div>
              <ExternalLink size={14} strokeWidth={2} style={{ flex: "none", marginTop: 3, color: "var(--muted)" }} />
            </a>
          ))}
        </div>
      </section>
      <ScrollTopButton />
    </main>
  );
}
