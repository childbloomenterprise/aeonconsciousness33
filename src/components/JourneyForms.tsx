import { mealsForDestination } from "../../shared/destinationCuisine";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Compass,
  MapPin,
  Plus,
  Check,
  Zap,
  Search,
  ChevronDown,
  Utensils,
  HeartPulse,
  Footprints,
  Pill,
  Droplets,
  StickyNote,
} from "lucide-react";
import type { Journey, JourneyEvent, EventType } from "../../shared/contracts";
import { eventDraft, journeyInput } from "../../shared/contracts";
import { mealPeriods, mealPeriodForHour } from "../../shared/cuisine";
import { useLinc } from "../state";
import { entryIsPending } from "../lib/offline";
import { Button, Modal, ErrorBox } from "./ui";
import {
  destinationChoices,
  destinationVisual,
} from "../lib/destinationVisual";
import { DatePicker, JourneyDateRangePicker } from "./DatePicker";
import VerticalTitledStepper from "./ui/c-stepper-15";

function today() {
  return format(new Date(), "yyyy-MM-dd");
}

export { JourneyForm } from "./QuickJourneyForm";

function MealPicker({
  destination,
  dietFilter,
  busyLabel,
  onPick,
}: {
  destination?: string;
  dietFilter?: string | null;
  busyLabel: string | null;
  onPick: (label: string) => void;
}) {
  const [search, setSearch] = useState("");
  const vegOnly = dietFilter === "vegetarian" || dietFilter === "vegan";
  const currentPeriod = mealPeriodForHour(new Date().getHours());
  const filtered = mealsForDestination(destination)
    .filter((s) => !vegOnly || s.diet === "vegetarian")
    .filter((s) => s.label.toLowerCase().includes(search.trim().toLowerCase()));
  const orderedPeriods = [
    currentPeriod,
    ...mealPeriods.filter((p) => p !== currentPeriod),
  ];
  return (
    <div className="meal-picker">
      <div className="input-icon meal-picker-search">
        <Search size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search idli, dosa, biryani…"
          maxLength={60}
        />
      </div>
      {orderedPeriods.map((period) => {
        const options = filtered.filter((s) => s.period === period);
        if (!options.length) return null;
        return (
          <div className="meal-suggestion-group" key={period}>
            <small>
              {period}
              {period === currentPeriod ? " · right now" : ""}
            </small>
            <div className="chip-row">
              {options.map((s) => (
                <button
                  type="button"
                  className="chip"
                  key={s.id}
                  disabled={!!busyLabel}
                  onClick={() => onPick(s.label)}
                >
                  {busyLabel === s.label ? "Saving…" : s.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!filtered.length && (
        <p className="muted small">
          No dish matches “{search}”. Try another name, or describe it below.
        </p>
      )}
    </div>
  );
}

export function EventForm({
  open,
  onClose,
  event,
  initialType = "note",
  journeyId,
}: {
  open: boolean;
  onClose: () => void;
  event: JourneyEvent | null;
  initialType?: EventType;
  journeyId?: string;
}) {
  const {
    selectedJourney: activeJourney,
    call,
    refresh,
    notify,
    profile,
  } = useLinc();
  const requestId = useRef(crypto.randomUUID());

  const [type, setType] = useState<EventType>(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState(today());
  const [clock, setClock] = useState("");
  const [amount, setAmount] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dietPreference = profile.signup?.dietary_preference;
  useEffect(() => {
    if (open) {
      requestId.current = crypto.randomUUID();
      setType(event?.event_type || initialType);
      setTitle(event?.title || "");
      setDescription(event?.description || "");
      setTime(event?.time_text || "");
      if (event?.occurred_at) {
        const local = new Date(event.occurred_at);
        setDate(format(local, "yyyy-MM-dd"));
        setClock(format(local, "HH:mm"));
      } else {
        setDate(today());
        setClock("");
      }
      setAmount(String(event?.metadata_json.amount_ml || ""));
      setMoreOpen(false);
      setError("");
    }
  }, [open, event, initialType]);
  function occurredAt() {
    const t = clock || format(new Date(), "HH:mm");
    return new Date(`${date}T${t}:00`).toISOString();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = journeyId || event?.journey_id || activeJourney?.id;
      if (!id) throw new Error("Start a journey before saving an entry.");
      if (!profile.consents.sensitive_storage)
        throw new Error(
          "Enable private storage in Profile before saving entries.",
        );
      const draft = eventDraft.parse({
        event_type: type,
        title,
        description: description || null,
        occurred_at: occurredAt(),
        time_text: time || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location_name: event?.location_name || null,
        metadata_json:
          type === "hydration" && amount ? { amount_ml: Number(amount) } : {},
      });
      if (event && entryIsPending(event))
        throw new Error("Sync this entry before making another correction.");
      const saved = await call<JourneyEvent>(
        "events",
        event ? "PATCH" : "POST",
        {
          ...(event ? { id: event.id } : { request_id: requestId.current }),
          ...(event?.updated_at
            ? { expected_updated_at: event.updated_at }
            : {}),
          journey_id: id,
          event: draft,
        },
      );
      requestId.current = crypto.randomUUID();
      await refresh();
      notify(
        entryIsPending(saved)
          ? "Saved on this device. It will sync after reconnecting while LINC33 is open."
          : event
            ? "Entry updated."
            : "Added to your journey.",
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const isMeal = type === "meal";
  const typeIcons: Record<EventType, typeof Utensils> = {
    meal: Utensils,
    symptom: HeartPulse,
    activity: Footprints,
    medication_report: Pill,
    hydration: Droplets,
    note: StickyNote,
  };
  const typeLabels: Record<EventType, string> = useMemo(
    () => ({
      meal: "Meal",
      symptom: "Symptom",
      activity: "Activity",
      medication_report: "Medication report",
      hydration: "Hydration",
      note: "Note",
    }),
    [],
  );
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={event ? "A little correction" : "Add a little moment"}
      description="Save what happened — pick a dish, pick a date, done."
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="entry-type-row">
          {(Object.keys(typeLabels) as EventType[]).map((t) => {
            const Icon = typeIcons[t];
            return (
              <button
                type="button"
                key={t}
                className={`chip ${type === t ? "chip-active" : ""}`}
                onClick={() => setType(t)}
              >
                <Icon size={14} />
                {typeLabels[t]}
              </button>
            );
          })}
        </div>
        {!event && isMeal && (
          <>
            <span className="muted small">
              <Zap size={13} />
              Choose a dish, review the details, then save
            </span>
            <MealPicker
              key={activeJourney?.destination_name}
              destination={activeJourney?.destination_name}
              dietFilter={dietPreference}
              busyLabel={null}
              onPick={(label) => setTitle(label)}
            />
            <span className="muted small">Not listed? Describe it below.</span>
          </>
        )}
        <label>
          {isMeal ? "Or describe the dish" : "What happened?"}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            placeholder={
              isMeal ? "Appam for breakfast" : "A moment worth remembering"
            }
          />
        </label>
        <label>
          When
          <DatePicker value={date} onChange={setDate} />
        </label>
        <button
          type="button"
          className="more-details-toggle"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          <ChevronDown
            size={16}
            style={{
              transform: moreOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }}
          />
          More details <span className="muted small">(optional)</span>
        </button>
        {moreOpen && (
          <div className="more-details">
            <label>
              Details <span className="muted">(optional)</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
            </label>
            <div className="form-grid">
              <label>
                Exact time <span className="muted">(optional)</span>
                <input
                  type="time"
                  value={clock}
                  onChange={(e) => setClock(e.target.value)}
                />
              </label>
              <label>
                Or approximate time
                <input
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="Around lunchtime"
                  maxLength={160}
                />
              </label>
            </div>
            {type === "hydration" && (
              <label>
                Amount in ml <span className="muted">(optional)</span>
                <input
                  type="number"
                  min="1"
                  max="20000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        {error && <ErrorBox message={error} />}
        <Button loading={busy} type="submit">
          {event ? <Check size={18} /> : <Plus size={18} />}Save entry
        </Button>
      </form>
    </Modal>
  );
}
