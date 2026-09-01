import type { Metadata } from "next";
import "./globals.css";
import "./profile.css";
export const metadata: Metadata = { title: "Elecciones Tucumán", description: "Gestión territorial" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="es"><body>{children}</body></html>; }
