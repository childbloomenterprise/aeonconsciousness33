import { useEffect, useRef, useState, type FormEvent } from "react";
import { Compass, Check, MapPin } from "lucide-react";
import { format } from "date-fns";
import { journeyInput, eventDraft, type Journey } from "../../shared/contracts";
import { useLinc } from "../state";
import {
  destinationChoices,
  destinationVisual,
} from "../lib/destinationVisual";
import { Button, ErrorBox, Modal } from "./ui";
import "./journey-now.css";
function today() {
  return format(new Date(), "yyyy-MM-dd");
}
function readDraft() {
  try {
    const draft = JSON.parse(
      localStorage.getItem("linc-journey-draft") || "{}",
    );
    return {
      destination:
        typeof draft.destination === "string" ? draft.destination : "",
      title: typeof draft.title === "string" ? draft.title : "",
      start: /^\d{4}-\d{2}-\d{2}$/.test(draft.start) ? draft.start : today(),
      end: /^\d{4}-\d{2}-\d{2}$/.test(draft.end) ? draft.end : "",
    };
  } catch {
    return { destination: "", title: "", start: today(), end: "" };
  }
}
export function JourneyForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const {
    signedIn,
    setAuthOpen,
    call,
    refresh,
    notify,
    activeJourney,
    selectJourney,
    profile,
    rememberJourney,
  } = useLinc();
  const [draft, setDraft] = useState(readDraft);
  const [travelDetails, setTravelDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const { destination, title, start, end } = draft;
  const change = (key: keyof typeof draft, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (!open || !destination.trim()) return;
    try {
      localStorage.setItem("linc-journey-draft", JSON.stringify(draft));
    } catch {
      /* optional storage */
    }
  }, [open, draft, destination]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    if (
      !start ||
      !Number.isFinite(Date.parse(start)) ||
      (end && !Number.isFinite(Date.parse(end)))
    ) {
      setError("Choose a valid departure and return date.");
      return;
    }
    const parsed = journeyInput.safeParse({
      title: title.trim() || `${destination.trim()} trip`.slice(0, 120),
      destination_name: destination.trim(),
      started_at: new Date(`${start}T00:00:00`).toISOString(),
      ended_at: end ? new Date(`${end}T23:59:59`).toISOString() : null,
    });
    if (!parsed.success) {
      setError(
        "Choose a destination and check that your return date follows departure.",
      );
      return;
    }
    if (!signedIn) {
      try {
        localStorage.setItem("linc-pending-journey", "1");
        localStorage.setItem("linc-journey-draft", JSON.stringify(draft));
      } catch {
        /* optional */
      }
      onClose();
      setAuthOpen(true);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const created = await call<Journey>("journeys", "POST", parsed.data);
      // The committed trip opens without downloading old account histories.
      if (rememberJourney) rememberJourney(created);
      else {
        selectJourney(created.id);
        void refresh();
      }
      try {
        localStorage.removeItem("linc-pending-journey");
        localStorage.removeItem("linc-journey-draft");
      } catch {
        /* optional */
      }
      notify("Your journey and its companion are ready.");
      onClose();
      onCreated?.();
      setDraft({ destination: "", title: "", start: today(), end: "" });
      if (travelDetails.trim() && profile.consents.sensitive_storage) {
        const details = travelDetails.trim();
        setTravelDetails("");
        void call("events", "POST", {
          request_id: crypto.randomUUID(),
          journey_id: created.id,
          event: eventDraft.parse({
            event_type: "note",
            title: "Travel preferences",
            description: details,
            occurred_at: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        })
          .then(() => refresh(["events"]))
          .catch(() =>
            notify(
              "Journey created. Travel details could not be saved; add them as a note in your feed.",
            ),
          );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
      title="Where are we heading?"
      description="Pick a destination. Leave today, or change your dates below."
    >
      <form className="form-stack quick-journey" onSubmit={submit}>
        <label>
          Destination
          <div className="input-icon">
            <MapPin size={18} />
            <input
              value={destination}
              onChange={(e) => change("destination", e.target.value)}
              maxLength={160}
              required
              placeholder="Dubai, Mumbai, a waterfall, or anywhere else"
              autoComplete="off"
            />
          </div>
        </label>
        <fieldset className="quick-destinations">
          <legend>Or pick a place</legend>
          <div>
            {destinationChoices.map((place) => (
              <button
                type="button"
                key={place.name}
                aria-pressed={destination === place.name}
                onClick={() => change("destination", place.name)}
              >
                {place.photo ? (
                  <img
                    src={place.photo}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span
                    className="destination-initial"
                    style={{
                      background: destinationVisual(place.name).gradient,
                    }}
                    aria-hidden="true"
                  >
                    {place.name.slice(0, 1)}
                  </span>
                )}
                <span>{place.name}</span>
                {destination === place.name && <Check size={14} />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="quick-journey-summary">
          <Compass size={18} />
          <span>
            {start === today() ? "Leaving today" : `Leaving ${start}`} ·{" "}
            {end ? `returning ${end}` : "return whenever you like"}
          </span>
        </div>
        <details className="quick-journey-details">
          <summary>Change dates & optional details</summary>
          <div className="form-stack">
            <div className="quick-date-row">
              <label>
                Departure
                <input
                  type="date"
                  value={start}
                  required
                  onChange={(e) => change("start", e.target.value)}
                />
              </label>
              <label>
                Return (optional)
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => change("end", e.target.value)}
                />
              </label>
            </div>
            <label>
              Journey name (optional)
              <input
                value={title}
                onChange={(e) => change("title", e.target.value)}
                maxLength={120}
                placeholder="A little mountain escape"
              />
            </label>
            <label>
              Travel details (optional)
              <textarea
                aria-label="Travel details"
                value={travelDetails}
                onChange={(e) => setTravelDetails(e.target.value)}
                maxLength={1000}
                disabled={!profile.consents.sensitive_storage}
                placeholder="Your pace, food preferences, or what you want from this trip."
              />
            </label>
            <p className="small muted">
              {profile.consents.sensitive_storage
                ? "Travel details are saved as a note in this journey."
                : "Enable private storage in Profile to save travel details."}
            </p>
          </div>
        </details>
        {activeJourney && (
          <p className="small muted">
            Starting a new journey will complete "{activeJourney.title}". Its
            records remain available.
          </p>
        )}
        {error && <ErrorBox message={error} />}
        {!signedIn && (
          <p className="small muted">
            Sign in to save this journey. Your destination and dates stay on
            this device through sign-in.
          </p>
        )}
        <div className="quick-journey-submit">
          <Button
            type="submit"
            loading={busy}
            disabled={!destination.trim() || busy}
          >
            <Compass size={18} />
            {signedIn ? "Start my journey" : "Continue to sign in"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
