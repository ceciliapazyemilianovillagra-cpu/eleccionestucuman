import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./profile.css";
import "./mobile.css";
import "./panel/panel.css";
export const metadata: Metadata = { title: "Elecciones Tucumán", description: "Gestión territorial", applicationName: "Elecciones Tucumán", appleWebApp: { capable: true, title: "Elecciones Tucumán", statusBarStyle: "black-translucent" }, icons: { icon: "/icon.svg", apple: "/apple-icon" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#17285f" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

