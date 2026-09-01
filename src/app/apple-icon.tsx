import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#17285f" }}>
      <div style={{ width: 144, height: 144, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 72, background: "#70a8d5" }}>
        <div style={{ width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 48, background: "white" }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: "#70a8d5" }} />
        </div>
      </div>
    </div>,
    { ...size },
  );
}

