import { useEffect } from "react";

/** Follow the visible area on Safari as well as browsers that resize for the keyboard. */
export function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Preserve pinch zoom: zooming must never be interpreted as a keyboard.
        if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
        const height = viewport?.height ?? window.innerHeight;
        root.style.setProperty("--visible-height", `${height}px`);
        root.style.setProperty(
          "--visible-top",
          `${viewport?.offsetTop ?? 0}px`,
        );
        const editing = document.activeElement?.matches(
          "input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable=true]",
        );
        root.classList.toggle(
          "keyboard-open",
          !!editing && window.innerHeight - height > 140,
        );
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.style.removeProperty("--visible-height");
      root.style.removeProperty("--visible-top");
      root.classList.remove("keyboard-open");
    };
  }, []);
}
