"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SUPABASE_URL, SUPABASE_KEY, rpc, decodeJwtSub, formatDateTime } from "./shared";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });
}

const ICONS = {
  fiscal: makeIcon("#1478b8"),
  movilizador: makeIcon("#28b88a"),
  bunker: makeIcon("#17285f"),
  punto_caliente: makeIcon("#e04b3f"),
  otro: makeIcon("#f2a23a"),
};

const STATUS_LABEL: Record<string, string> = { buscado: "Buscado", votando: "Votando", devuelta: "Devuelta" };

type FiscalLoc = { mesa: string; fiscal_nombre: string; latitude: number; longitude: number; marked_at: string };
type TransportLoc = { voter_id: number; voter_nombre: string; mobilizer_nombre: string | null; status: string; latitude: number; longitude: number; marked_at: string };
type MapPoint = { id: number; type: "bunker" | "punto_caliente" | "otro"; label: string; description: string | null; latitude: number; longitude: number };

const FILTERS = [
  { key: "fiscal", label: "Fiscales", color: "#1478b8" },
  { key: "movilizador", label: "Movilizadores", color: "#28b88a" },
  { key: "bunker", label: "Bunkers", color: "#17285f" },
  { key: "punto_caliente", label: "Puntos calientes", color: "#e04b3f" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({ token }: { token: string }) {
  const [fiscales, setFiscales] = useState<FiscalLoc[]>([]);
  const [transportes, setTransportes] = useState<TransportLoc[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [active, setActive] = useState<Set<FilterKey>>(new Set(FILTERS.map((f) => f.key)));
  const [adding, setAdding] = useState<"bunker" | "punto_caliente" | "otro" | null>(null);
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [f, t, headers] = await Promise.all([
      rpc(token, "list_fiscal_locations").catch(() => []),
      rpc(token, "list_transport_locations").catch(() => []),
      Promise.resolve({ apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }),
    ]);
    setFiscales(f || []);
    setTransportes(t || []);
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/map_points?select=*`, { headers }).then((r) => r.json());
    setPoints(Array.isArray(pr) ? pr : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  function toggle(key: FilterKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function savePoint(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingCoord || !adding) return;
    const uid = decodeJwtSub(token);
    await fetch(`${SUPABASE_URL}/rest/v1/map_points`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: adding, label, latitude: pendingCoord.lat, longitude: pendingCoord.lng, created_by: uid }),
    });
    setAdding(null);
    setPendingCoord(null);
    setLabel("");
    load();
  }

  async function deletePoint(id: number) {
    if (!window.confirm("¿Borrar este punto del mapa?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/map_points?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    load();
  }

  const center: [number, number] = [-26.8241, -65.2226];

  return (
    <div>
      <div className="map-filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`map-filter-btn ${active.has(f.key) ? "on" : ""}`} style={{ borderColor: f.color, color: active.has(f.key) ? "#fff" : f.color, background: active.has(f.key) ? f.color : "#fff" }} onClick={() => toggle(f.key)}>
            {f.label}
          </button>
        ))}
        <button className="ext-btn secondary" onClick={load} disabled={loading}>
          {loading ? "…" : "ACTUALIZAR"}
        </button>
      </div>
      <div className="map-add-row">
        {(["bunker", "punto_caliente", "otro"] as const).map((t) => (
          <button key={t} className={`ext-btn secondary ${adding === t ? "active-add" : ""}`} onClick={() => setAdding(adding === t ? null : t)}>
            {adding === t ? "CANCELAR" : t === "bunker" ? "+ BUNKER" : t === "punto_caliente" ? "+ PUNTO CALIENTE" : "+ OTRO"}
          </button>
        ))}
      </div>
      {adding && !pendingCoord && <p className="ext-note">Tocá el mapa donde querés colocar el punto.</p>}
      {pendingCoord && (
        <form className="search-card" onSubmit={savePoint} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input required placeholder="Nombre del punto" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          <button className="ext-btn">GUARDAR</button>
        </form>
      )}
      <div className="map-wrap">
        <MapContainer center={center} zoom={12} style={{ height: "60vh", width: "100%", borderRadius: 18 }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {adding && <ClickCatcher onClick={(lat, lng) => setPendingCoord({ lat, lng })} />}
          {active.has("fiscal") &&
            fiscales.map((f) => (
              <Marker key={`f-${f.mesa}`} position={[f.latitude, f.longitude]} icon={ICONS.fiscal}>
                <Popup>
                  <b>Mesa {f.mesa}</b>
                  <br />
                  Fiscal: {f.fiscal_nombre}
                  <br />
                  {formatDateTime(f.marked_at)}
                </Popup>
              </Marker>
            ))}
          {active.has("movilizador") &&
            transportes.map((t) => (
              <Marker key={`t-${t.voter_id}`} position={[t.latitude, t.longitude]} icon={ICONS.movilizador}>
                <Popup>
                  <b>{t.voter_nombre}</b>
                  <br />
                  Estado: {STATUS_LABEL[t.status] ?? t.status}
                  <br />
                  Movilizador: {t.mobilizer_nombre ?? "—"}
                  <br />
                  {formatDateTime(t.marked_at)}
                </Popup>
              </Marker>
            ))}
          {points
            .filter((p) => active.has(p.type as FilterKey) || (p.type === "otro" && true))
            .map((p) => (
              <Marker key={`p-${p.id}`} position={[p.latitude, p.longitude]} icon={ICONS[p.type]}>
                <Popup>
                  <b>{p.label}</b>
                  <br />
                  {p.type === "bunker" ? "Bunker" : p.type === "punto_caliente" ? "Punto caliente" : "Otro"}
                  <br />
                  <button className="ext-btn secondary" style={{ marginTop: 6 }} onClick={() => deletePoint(p.id)}>
                    BORRAR
                  </button>
                </Popup>
              </Marker>
            ))}
          {pendingCoord && <Marker position={[pendingCoord.lat, pendingCoord.lng]} icon={ICONS[adding ?? "otro"]} />}
        </MapContainer>
      </div>
    </div>
  );
}
