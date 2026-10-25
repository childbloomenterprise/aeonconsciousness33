import { useEffect } from "react";

const revealTargets =
  ".feed-event, .cuisine-card, .place-card, .journey-card, .consent-card, .profile-form, .food-whisper, .photo-preview, .empty-state, .feed-empty, .rhythm-section";
const lightTargets =
  ".cuisine-card, .place-card, .journey-card, .destination-choice, .feed-capture, .conversation-card, .feed-event";
const pressTargets = "button, .button, .nav-link, .destination-choice";

/** One delegated motion layer; never intercepts clicks, focus, or submission. */
export function MotionPolish() {
  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let dispose = () => {};
    function configure() {
      dispose();
      dispose = () => {};
      if (
        preference?.matches ||
        document.documentElement.dataset.motionPaused === "true"
      )
        return;
      const seen = new WeakSet<Element>();
      const decorated = new Set<HTMLElement>();
      const finePointer = window.matchMedia?.(
        "(hover: hover) and (pointer: fine)",
      );
      let lightFrame = 0;
      let activeLight: HTMLElement | null = null;
      let lightX = 0;
      let lightY = 0;
      const clearLight = () => {
        activeLight?.removeAttribute("data-light-active");
        activeLight = null;
      };
      const illuminate = (event: PointerEvent) => {
        if (
          !finePointer?.matches ||
          event.pointerType === "touch" ||
          !(event.target instanceof Element)
        )
          return;
        const target = event.target.closest<HTMLElement>(lightTargets);
        if (target !== activeLight) clearLight();
        if (!target) return;
        activeLight = target;
        if (!decorated.has(target)) {
          decorated.add(target);
          if (getComputedStyle(target).position === "static")
            target.classList.add("fx-surface");
          const light = document.createElement("span");
          light.className = "card-light";
          light.setAttribute("aria-hidden", "true");
          target.appendChild(light);
        }
        lightX = event.clientX;
        lightY = event.clientY;
        if (lightFrame) return;
        lightFrame = requestAnimationFrame(() => {
          lightFrame = 0;
          if (!activeLight?.isConnected) return clearLight();
          const rect = activeLight.getBoundingClientRect();
          activeLight.style.setProperty("--light-x", `${lightX - rect.left}px`);
          activeLight.style.setProperty("--light-y", `${lightY - rect.top}px`);
          activeLight.setAttribute("data-light-active", "true");
        });
      };
      const pending = new Set<Element>();
      const waves = new Set<HTMLElement>();
      const surfaces = new Set<HTMLElement>();
      const positioned = new Set<HTMLElement>();
      let frame = 0;
      const observer =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(
              (items) => {
                for (const item of items) {
                  if (!item.isIntersecting) continue;
                  item.target.setAttribute("data-motion-reveal", "arrive");
                  observer?.unobserve(item.target);
                }
              },
              { threshold: 0.08 },
            );
      const inspect = (root: Element) => {
        const elements = [
          ...(root.matches(revealTargets) ? [root] : []),
          ...root.querySelectorAll(revealTargets),
        ];
        for (const element of elements) {
          if (seen.has(element)) continue;
          seen.add(element);
          if (element instanceof HTMLElement) {
            const index = Array.from(
              element.parentElement?.children ?? [],
            ).indexOf(element);
            element.style.setProperty(
              "--reveal-delay",
              `${Math.min(Math.max(index, 0), 5) * 45}ms`,
            );
          }
          observer?.observe(element);
        }
      };
      inspect(document.body);
      const mutations = new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) {
            if (
              node instanceof Element &&
              !node.classList.contains("touch-wave")
            )
              pending.add(node);
          }
        if (!pending.size || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          pending.forEach(inspect);
          pending.clear();
        });
      });
      mutations.observe(document.body, { childList: true, subtree: true });
      const press = (event: PointerEvent) => {
        if (event.button !== 0 || !(event.target instanceof Element)) return;
        const target = event.target.closest<HTMLElement>(pressTargets);
        if (
          !target ||
          target.matches(":disabled, [aria-disabled='true']") ||
          typeof target.animate !== "function"
        )
          return;
        // No extra DOM inside inputs, select options, or text-only inline links.
        if (!target.classList.contains("press-feedback")) {
          target.classList.add("press-feedback");
          surfaces.add(target);
        }
        if (getComputedStyle(target).position === "static") {
          target.classList.add("press-surface");
          positioned.add(target);
        }
        const rect = target.getBoundingClientRect();
        const diameter = Math.min(360, Math.max(rect.width, rect.height) * 1.7);
        const wave = document.createElement("span");
        wave.className = "touch-wave";
        wave.setAttribute("aria-hidden", "true");
        Object.assign(wave.style, {
          width: `${diameter}px`,
          height: `${diameter}px`,
          left: `${event.clientX - rect.left - diameter / 2}px`,
          top: `${event.clientY - rect.top - diameter / 2}px`,
        });
        target.appendChild(wave);
        waves.add(wave);
        const animation = wave.animate(
          [
            { transform: "scale(0)", opacity: 0.2 },
            { transform: "scale(1)", opacity: 0 },
          ],
          { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
        const remove = () => {
          waves.delete(wave);
          wave.remove();
        };
        animation.onfinish = remove;
        animation.oncancel = remove;
      };
      document.addEventListener("pointerdown", press, { passive: true });
      document.addEventListener("pointermove", illuminate, { passive: true });
      document.addEventListener("pointerleave", clearLight);
      window.addEventListener("blur", clearLight);
      window.addEventListener("scroll", clearLight, {
        passive: true,
        capture: true,
      });
      dispose = () => {
        observer?.disconnect();
        cancelAnimationFrame(lightFrame);
        clearLight();
        document.removeEventListener("pointermove", illuminate);
        document.removeEventListener("pointerleave", clearLight);
        window.removeEventListener("blur", clearLight);
        window.removeEventListener("scroll", clearLight, true);
        decorated.forEach((target) => {
          target.querySelector(":scope > .card-light")?.remove();
          target.classList.remove("fx-surface");
          target.style.removeProperty("--light-x");
          target.style.removeProperty("--light-y");
        });
        decorated.clear();
        mutations.disconnect();
        cancelAnimationFrame(frame);
        document.removeEventListener("pointerdown", press);
        waves.forEach((wave) => {
          wave.getAnimations?.().forEach((animation) => animation.cancel());
          wave.remove();
        });
        waves.clear();
        pending.clear();
        surfaces.forEach((target) => target.classList.remove("press-feedback"));
        positioned.forEach((target) =>
          target.classList.remove("press-surface"),
        );
        document.querySelectorAll("[data-motion-reveal]").forEach((element) => {
          element.removeAttribute("data-motion-reveal");
          (element as HTMLElement).style.removeProperty("--reveal-delay");
        });
      };
    }
    const visibility = () => {
      document.documentElement.dataset.pageHidden = String(document.hidden);
      if (document.hidden) dispose();
      else configure();
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    preference?.addEventListener?.("change", configure);
    window.addEventListener("linc-motion-change", configure);
    return () => {
      dispose();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("linc-motion-change", configure);
      preference?.removeEventListener?.("change", configure);
    };
  }, []);
  return null;
}
