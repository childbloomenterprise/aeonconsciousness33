import { useEffect, useState } from "react";
import { Pause, Play, Plane } from "lucide-react";

export function TravelScenery() {
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem("linc-motion-paused") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.motionPaused = String(paused);
    try {
      localStorage.setItem("linc-motion-paused", String(paused));
    } catch {
      /* Storage is optional. */
    }
    window.dispatchEvent(new Event("linc-motion-change"));
  }, [paused]);
  return (
    <>
      <div
        className={"travel-scenery " + (paused ? "is-paused" : "")}
        aria-hidden="true"
      >
        <div className="travel-aura aura-sun" />
        <div className="travel-aura aura-ocean" />
        <div className="travel-cloud cloud-one" />
        <div className="travel-cloud cloud-two" />
        <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
          <path
            className="travel-route"
            d="M-50 520 C160 610 200 150 460 240 S760 570 910 280 S1170 90 1300 190"
          />
          <circle cx="460" cy="240" r="7" />
          <circle cx="910" cy="280" r="7" />
          <path
            className="travel-hills"
            d="M0 700 L0 640 Q180 440 360 640 Q600 340 840 620 Q1050 430 1200 630 L1200 700Z"
          />
        </svg>
        <div className="travel-plane">
          <Plane size={28} strokeWidth={1.3} />
        </div>
      </div>
      <button
        type="button"
        className="scenery-toggle"
        aria-pressed={paused}
        onClick={() => setPaused((v) => !v)}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
        {paused ? "Play effects" : "Pause effects"}
      </button>
    </>
  );
}
