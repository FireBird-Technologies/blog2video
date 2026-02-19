import type React from "react";

export const glassCardStyle = (
  accentColor: string,
  opacity = 0.08
): React.CSSProperties => ({
  backgroundColor: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 20,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
});
