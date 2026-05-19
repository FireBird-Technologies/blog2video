import { useState } from "react";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/solid";
import { SupportChat } from "./SupportChat";

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
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
