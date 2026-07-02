const SakuraPreview = ({ thumbnailMode = false }: { thumbnailMode?: boolean }) => {
  void thumbnailMode;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#FDF6F0",
        color: "#2A0A12",
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
          background: "radial-gradient(circle at 20% 30%, #C0143C22, transparent 50%), radial-gradient(circle at 80% 70%, #C0143C33, transparent 55%)",
        }}
      />
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Sakura</div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Japanese-aesthetic blog-to-video theme</div>
        <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 22,
                height: 4,
                borderRadius: 99,
                background: i === 0 ? "#C0143C" : "#2A0A1222",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SakuraPreview;
