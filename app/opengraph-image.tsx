import { ImageResponse } from "next/og";

export const alt = "Eat Healthier: healthy delivery across the GTA, ranked for your biomarkers, diet and budget";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#059669";

function Mark({ size: s }: { size: number }) {
  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: s * 0.24,
        background: "linear-gradient(170deg, #ffffff 0%, #f1f2f4 100%)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={s * 0.56} height={s * 0.56} viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    </div>
  );
}

export default function OpenGraphImage() {
  const chips = ["Nutri-Score", "Harvard AHEI", "Health Canada flags", "549 GTA restaurants"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0a0a0a 0%, #111613 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Mark size={120} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, letterSpacing: 6, color: "#9ca3af" }}>EAT HEALTHIER</div>
            <div style={{ fontSize: 26, color: "#6b7280", marginTop: 6 }}>eat-healthier.vercel.app</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 68, lineHeight: 1.08, letterSpacing: -2 }}>
            <div>Healthy delivery across the GTA,</div>
            <div style={{ display: "flex" }}>
              ranked for
              <span style={{ color: BRAND, marginLeft: 18 }}>you</span>
            </div>
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa", maxWidth: 980, lineHeight: 1.35 }}>
            Say what you feel like eating. Get dishes scored for your biomarkers, diet and budget, with the cheapest combo at every restaurant.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                fontSize: 24,
                padding: "10px 20px",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#e5e7eb",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
