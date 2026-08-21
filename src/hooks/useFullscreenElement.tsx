
import { useEffect, useState } from "react";

/**
 * The element currently in fullscreen, or null. Overlays (antd modals, tooltips,
 * dropdowns) are portalled to `document.body` by default, and a fullscreened element is
 * promoted to the top layer, where nothing outside its subtree paints: an overlay left
 * in the body is there but invisible. Anchoring them inside the fullscreen element
 * instead is what keeps them on screen.
 */
export function useFullscreenElement(): HTMLElement | null {
  const [fullscreenElement, setFullscreenElement] = useState<HTMLElement | null>(
    () => (document.fullscreenElement as HTMLElement | null) ?? null
  );

  useEffect(() => {
    const onChange = () =>
      setFullscreenElement((document.fullscreenElement as HTMLElement | null) ?? null);

    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return fullscreenElement;
}
