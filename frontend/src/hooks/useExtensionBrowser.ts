import { useEffect, useState } from "react";
import {
  detectBraveAsync,
  detectExtensionBrowser,
  type ExtensionBrowser,
} from "../lib/browserSupport";

const BRAVE: ExtensionBrowser = { id: "brave", name: "Brave", logo: "/browser-logos/brave.svg" };

/** The visitor's extension-capable browser, or null (Safari, Firefox, mobile). */
export function useExtensionBrowser(): ExtensionBrowser | null {
  const [browser, setBrowser] = useState<ExtensionBrowser | null>(detectExtensionBrowser);

  useEffect(() => {
    // Brave looks exactly like Chrome in its UA — only an async API gives it away.
    if (browser?.id !== "chrome") return;
    let cancelled = false;
    detectBraveAsync().then((isBrave) => {
      if (isBrave && !cancelled) setBrowser(BRAVE);
    });
    return () => {
      cancelled = true;
    };
  }, [browser?.id]);

  return browser;
}
