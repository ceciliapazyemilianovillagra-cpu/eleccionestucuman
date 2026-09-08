"use client";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "./shared";

export function Apariencia({ token }: { token: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [opacity, setOpacity] = useState(15);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=key,value&key=in.(background_image_url,background_opacity)`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      });
      const rows: { key: string; value: string | null }[] = await res.json();
      const url = rows.find((r) => r.key === "background_image_url")?.value ?? "";
      const op = rows.find((r) => r.key === "background_opacity")?.value;
      setImageUrl(url);
      setUrlInput(url);
      setOpacity(op ? Number(op) : 15);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function saveSetting(key: string, value: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value }),
    });
  }

  async function saveUrl(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await saveSetting("background_image_url", urlInput.trim());
      setImageUrl(urlInput.trim());
      setMessage("Guardado.");
    } catch {
      setMessage("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOpacity(value: number) {
    setOpacity(value);
    await saveSetting("background_opacity", String(value));
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `fondo-${Date.now()}.${ext}`;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/branding/${path}`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("No se pudo subir la imagen.");
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
      await saveSetting("background_image_url", publicUrl);
      setImageUrl(publicUrl);
      setUrlInput(publicUrl);
      setMessage("Imagen subida y guardada.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    setSaving(true);
    try {
      await saveSetting("background_image_url", "");
      setImageUrl("");
      setUrlInput("");
      setMessage("Imagen quitada.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="empty">Cargando…</p>;

  return (
    <div>
      <p className="ext-note" style={{ marginTop: 0 }}>
        Una foto de fondo, bien transparente, para la pantalla de inicio (donde están los módulos). Pegá el enlace de una foto de internet, o subí un archivo. Ajustá la transparencia para que no compita con el texto.
      </p>
      <form className="search-card" onSubmit={saveUrl} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <label>
          Enlace de la foto
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." />
        </label>
        <button disabled={saving}>{saving ? "GUARDANDO…" : "GUARDAR ENLACE"}</button>
      </form>
      <div className="search-card" style={{ marginBottom: 16 }}>
        <label className="ext-btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          {uploading ? "SUBIENDO…" : "SUBIR ARCHIVO"}
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} disabled={uploading} />
        </label>
      </div>
      {imageUrl && (
        <div className="search-card" style={{ marginBottom: 16 }}>
          <p className="eyebrow" style={{ margin: "0 0 10px" }}>TRANSPARENCIA ({opacity}%)</p>
          <input type="range" min={0} max={60} value={opacity} onChange={(e) => saveOpacity(Number(e.target.value))} style={{ width: "100%" }} />
          <div style={{ position: "relative", marginTop: 14, borderRadius: 12, overflow: "hidden", background: "#eef1f6", height: 140 }}>
            <img src={imageUrl} alt="Vista previa" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: opacity / 100 }} />
          </div>
          <button type="button" className="ext-btn secondary" onClick={removeImage} disabled={saving} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ImageOff size={14} strokeWidth={2} /> QUITAR IMAGEN
          </button>
        </div>
      )}
      {message && <p className="form-message">{message}</p>}
    </div>
  );
}
