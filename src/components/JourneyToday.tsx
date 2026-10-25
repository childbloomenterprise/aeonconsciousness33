import { useState } from "react";
import { ArrowUpRight, X, Sparkles } from "lucide-react";
import { format } from "date-fns";
import type { Journey, JourneyEvent } from "../../shared/contracts";
import { Button } from "./ui";
import "./journey-now.css";

export function todaySuggestion(
  journey: Journey,
  events: JourneyEvent[],
  now = new Date(),
) {
  const date = format(now, "yyyy-MM-dd");
  const records = events.filter(
    (event) =>
      event.journey_id === journey.id &&
      event.occurred_at &&
      format(new Date(event.occurred_at), "yyyy-MM-dd") === date,
  );
  if (journey.status === "completed")
    return {
      kind: "reflect",
      title: `Your ${journey.destination_name} story`,
      body: "Return to the moments you chose to remember, or add a detail while it is fresh.",
      action: "View this journey",
      reason: "This journey is marked completed.",
    };
  if (Date.parse(journey.started_at) > now.getTime())
    return {
      kind: "prepare",
      title: `A little preparation for ${journey.destination_name}`,
      body: "Keep your journey ready for stretches with a weak signal.",
      action: "Prepare my journey",
      reason:
        "Your departure date is still ahead. Offline readiness is shown in your journey.",
    };
  if (!records.some((event) => event.event_type === "meal"))
    return {
      kind: "food",
      title: `A taste of ${journey.destination_name}`,
      body: "Discover local dishes, check ingredients with the person preparing them, and save a meal you enjoyed.",
      action: "Explore local flavours",
      reason:
        "Based on your chosen destination. No meal is recorded for today; that does not mean you have not eaten.",
    };
  return {
    kind: "capture",
    title: "A little more of today, remembered",
    body: "Your meal is in this journey. Add a place, a walk, or another moment you would like to keep.",
    action: "Add a moment",
    reason:
      "Based on a meal you recorded in this journey today. This is a travel suggestion, not a health assessment.",
  };
}
function read(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
export function JourneyToday({
  journey,
  events,
  scope,
  onFood,
  onMeal,
  onCapture,
  onJourney,
}: {
  journey: Journey;
  events: JourneyEvent[];
  scope: string;
  onFood: () => void;
  onMeal: () => void;
  onCapture: () => void;
  onJourney: () => void;
}) {
  const key = `linc-today:${scope}:${journey.id}:${format(new Date(), "yyyy-MM-dd")}`;
  const preference = `linc-today-enabled:${scope}`;
  const [state, setState] = useState(() => read(key));
  const [enabled, setEnabled] = useState(() => read(preference) !== "false");
  const suggestion = todaySuggestion(journey, events);
  const update = (value: string) => {
    setState(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* tab state remains usable */
    }
  };
  const toggle = () => {
    setEnabled(!enabled);
    try {
      localStorage.setItem(preference, String(!enabled));
    } catch {
      /* optional */
    }
  };
  if (!enabled || state === "dismissed")
    return (
      <section className="journey-now" aria-label="Journey suggestions">
        <button
          className="subtle-link"
          onClick={() => {
            if (!enabled) toggle();
            update("");
          }}
        >
          Show today's journey suggestion
        </button>
      </section>
    );
  const followUp = state === "explored" && suggestion.kind === "food";
  return (
    <section className="journey-now" aria-label="Today on your journey">
      <div className="journey-now-top">
        <span>
          <Sparkles size={14} aria-hidden="true" /> Today, on your journey
        </span>
        <button
          className="journey-now-dismiss"
          aria-label="Dismiss today's suggestion"
          onClick={() => update("dismissed")}
        >
          <X size={17} />
        </button>
      </div>
      <h2>
        {followUp
          ? "Found something you would like to remember?"
          : suggestion.title}
      </h2>
      <p>
        {followUp
          ? "Add a meal you actually ate to this journey. You can review it before saving."
          : suggestion.body}
      </p>
      <div className="journey-now-actions">
        <Button
          onClick={() => {
            if (followUp) onMeal();
            else if (suggestion.kind === "capture") onCapture();
            else if (suggestion.kind === "food") {
              update("explored");
              onFood();
            } else onJourney();
          }}
        >
          {followUp ? "Add my meal" : suggestion.action}
          <ArrowUpRight size={16} />
        </Button>
        {followUp && (
          <button className="subtle-link" onClick={() => update("dismissed")}>
            Maybe later
          </button>
        )}
      </div>
      <details>
        <summary>Why this suggestion?</summary>
        <p>{suggestion.reason}</p>
        <p>
          You can change your destination and preferences in Journeys and
          Profile.
        </p>
        <button className="subtle-link" onClick={toggle}>
          Turn off journey suggestions
        </button>
      </details>
    </section>
  );
}
