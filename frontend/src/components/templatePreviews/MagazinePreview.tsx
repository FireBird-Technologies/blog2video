const MagazinePreview = ({ thumbnailMode = false }: { thumbnailMode?: boolean }) => {
  void thumbnailMode;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#FDFCFB",
        color: "#1A1A1A",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 20% 30%, #E6394622, transparent 50%), radial-gradient(circle at 80% 70%, #E6394633, transparent 55%)",
        }}
      />
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Magazine</div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Glossy editorial storytelling</div>
        <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 22,
                height: 4,
                borderRadius: 99,
                background: i === 0 ? "#E63946" : "#1A1A1A22",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MagazinePreview;
