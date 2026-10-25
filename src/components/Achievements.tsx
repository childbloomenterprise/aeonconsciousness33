import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, Compass, Map, Sparkles, Check, Lock, X } from "lucide-react";
import { useLinc } from "../state";
import { Modal } from "./ui";
import "./achievements.css";

export function Achievements() {
  const {
    signedIn,
    loginCelebration = 0,
    profile,
    journeys,
    events,
    selectedJourney,
    authOpen,
    onboardingOpen,
    recovery,
    session,
    busy,
  } = useLinc();
  const [open, setOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [selected, setSelected] = useState("welcome");
  const delivered = useRef(0);
  const owner = session?.user.id;
  useEffect(() => {
    setCelebrate(false);
    setOpen(false);
    delivered.current = 0;
  }, [owner]);
  useEffect(() => {
    if (
      !signedIn ||
      recovery ||
      authOpen ||
      onboardingOpen ||
      busy ||
      !loginCelebration ||
      delivered.current === loginCelebration
    )
      return;
    const timer = window.setTimeout(() => {
      delivered.current = loginCelebration;
      setCelebrate(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    signedIn,
    loginCelebration,
    authOpen,
    onboardingOpen,
    recovery,
    owner,
    busy,
  ]);
  useEffect(() => {
    if (!celebrate) return;
    const timer = window.setTimeout(() => setCelebrate(false), 8000);
    return () => window.clearTimeout(timer);
  }, [celebrate]);
  const tripEvents = events.filter(
    (event) => event.journey_id === selectedJourney?.id,
  );
  const badges = [
    {
      id: "welcome",
      title: "You're on board",
      detail: "Your email sign-in connects you to your travel companion.",
      earned: signedIn,
      icon: Trophy,
    },
    {
      id: "journey",
      title: "A new horizon",
      detail: "Create your first journey to unlock this achievement.",
      earned: journeys.length > 0,
      icon: Compass,
    },
    {
      id: "moment",
      title: "A moment remembered",
      detail: "Save your first moment in the selected journey.",
      earned: tripEvents.length > 0,
      icon: Sparkles,
    },
    {
      id: "story",
      title: "A story taking shape",
      detail: "Save three moments in the selected journey.",
      earned: tripEvents.length >= 3,
      icon: Map,
    },
    {
      id: "explorer",
      title: "Further afield",
      detail: "Create journeys to two different destinations.",
      earned:
        new Set(journeys.map((j) => j.destination_name.trim().toLowerCase()))
          .size >= 2,
      icon: Compass,
    },
  ];
  const current = badges.find((b) => b.id === selected) || badges[0];
  const earned = badges.filter((b) => b.earned).length;
  if (!signedIn) return null;
  return (
    <>
      <button
        className="achievement-trigger icon-button"
        aria-label={`Achievements: ${earned} of ${badges.length} unlocked`}
        onClick={() => setOpen(true)}
      >
        <Trophy size={19} />
        <span>{earned}</span>
      </button>
      {celebrate &&
        !authOpen &&
        !onboardingOpen &&
        !recovery &&
        createPortal(
          <aside
            className="achievement-welcome"
            aria-label="Sign-in celebration"
          >
            <div className="achievement-confetti" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </div>
            <span className="achievement-medal" aria-hidden="true">
              <Trophy size={27} />
            </span>
            <div role="status">
              <small>ACHIEVEMENT UNLOCKED</small>
              <strong>
                You're on board
                {profile.display_name
                  ? `, ${profile.display_name.split(" ")[0]}`
                  : ""}
                !
              </strong>
              <p>Your next chapter starts here.</p>
            </div>
            <button
              className="achievement-view"
              onClick={() => {
                setCelebrate(false);
                setSelected("welcome");
                setOpen(true);
              }}
            >
              View achievements
            </button>
            <button
              className="icon-button achievement-dismiss"
              aria-label="Dismiss celebration"
              onClick={() => setCelebrate(false)}
            >
              <X size={16} />
            </button>
          </aside>,
          document.body,
        )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Little milestones. Real journeys."
        description="A collection of moments that make your journey yours. Tap a badge to explore."
      >
        <div className="achievement-progress">
          <span>
            {earned} of {badges.length} unlocked
          </span>
          <progress
            aria-label="Achievement progress"
            value={earned}
            max={badges.length}
          />
        </div>
        <div className="achievement-grid">
          {badges.map((badge) => (
            <button
              key={badge.id}
              className={`achievement-badge ${badge.earned ? "is-earned" : "is-locked"}`}
              aria-pressed={selected === badge.id}
              aria-label={`${badge.title}: ${badge.earned ? "unlocked" : "locked"}`}
              onClick={() => setSelected(badge.id)}
            >
              <span className="achievement-badge-icon">
                <badge.icon size={28} />
                {badge.earned ? (
                  <Check className="achievement-mark" size={14} />
                ) : (
                  <Lock className="achievement-mark" size={13} />
                )}
              </span>
              <strong>{badge.title}</strong>
              <small>{badge.earned ? "Unlocked" : "Keep exploring"}</small>
            </button>
          ))}
        </div>
        <div className="achievement-detail" aria-live="polite">
          <strong>{current.title}</strong>
          <p>{current.detail}</p>
          {current.earned && (
            <span>
              <Check size={14} /> You made this happen.
            </span>
          )}
        </div>
        <p className="small muted">
          Journey-moment badges reflect the journey you have selected.
        </p>
      </Modal>
    </>
  );
}
