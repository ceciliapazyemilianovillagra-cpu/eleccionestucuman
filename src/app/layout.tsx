import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./profile.css";
export const metadata: Metadata = { title: "Elecciones Tucumán", description: "Gestión territorial", applicationName: "Elecciones Tucumán", appleWebApp: { capable: true, title: "Elecciones Tucumán", statusBarStyle: "black-translucent" }, icons: { icon: "/icon.svg", apple: "/apple-icon" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#17285f" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="es"><body>{children}</body></html>; }

