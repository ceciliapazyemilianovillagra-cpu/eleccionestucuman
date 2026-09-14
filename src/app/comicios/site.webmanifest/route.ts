import { NextResponse } from "next/server";

// Next.js solo soporta el archivo de convencion "manifest.ts" en la raiz de /app.
// Para tener un manifest propio de Pulso Electoral (nombre y no el de "Elecciones
// Tucuman" al agregar a inicio en iOS) armamos este route handler a mano.
export function GET() {
  return NextResponse.json(
    {
      name: "Pulso Electoral",
      short_name: "Pulso Electoral",
      description: "Gestión y Logística Territorial",
      start_url: "/comicios",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#17285f",
      orientation: "portrait",
      icons: [
        { src: "/comicios/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/comicios/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
