import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Camera, Mic } from "lucide-react";
import {
  eventDraft,
  type EventType,
  type JourneyEvent,
} from "../../shared/contracts";
import { useLinc } from "../state";
import { Button, ErrorBox, Modal } from "./ui";
import { entryIsPending } from "../lib/offline";

export function EntryCapture({
  open,
  onClose,
  initialText = "",
  initialType = "note",
  entry,
  onPhoto,
  onVoice,
}: {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  initialType?: EventType;
  entry?: JourneyEvent | null;
  onPhoto: () => void;
  onVoice: () => void;
}) {
  const {
    selectedJourney,
    session,
    preview,
    profile,
    call,
    refresh,
    notify,
    signedIn,
    setAuthOpen,
  } = useLinc();
  const journeyId = entry?.journey_id || selectedJourney?.id;
  const scope = `${preview ? "preview" : session?.user.id || "guest"}:${journeyId || "none"}`;
  const key = `linc-entry-draft:${scope}`;
  const [text, setText] = useState("");
  const [type, setType] = useState<EventType>(initialType);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allowStorage, setAllowStorage] = useState(false);
  const requestId = useRef<string>(crypto.randomUUID());
  const lock = useRef(false);
  const hydrated = useRef(false);
  const canPersist = signedIn && profile.consents.sensitive_storage && !preview;
  useEffect(() => {
    if (!open) {
      hydrated.current = false;
      return;
    }
    if (hydrated.current) return;
    hydrated.current = true;
    let saved: {
      text?: string;
      type?: EventType;
      when?: string;
      requestId?: string;
    } = {};
    try {
      if (canPersist && !entry)
        saved = JSON.parse(sessionStorage.getItem(key) || "{}");
    } catch {
      /* storage can be disabled */
    }
    const now = new Date(entry?.occurred_at || Date.now());
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setText(
      entry
        ? [entry.title, entry.description].filter(Boolean).join("\n")
        : initialText || saved.text || "",
    );
    setType(
      entry?.event_type ||
        (initialText ? initialType : saved.type || initialType),
    );
    setWhen(entry ? local : saved.when || local);
    requestId.current = saved.requestId || crypto.randomUUID();
    setError("");
  }, [open, key, canPersist, entry, initialText, initialType]);
  useEffect(() => {
    if (!open || !hydrated.current || entry || !canPersist) return;
    try {
      if (text.trim())
        sessionStorage.setItem(
          key,
          JSON.stringify({ text, type, when, requestId: requestId.current }),
        );
      else sessionStorage.removeItem(key);
    } catch {
      /* the in-memory draft is still usable */
    }
  }, [text, type, when, open, key, canPersist, entry]);
  async function save() {
    if (lock.current) return;
    if (!signedIn) {
      setAuthOpen(true);
      return;
    }
    if (!journeyId) {
      setError("Choose a journey before saving this entry.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!profile.consents.sensitive_storage && !allowStorage)
        throw new Error(
          "Enable private storage in Profile to save entries. Your draft stays open.",
        );
      if (!profile.consents.sensitive_storage && allowStorage)
        await call("privacy", "POST", {
          consent_type: "sensitive_storage",
          granted: true,
        });
      const [title, ...details] = text.trim().split("\n");
      const event = eventDraft.parse({
        event_type: type,
        title: title.slice(0, 160),
        description:
          [title.slice(160), ...details].filter(Boolean).join("\n") || null,
        occurred_at: new Date(when).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        metadata_json: entry?.metadata_json || {},
      });
      if (entry && entryIsPending(entry))
        throw new Error("Sync this entry before making another correction.");
      const saved = await call<JourneyEvent>(
        "events",
        entry ? "PATCH" : "POST",
        {
          ...(entry ? { id: entry.id } : { request_id: requestId.current }),
          ...(entry?.updated_at
            ? { expected_updated_at: entry.updated_at }
            : {}),
          journey_id: journeyId,
          event,
        },
      );
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* optional storage */
      }
      setText("");
      requestId.current = crypto.randomUUID();
      notify(
        entryIsPending(saved)
          ? "Saved on this device. It will sync when you reconnect and LINC33 is open."
          : entry
            ? "Entry updated."
            : `Saved to ${selectedJourney?.destination_name || "your journey"}.`,
      );
      onClose();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={entry ? "Correct this entry" : "Review your moment"}
      description={`Saving to ${selectedJourney?.destination_name || "your selected journey"}. Check the details before saving.`}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Entry type
          <select
            value={type}
            disabled={busy}
            onChange={(e) => setType(e.target.value as EventType)}
          >
            <option value="note">Travel moment</option>
            <option value="meal">Food</option>
            <option value="hydration">Water</option>
            <option value="activity">Activity</option>
            <option value="symptom">How I feel</option>
            <option value="medication_report">Medication report</option>
          </select>
        </label>
        <label>
          What happened?
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            required
            maxLength={2000}
            disabled={busy}
            placeholder="Lunch, a glass of water, a walk, or how you're feeling…"
          />
        </label>
        <label>
          When
          <input
            type="datetime-local"
            required
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={busy}
          />
        </label>
        {!entry && (
          <div className="capture-alternatives">
            <Button
              type="button"
              variant="ghost"
              onClick={onPhoto}
              disabled={busy}
            >
              <Camera size={17} />
              Use a photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onVoice}
              disabled={busy}
            >
              <Mic size={17} />
              Use voice
            </Button>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        {!profile.consents.sensitive_storage && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={allowStorage}
              disabled={busy}
              onChange={(e) => setAllowStorage(e.target.checked)}
            />
            <span>
              Allow private journey storage to save this and future entries to
              my account. I can change this in Profile. External AI stays a
              separate choice.
            </span>
          </label>
        )}
        {!profile.consents.sensitive_storage && (
          <p className="small">
            <Link to="/profile" onClick={onClose}>
              Open privacy settings
            </Link>{" "}
            to enable saving. AI processing is a separate choice.
          </p>
        )}
        <Button type="submit" disabled={!text.trim() || !when} loading={busy}>
          <Check size={18} />
          {busy ? "Saving entry…" : "Save entry"}
        </Button>
        <p className="muted small" role="status">
          Not saved until you confirm.{" "}
          {canPersist
            ? "An unfinished draft stays in this browser tab until saved or signed out."
            : "Keep this window open to retain your draft."}
        </p>
      </form>
    </Modal>
  );
}
