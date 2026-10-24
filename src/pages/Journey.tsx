import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  Compass,
  MapPin,
  Utensils,
  HeartPulse,
  Droplets,
  Pill,
  StickyNote,
  Footprints,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
} from "lucide-react";
import type { JourneyEvent, EventType } from "../../shared/contracts";
import { useLinc } from "../state";
import { Button, Empty, ErrorBox, Modal } from "../components/ui";
import { destinationVisual } from "../lib/destinationVisual";
import { DestinationBackdrop } from "../components/DestinationBackdrop";
import { OfflineJourneyPanel } from "../components/OfflineJourneyPanel";
import { entryIsPending } from "../lib/offline";
const icons = {
  meal: Utensils,
  symptom: HeartPulse,
  hydration: Droplets,
  medication_report: Pill,
  note: StickyNote,
  activity: Footprints,
};
const colors = {
  meal: "green",
  symptom: "rose",
  hydration: "blue",
  medication_report: "amber",
  note: "purple",
  activity: "blue",
};
export function JourneyPage({
  onNew,
  onAdd,
  onEdit,
}: {
  onNew: () => void;
  onAdd: (type: EventType, journeyId?: string) => void;
  onEdit: (event: JourneyEvent) => void;
}) {
  const {
    journeys,
    selectedJourney: activeJourney,
    selectJourney,
    events,
    call,
    refresh,
    notify,
    signedIn,
    setAuthOpen,
    busy,
    session,
    preview,
  } = useLinc();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<JourneyEvent | null>(null);
  const [deleteJourney, setDeleteJourney] = useState(false);
  const [working, setWorking] = useState(false);
  const journey =
    journeys.find((j) => j.id === selected) ||
    activeJourney ||
    journeys[0] ||
    null;
  const past = useQuery({
    networkMode: "always",
    queryKey: [
      preview ? "preview" : session?.user.id || "guest",
      "events",
      journey?.id,
    ],
    queryFn: () => call<JourneyEvent[]>(`events?journey_id=${journey!.id}`),
    enabled: signedIn && !!journey && journey.id !== activeJourney?.id,
    retry: false,
  });
  const pastEvents = past.data || [];
  const entries = (journey?.id === activeJourney?.id ? events : pastEvents)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.occurred_at || b.created_at).getTime() -
        new Date(a.occurred_at || a.created_at).getTime(),
    );
  const grouped = entries.reduce<Record<string, JourneyEvent[]>>(
    (groups, e) => {
      const day = format(
        new Date(e.occurred_at || e.created_at),
        "EEEE, MMMM d",
      );
      (groups[day] ||= []).push(e);
      return groups;
    },
    {},
  );
  async function removeEntry() {
    if (!remove) return;
    setWorking(true);
    try {
      await call(`events?id=${remove.id}`, "DELETE");
      notify("Entry removed.");
      setRemove(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function finish() {
    if (!journey) return;
    try {
      await call("journeys", "PATCH", {
        id: journey.id,
        status: journey.status === "active" ? "completed" : "active",
      });
      await refresh();
      notify(
        journey.status === "active"
          ? "Journey completed. Your memories stay here."
          : "Journey resumed.",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function deleteTrip() {
    if (!journey) return;
    setWorking(true);
    try {
      await call(`journeys?id=${journey.id}`, "DELETE");
      setSelected(null);
      setDeleteJourney(false);
      await refresh();
      notify("Journey and its records deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="page journey-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR STORY, ONE MOMENT AT A TIME</div>
          <h1>
            Your journeys<span className="greeting-dot">.</span>
          </h1>
          <p>Places you’ve been. Little things you don’t want to forget.</p>
        </div>
        <Button onClick={onNew}>
          <Plus size={18} />
          New journey
        </Button>
      </div>
      {(error || past.error) && (
        <ErrorBox
          message={error || past.error!.message}
          retry={() => {
            setError("");
            void refresh();
          }}
        />
      )}
      {!signedIn ? (
        <Empty
          icon={<Compass size={30} />}
          title="A journey worth remembering"
          action={
            <Button onClick={() => setAuthOpen(true)}>Sign in to begin</Button>
          }
        >
          Sign in to start a journey and keep your moments together.
        </Empty>
      ) : !journey ? (
        <Empty
          icon={<MountainIcon />}
          title="Your next chapter awaits"
          action={<Button onClick={onNew}>Start a journey</Button>}
        >
          Choose a destination. We’ll help you remember the rest.
        </Empty>
      ) : (
        <>
          <div className="journey-layout">
            <aside className="journey-sidebar">
              <h3>Your chapters</h3>
              {journeys.map((j) => (
                <button
                  className={`chapter-card ${journey.id === j.id ? "selected" : ""}`}
                  key={j.id}
                  onClick={() => {
                    setSelected(j.id);
                    selectJourney(j.id);
                    setError("");
                  }}
                >
                  <span
                    className={`status-dot ${j.status === "completed" ? "muted-dot" : ""}`}
                  />
                  {destinationVisual(j.destination_name).photo && (
                    <img
                      className="chapter-avatar"
                      src={destinationVisual(j.destination_name).photo!}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <strong>{j.title}</strong>
                  <small>{j.destination_name}</small>
                  <span>
                    {j.status === "active" ? "On the journey" : "Completed"}
                  </span>
                </button>
              ))}
            </aside>
            <section className="panel timeline-panel">
              <div className="journey-cover">
                <DestinationBackdrop destination={journey.destination_name} />
                <div className="journey-cover-copy">
                  <span>
                    {journey.status === "active"
                      ? "CURRENT JOURNEY"
                      : "SAVED JOURNEY"}
                  </span>
                  <strong>{journey.destination_name}</strong>
                  <small>
                    {format(new Date(journey.started_at), "MMM d, yyyy")}
                  </small>
                </div>
              </div>
              <OfflineJourneyPanel journey={journey} />
              <div className="timeline-header">
                <div>
                  <span className="eyebrow">
                    {journey.status === "active"
                      ? "ACTIVE JOURNEY"
                      : "SAVED CHAPTER"}
                  </span>
                  <h2>{journey.title}</h2>
                  <p>
                    <MapPin size={15} />
                    {journey.destination_name}
                    <span>·</span>
                    {format(new Date(journey.started_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => onAdd("note", journey.id)}
                >
                  <Plus size={17} />
                  Add a moment
                </Button>
              </div>
              {busy || past.isFetching ? (
                <p className="muted">Gathering your moments…</p>
              ) : entries.length ? (
                <div className="timeline">
                  {Object.entries(grouped).map(([day, list]) => (
                    <div key={day} className="timeline-day">
                      <h3>{day}</h3>
                      {list?.map((event) => {
                        const Icon = icons[event.event_type];
                        return (
                          <article className="timeline-event" key={event.id}>
                            <span
                              className={`event-icon ${colors[event.event_type]}`}
                            >
                              <Icon size={19} />
                            </span>
                            <div className="event-content">
                              <div className="event-meta">
                                <span>
                                  {event.event_type
                                    .replace("_report", "")
                                    .replace("_", " ")}
                                </span>
                                <time>
                                  {event.time_text ||
                                    format(
                                      new Date(
                                        event.occurred_at || event.created_at,
                                      ),
                                      "h:mm a",
                                    )}
                                  {!event.occurred_at && !event.time_text
                                    ? " · logged"
                                    : ""}
                                </time>
                              </div>
                              <h4>{event.title}</h4>
                              {event.description && <p>{event.description}</p>}
                              <small className="muted">
                                User-reported
                                {entryIsPending(event)
                                  ? " · Saved on device, waiting to sync"
                                  : ""}
                                {event.location_name
                                  ? ` · ${event.location_name}`
                                  : ""}
                              </small>
                            </div>
                            <div className="event-tools">
                              <button
                                className="icon-button"
                                aria-label={`Edit ${event.title}`}
                                disabled={entryIsPending(event)}
                                onClick={() => onEdit(event)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Delete ${event.title}`}
                                disabled={entryIsPending(event)}
                                onClick={() => setRemove(event)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<StickyNote size={27} />}
                  title="Every story starts somewhere"
                  action={
                    <Button onClick={() => onAdd("meal", journey.id)}>
                      Log your first meal
                    </Button>
                  }
                >
                  Tell your companion about a meal, a walk, or a moment. Saved
                  entries appear here.
                </Empty>
              )}
              <div className="timeline-footer">
                <Button variant="ghost" onClick={finish}>
                  {journey.status === "active" ? (
                    <Check size={17} />
                  ) : (
                    <ArrowLeft size={17} />
                  )}{" "}
                  {journey.status === "active"
                    ? "Complete journey"
                    : "Resume journey"}
                </Button>
                <Button variant="ghost" onClick={() => setDeleteJourney(true)}>
                  <Trash2 size={16} />
                  Delete journey
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
      <Modal
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Remove this moment?"
        description="This removes the saved entry. Your conversation may still mention it; you can delete that conversation separately."
      >
        <Button variant="danger" loading={working} onClick={removeEntry}>
          Remove entry
        </Button>
      </Modal>
      <Modal
        open={deleteJourney}
        onOpenChange={setDeleteJourney}
        title="Delete this journey?"
        description="Its events and associated conversations will also be permanently deleted."
      >
        <Button variant="danger" loading={working} onClick={deleteTrip}>
          Delete journey and records
        </Button>
      </Modal>
    </div>
  );
}
function MountainIcon() {
  return <Compass size={30} />;
}
