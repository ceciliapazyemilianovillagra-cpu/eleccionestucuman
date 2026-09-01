import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elecciones Tucumán",
    short_name: "Elecciones",
    description: "Gestión territorial electoral",
    start_url: "/",
    display: "standalone",
    background_color: "#17285f",
    theme_color: "#17285f",
    orientation: "portrait",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

