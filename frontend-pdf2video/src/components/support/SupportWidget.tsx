import { useEffect, useState } from "react";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/solid";
import { SupportChat } from "./SupportChat";

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    setBubbleDismissed(true);
  };

  const bubbleVisible = showBubble && !bubbleDismissed && !open;

  return (
    <>
      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        .support-bubble-enter {
          animation: bob 3s ease-in-out infinite;
        }
      `}</style>

      {/* Cloud bubble */}
      <div
        style={{
          position: "fixed",
          bottom: 72,
          right: 12,
          zIndex: 9997,
          pointerEvents: bubbleVisible ? "auto" : "none",
          opacity: bubbleVisible ? 1 : 0,
          transform: bubbleVisible ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.45s ease, transform 0.45s ease",
        }}
        className={bubbleVisible ? "support-bubble-enter" : ""}
      >
        <svg
          width="130"
          height="66"
          viewBox="0 0 130 66"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.12))" }}
        >
          {/* Cloud body */}
          <path
            d="
              M 28 48
              Q 8 48 8 34
              Q 8 22 20 20
              Q 18 8 32 6
              Q 40 0 52 6
              Q 58 0 70 2
              Q 82 -2 88 8
              Q 100 4 104 16
              Q 116 18 114 30
              Q 114 44 98 46
              Q 90 52 80 48
              Q 68 54 56 50
              Q 44 54 36 50
              Q 30 52 28 48
              Z
            "
            fill="white"
          />
          {/* Tail dots — bottom-right, pointing toward button */}
          <circle cx="100" cy="53" r="4" fill="white" />
          <circle cx="108" cy="59" r="2.8" fill="white" />
          <circle cx="114" cy="63" r="1.6" fill="white" />
        </svg>

        {/* Text overlaid on cloud */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 10,
          paddingRight: 0,
          gap: 5,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
            👋 Need help?
          </span>
          <button
            onClick={() => setBubbleDismissed(true)}
            aria-label="Dismiss"
            style={{
              color: "#9CA3AF",
              fontSize: 15,
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 0 1px 0",
              marginLeft: 2,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#6B7280")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}
          >
            ×
          </button>
        </div>
      </div>

      <button
        onClick={handleOpen}
        aria-label={open ? "Close support" : "Open support"}
        className="fixed bottom-4 right-4 z-[9998] bg-purple-600 hover:bg-purple-700 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <ChatBubbleLeftIcon className="w-6 h-6" />
        )}
      </button>

      {open && <SupportChat onClose={() => setOpen(false)} />}
    </>
  );
}
