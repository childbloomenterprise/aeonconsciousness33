import { JourneyToday } from "../components/JourneyToday";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  ArrowUp,
  ArrowUpRight,
  Camera,
  ChevronDown,
  Compass,
  Droplets,
  Footprints,
  HeartPulse,
  Leaf,
  MapPin,
  Mic,
  Plus,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import type { EventType, JourneyEvent } from "../../shared/contracts";
import { useLinc } from "../state";
import { Button, ErrorBox, Modal } from "../components/ui";
import { TravelScenery } from "../components/TravelScenery";
import { DatePicker } from "../components/DatePicker";
import { destinationVisual } from "../lib/destinationVisual";
import { OfflineJourneyPanel } from "../components/OfflineJourneyPanel";
import { entryIsPending } from "../lib/offline";
const PolaroidLineCarousel = lazy(
  () => import("../components/ui/polaroid-line-carousel"),
);
const ActivityHeatmap = lazy(() => import("../components/ui/activity-heatmap"));
const icons = {
  meal: Utensils,
  hydration: Droplets,
  activity: Footprints,
  symptom: HeartPulse,
  medication_report: HeartPulse,
  note: Compass,
};
export function Home({
  onNew,
  onVoice,
  onVoiceMeal,
  onMeal,
  onFood,
  onPhoto,
  onCapture,
  onEdit,
}: {
  onNew: () => void;
  onVoice: () => void;
  onVoiceMeal: () => void;
  onMeal: () => void;
  onFood: () => void;
  onPhoto?: () => void;
  onCapture?: (text: string, type?: EventType) => void;
  onEdit?: (entry: JourneyEvent) => void;
}) {
  const {
    journeys,
    selectedJourney,
    activeJourney,
    selectJourney,
    events,
    profile,
    signedIn,
    setAuthOpen,
    dataError,
    refresh,
    busy,
    session,
  } = useLinc();
  const journey = selectedJourney || activeJourney;
  const navigate = useNavigate();
  const [text, setText] = useState(""),
    [kind, setKind] = useState("all"),
    [day, setDay] = useState<string | null>(null),
    [chooser, setChooser] = useState(false),
    [slide, setSlide] = useState(0),
    [rhythm, setRhythm] = useState(false);
  const name = profile.display_name?.split(" ")[0] || "traveller";
  const visual = destinationVisual(journey?.destination_name || "Alleppey");
  const records = useMemo(
    () =>
      events
        .filter((e) => e.journey_id === journey?.id)
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.occurred_at || b.created_at) -
            Date.parse(a.occurred_at || a.created_at),
        ),
    [events, journey?.id],
  );
  const visible = useMemo(
    () =>
      records.filter(
        (e) =>
          (kind === "all" || e.event_type === kind) &&
          (!day ||
            format(new Date(e.occurred_at || e.created_at), "yyyy-MM-dd") ===
              day),
      ),
    [records, kind, day],
  );
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of records) {
      const date = format(
        new Date(event.occurred_at || event.created_at),
        "yyyy-MM-dd",
      );
      counts.set(date, (counts.get(date) || 0) + 1);
    }
    return Array.from({ length: 84 }, (_, index) => {
      const date = format(subDays(new Date(), 83 - index), "yyyy-MM-dd");
      return { date, count: counts.get(date) || 0 };
    });
  }, [records]);
  function ask(value: string) {
    if (!value.trim()) return;
    navigate("/chat" + (journey ? "?journey=" + journey.id : ""), {
      state: { draft: value },
    });
  }
  const today = format(new Date(), "yyyy-MM-dd");
  const todayRecords = records.filter(
    (e) =>
      format(new Date(e.occurred_at || e.created_at), "yyyy-MM-dd") === today,
  );
  const kerala =
    !!journey &&
    /kerala|munnar|kochi|wayanad|allepp|varkala|thekkady/i.test(
      journey.destination_name,
    );
  const diet =
    profile.signup?.dietary_preference?.replaceAll("_", " ") ||
    "your preferences";
  return (
    <div className="page feed-page">
      <TravelScenery />
      <header className="feed-greeting">
        <Link to="/" className="feed-wordmark">
          <span className="brand-flower" aria-hidden="true">
            ✳
          </span>
          linc<span>33</span>
        </Link>
        <button
          className="journey-pill"
          onClick={() => (journeys.length ? setChooser(true) : onNew())}
        >
          {visual.photo ? (
            <img
              className="trip-avatar"
              src={visual.photo}
              alt=""
              decoding="async"
              width={48}
              height={48}
            />
          ) : (
            <span className="journey-dot" />
          )}
          {journey?.destination_name || "Choose your journey"}
          <ChevronDown size={15} />
        </button>
      </header>
      <section
        className={journey ? "feed-intro feed-intro--returning" : "feed-intro"}
      >
        <div className="feed-intro-copy">
          <span className="feed-kicker">
            A LITTLE CONTEXT. A BETTER JOURNEY.
          </span>
          <h1>
            {journey ? (
              journey.destination_name
            ) : (
              <>
                Your journey.
                <br />
                <span>A little more connected.</span>
              </>
            )}
          </h1>
          <p>
            {journey
              ? format(new Date(), "EEEE, d MMMM") +
                " · Add a meal, water, activity or how you feel."
              : "Remember your food, feelings and travel moments, with useful guidance along the way."}
          </p>
          {!journey && (
            <Button onClick={onNew}>
              Choose your destination <ArrowUpRight size={17} />
            </Button>
          )}
        </div>
        <div
          className="journey-landscape"
          style={{
            backgroundImage: visual.photo
              ? "url(" + visual.photo + ")"
              : visual.gradient,
          }}
          aria-label={visual.photo ? visual.alt : "Abstract journey landscape"}
          role="img"
        >
          <span className="landscape-label">
            <MapPin size={13} />
            {journey?.destination_name || "Somewhere new"}
          </span>
          <span className="landscape-note">
            {journey
              ? format(new Date(journey.started_at), "MMM d") +
                " · " +
                journey.status
              : "Your next chapter"}
          </span>
        </div>
      </section>
      {journey ? (
        <JourneyToday
          key={(session?.user.id || "guest") + ":" + journey.id}
          journey={journey}
          events={records}
          scope={session?.user.id || "guest"}
          onFood={onFood}
          onMeal={onMeal}
          onCapture={() => onCapture?.("", "note")}
          onJourney={() => navigate("/journey")}
        />
      ) : (
        <div className="destination-preview-value">
          <p>
            Discover local food ideas before you set off. Choose a destination
            inside the explorer.
          </p>
          <button className="subtle-link" onClick={onFood}>
            Explore local flavours <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      <OfflineJourneyPanel journey={journey} />
      {journey && (
        <section className="feed-capture" aria-label="Capture a journey entry">
          <div className="capture-heading">
            <h2>What happened today?</h2>
            <span>
              Review, then save to {journey.destination_name.split(",")[0]}
            </span>
          </div>
          <form
            className="feed-composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (!journey) {
                onNew();
                return;
              }
              onCapture?.(text, "note");
              setText("");
            }}
          >
            <div className="composer-star">
              <Sparkles size={21} />
            </div>
            <input
              aria-label="Write a journey entry"
              placeholder={
                journey
                  ? "Ate something? Went somewhere? Tell me…"
                  : "Where will your story take you?"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
            />
            <button type="button" aria-label="Add a photo" onClick={onPhoto}>
              <Camera size={20} />
            </button>
            <button
              type="button"
              aria-label="Record a voice entry"
              onClick={onVoice}
            >
              <Mic size={20} />
            </button>
            <button
              className="composer-send"
              type="submit"
              disabled={!text.trim()}
              aria-label="Review message"
              title="Review entry before saving"
            >
              <ArrowUp size={20} />
            </button>
          </form>
          <div className="capture-kinds">
            {(
              [
                ["meal", "Food", Utensils],
                ["hydration", "Water", Droplets],
                ["activity", "Activity", Footprints],
                ["symptom", "How I feel", HeartPulse],
              ] as const
            ).map(([type, label, Icon]) => (
              <button
                key={type}
                aria-label={"Add " + label.toLowerCase() + " entry"}
                onClick={() => onCapture?.(text, type)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
      {journey && (
        <nav className="feed-mode" aria-label="Journey views">
          <Link to="/" className="is-current">
            <span />
            My feed
          </Link>
          <Link to={"/chat" + (journey ? "?journey=" + journey.id : "")}>
            <Sparkles size={16} />
            {journey
              ? journey.destination_name.split(",")[0] + " companion"
              : "My companion"}
            <ArrowUpRight size={14} />
          </Link>
          <button onClick={() => setRhythm((v) => !v)} aria-expanded={rhythm}>
            My rhythm
          </button>
        </nav>
      )}
      {dataError && (
        <ErrorBox message={dataError.message} retry={() => void refresh()} />
      )}
      {journey && (
        <div className="feed-columns">
          <section className="journey-stream" aria-label="Journey feed">
            <div className="stream-heading">
              <div>
                <span className="feed-kicker">THE EVERYDAY, REMEMBERED</span>
                <h2>
                  {day
                    ? format(new Date(day + "T12:00:00"), "EEEE, MMM d")
                    : "Recent moments"}
                </h2>
              </div>
              <button
                className="subtle-link"
                onClick={() => setRhythm((v) => !v)}
                aria-expanded={rhythm}
              >
                My rhythm
              </button>
              <DatePicker
                value={day || ""}
                onChange={setDay}
                placeholder="Any day"
              />
              {day && (
                <button
                  className="icon-button"
                  aria-label="Clear date filter"
                  onClick={() => setDay(null)}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="feed-filters" aria-label="Filter feed">
              {[
                ["all", "Everything"],
                ["meal", "Food"],
                ["hydration", "Water"],
                ["activity", "Movement"],
                ["symptom", "How I feel"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={kind === value}
                  className={kind === value ? "selected" : ""}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {busy && !records.length ? (
              <p role="status" className="feed-empty">
                Gathering your moments…
              </p>
            ) : visible.length ? (
              <div className="feed-timeline">
                {visible.map((entry, index) => {
                  const Icon = icons[entry.event_type];
                  const date = format(
                    new Date(entry.occurred_at || entry.created_at),
                    "MMM d",
                  );
                  return (
                    <article
                      key={entry.id}
                      className={"feed-event feed-event-" + entry.event_type}
                      style={{ animationDelay: index * 35 + "ms" }}
                    >
                      <div className="feed-event-symbol">
                        <Icon size={19} />
                      </div>
                      <div className="feed-event-body">
                        <div className="feed-event-meta">
                          <span>
                            {entry.event_type === "meal"
                              ? "A moment to savour"
                              : entry.event_type.replaceAll("_", " ")}
                          </span>
                          <time
                            dateTime={entry.occurred_at || entry.created_at}
                          >
                            {date} ·{" "}
                            {entry.occurred_at
                              ? format(new Date(entry.occurred_at), "h:mm a")
                              : "Time not reported"}
                          </time>
                        </div>
                        <h3>{entry.title}</h3>
                        <button
                          className="subtle-link entry-edit"
                          onClick={() => onEdit?.(entry)}
                          aria-label={"Correct " + entry.title}
                          disabled={entryIsPending(entry)}
                        >
                          Correct entry
                        </button>
                        {entry.description && <p>{entry.description}</p>}
                        <span className="feed-saved">
                          {entryIsPending(entry)
                            ? "Saved on device · Waiting to sync to "
                            : "Saved to "}
                          {journey?.destination_name.split(",")[0] ||
                            "your journey"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="feed-empty">
                <span className="empty-orbit">
                  <Leaf size={27} />
                </span>
                <h3>
                  {journey
                    ? "Every journey starts with a little moment."
                    : "A place for your journey."}
                </h3>
                <p>
                  {journey
                    ? "A breakfast. A long walk. A glass of water. Add your first moment by photo, voice, or a few words."
                    : "Choose a destination to keep its feed and companion together."}
                </p>
                <button
                  className="subtle-link"
                  onClick={journey ? onMeal : onNew}
                >
                  {journey ? "Add a first meal" : "Create a journey"}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            <div className="feed-quick-add">
              <button onClick={onMeal}>
                <Utensils size={17} />
                Add a meal
              </button>
              <button onClick={onVoiceMeal}>
                <Mic size={17} />
                Speak a moment
              </button>
              <button onClick={onPhoto}>
                <Camera size={17} />
                Add a photo
              </button>
            </div>
            {rhythm && (
              <div className="rhythm-section">
                <div>
                  <span className="feed-kicker">YOUR OWN PACE</span>
                  <h3>Little moments add up.</h3>
                  <p>Recorded entries, not a health score.</p>
                </div>
                <Suspense fallback={<p>Loading your rhythm…</p>}>
                  <ActivityHeatmap
                    days={days}
                    label="Journey feed entries over the last twelve weeks"
                    period="the last twelve weeks"
                    unit={{ one: "moment", other: "moments" }}
                    selectedDate={day}
                    onSelectDate={setDay}
                  />
                </Suspense>
              </div>
            )}
          </section>
          <aside className="feed-companion">
            <div className="companion-spark">
              <Sparkles size={25} />
            </div>
            <span className="feed-kicker">
              JUST THIS JOURNEY. JUST FOR YOU.
            </span>
            <h2>
              A companion with
              <br />a little more context.
            </h2>
            <p>
              {journey
                ? "Your " +
                  journey.destination_name.split(",")[0] +
                  " conversations stay with this journey. Meals and moments give each reply its context."
                : "Choose a journey to begin its own conversation, with a separate history and feed."}
            </p>
            <button
              onClick={() =>
                ask(
                  journey
                    ? "Help me plan food for my " +
                        journey.destination_name +
                        " journey."
                    : "Help me start a journey.",
                )
              }
              className="companion-cta"
            >
              Let’s talk
              <ArrowUpRight size={18} />
            </button>
            <div className="companion-facts">
              <span>
                <Utensils size={16} />
                {
                  todayRecords.filter((e) => e.event_type === "meal").length
                }{" "}
                meals recorded today
              </span>
              <span>
                <Droplets size={16} />
                {
                  todayRecords.filter((e) => e.event_type === "hydration")
                    .length
                }{" "}
                water entries today
              </span>
              <span>
                <Leaf size={16} />
                {diet}
              </span>
            </div>
            <div className="food-whisper">
              <span className="feed-kicker">A LITTLE FOOD INSPIRATION</span>
              <p>
                {kerala
                  ? "Explore Kerala favourites, then check ingredients with the person preparing your food."
                  : "Ask your companion for food ideas that fit your destination and preferences."}
              </p>
              <button
                className="subtle-link"
                onClick={() =>
                  kerala
                    ? onFood()
                    : ask(
                        "Suggest food ideas for " +
                          (journey?.destination_name || "my next journey") +
                          " that fit my dietary preferences.",
                      )
                }
              >
                {kerala ? "Explore local flavours" : "Find food ideas"}
                <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
        </div>
      )}
      <p className="feed-footnote">Your pace. Your choices. Your journey.</p>
      <Modal
        open={chooser}
        onOpenChange={setChooser}
        title="Every journey, its own story."
        description="Choose a journey to open its feed and dedicated companion."
      >
        <div className="journey-carousel-shell">
          <Suspense fallback={<p role="status">Loading journeys…</p>}>
            <PolaroidLineCarousel
              height={340}
              cardWidth={230}
              autoplay={0}
              swing={0}
              background="transparent"
              ink="#29332b"
              ariaLabel="Your journeys. Drag, tap, or use arrow keys to browse."
              slides={journeys.map((j, i) => ({
                image: destinationVisual(j.destination_name).photo || undefined,
                palette: i % 2 ? "dawn" : "mist",
                seed: i + 2,
                title: j.destination_name,
                caption: j.title,
                alt: destinationVisual(j.destination_name).alt,
              }))}
              onChange={setSlide}
            />
          </Suspense>
          <p className="journey-carousel-hint">
            Drag the photographs, tap one, or use your arrow keys.
          </p>
        </div>
        <div className="journey-carousel-actions">
          <button
            type="button"
            className="subtle-link"
            onClick={() => {
              setChooser(false);
              onNew();
            }}
          >
            <Plus size={15} /> New journey
          </button>
          <Button
            onClick={() => {
              const j = journeys[slide];
              if (j) {
                selectJourney(j.id);
                setDay(null);
                setChooser(false);
                navigate("/?journey=" + j.id);
              }
            }}
          >
            Open {journeys[slide]?.destination_name || "journey"}
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </Modal>
    </div>
  );
}
