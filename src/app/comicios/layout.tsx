import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulso Electoral",
  description: "Gestión y Logística Territorial",
  applicationName: "Pulso Electoral",
  appleWebApp: { capable: true, title: "Pulso Electoral", statusBarStyle: "black-translucent" },
  icons: { icon: "/comicios/icon.png", apple: "/comicios/apple-icon.png" },
};

export default function ComiciosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
