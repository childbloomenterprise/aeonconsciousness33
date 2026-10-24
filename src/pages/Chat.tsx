import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  Camera,
  Bot,
  Plus,
  History,
  Trash2,
  Check,
  Compass,
  ExternalLink,
  ShieldAlert,
  LoaderCircle,
  CornerUpLeft,
} from "lucide-react";
import type {
  ChatResult,
  Message,
  Conversation,
  EventDraft,
} from "../../shared/contracts";
import { screenSafety, isHealthText, isCareSearch } from "../../shared/safety";
import { sources } from "../../shared/knowledge";
import { sourceReply } from "../lib/sourceReply";
import {
  listLocalConversations,
  getLocalConversation,
  deleteLocalConversation,
} from "../lib/localChat";
import { useLinc } from "../state";
import { Button, ErrorBox, Modal } from "../components/ui";
import { CareFinder } from "../components/CareFinder";
import { AssistantReply } from "../components/AssistantReply";

function StreamedMessage({ content }: { content: string }) {
  const [visible, setVisible] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setVisible(content);
      setComplete(true);
      return;
    }
    let cancelled = false;
    setVisible("");
    setComplete(false);
    let index = 0;
    const step = () => {
      if (cancelled) return;
      index = Math.min(
        content.length,
        index + Math.max(2, Math.ceil(content.length / 90)),
      );
      setVisible(content.slice(0, index));
      if (index >= content.length) {
        setComplete(true);
        return;
      }
      window.setTimeout(step, 12);
    };
    step();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <>
      {visible}
      {!complete && <span className="live-cursor" aria-hidden="true" />}
    </>
  );
}

export function Chat({
  onVoice,
  onSOS,
  onNew,
  onPhoto,
}: {
  onVoice: () => void;
  onSOS: () => void;
  onNew: () => void;
  onPhoto?: () => void;
}) {
  const {
    call,
    activeJourney: currentJourney,
    selectedJourney,
    refresh,
    signedIn,
    setAuthOpen,
    preview,
    session,
  } = useLinc();
  const activeJourney = selectedJourney || currentJourney;
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [conversationId, setConversation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<{
    text: string;
    request_id: string;
  } | null>(null);
  const [history, setHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [review, setReview] = useState<{
    event: EventDraft;
    key: string;
  } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [urgentQuery, setUrgentQuery] = useState<string | null>(null);
  const [careEpoch, setCareEpoch] = useState(0);
  const [urgent, setUrgent] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const consumed = useRef<string | null>(null);
  const [conversationJourney, setConversationJourney] = useState<string | null>(
    null,
  );
  const pendingRequests = useRef(new Map<string, string>());
  const identity = preview ? "preview" : session?.user.id || "guest";
  const identityRef = useRef(identity);
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (
      !signedIn ||
      !activeJourney?.id ||
      (location.state as { send?: string } | null)?.send
    )
      return;
    let cancelled = false;
    setBusy(true);
    void call<Conversation[]>(`conversations?journey_id=${activeJourney.id}`)
      .then(async (list) => {
        const latest = list[0];
        if (!latest || cancelled) return;
        const history = await call<Message[]>(`conversations?id=${latest.id}`);
        if (cancelled) return;
        setMessages(history);
        setConversation(latest.id);
        setConversationJourney(activeJourney.id);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeJourney?.id, signedIn, call]);
  identityRef.current = identity;
  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    setMessages([]);
    setConversation(null);
    setConversationJourney(null);
    setRetry(null);
    pendingRequests.current.clear();
    setUrgent(null);
    setUrgentQuery(null);
    setCareEpoch((n) => n + 1);
  }, [identity]);
  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }, [messages, busy]);
  async function send(value: string, requestId: string = crypto.randomUUID()) {
    if (!value.trim()) return;
    const safety = screenSafety(value);
    if (safety.urgency !== "none") {
      setUrgent(safety.message);
      setUrgentQuery(value);
    }
    if (busy) return;
    setUrgent(safety.message);
    setUrgentQuery(safety.urgency !== "none" ? value : null);
    if (
      !signedIn &&
      !isHealthText(value) &&
      !isCareSearch(value) &&
      safety.urgency === "none"
    ) {
      setAuthOpen(true);
      return;
    }
    setText("");
    setError("");
    setRetry(null);
    setBusy(true);
    const guestConversationId =
      !signedIn && !conversationId ? crypto.randomUUID() : conversationId;
    if (!signedIn && guestConversationId !== conversationId)
      setConversation(guestConversationId);
    setMessages((previous) =>
      previous.some((m) => m.id === requestId)
        ? previous
        : [
            ...previous,
            {
              id: requestId,
              role: "user",
              content: value,
              created_at: new Date().toISOString(),
            },
          ],
    );
    const sender = identity;
    try {
      const journeyId = conversationId
        ? conversationJourney
        : activeJourney?.id || null;
      const result = signedIn
        ? await call<ChatResult>("chat", "POST", {
            text: value,
            request_id: requestId,
            conversation_id: conversationId,
            journey_id: journeyId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        : {
            ...sourceReply(value),
            persistence_error:
              "This guest conversation stays in memory until you leave or refresh. Sign in and enable private storage to save conversations.",
          };
      if (identityRef.current !== sender) return;
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.reply,
          result,
          created_at: new Date().toISOString(),
        },
      ]);
      if (result.conversation_id) {
        setConversation(result.conversation_id);
        setConversationJourney(journeyId);
      }
      if (signedIn) await refresh();
    } catch (err) {
      setError((err as Error).message);
      setRetry({ text: value, request_id: requestId });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const initial = location.state as { send?: string; draft?: string } | null;
    if (initial?.draft) setText(initial.draft);
    if (initial?.send && consumed.current !== location.key) {
      consumed.current = location.key;
      void send(initial.send);
      navigate("/chat", { replace: true, state: null });
    }
  }, [location.key]);
  async function openHistory() {
    setHistory(true);
    setError("");
    if (!signedIn) {
      setConversations(listLocalConversations());
      return;
    }
    try {
      setConversations(
        await call<Conversation[]>(
          "conversations" +
            (activeJourney ? "?journey_id=" + activeJourney.id : ""),
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function resume(id: string) {
    try {
      if (!signedIn) {
        setMessages(getLocalConversation(id));
        setConversation(id);
        setConversationJourney(null);
        setHistory(false);
        setUrgent(null);
        setRetry(null);
        return;
      }
      setMessages(await call<Message[]>(`conversations?id=${id}`));
      setConversation(id);
      setConversationJourney(
        conversations.find((c) => c.id === id)?.journey_id || null,
      );
      setHistory(false);
      setUrgentQuery(null);
      setCareEpoch((n) => n + 1);
      setUrgent(null);
      setRetry(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function deleteConversation() {
    if (!deleteId) return;
    try {
      if (!signedIn) deleteLocalConversation(deleteId);
      else await call(`conversations?id=${deleteId}`, "DELETE");
      if (conversationId === deleteId) {
        setMessages([]);
        setConversation(null);
      }
      setDeleteId(null);
      await openHistory();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  function action(type: string) {
    if (type === "sos") onSOS();
    else if (type === "nearby") navigate("/nearby");
    else if (type === "start_journey") onNew();
    else if (type === "view_timeline") navigate("/journey");
  }
  async function savePending(event: EventDraft, key: string) {
    const journeyId = conversationId ? conversationJourney : activeJourney?.id;
    if (!journeyId) {
      onNew();
      return;
    }
    if (saving) return;
    setSaving(key);
    setError("");
    try {
      if (!pendingRequests.current.has(key)) {
        const bytes = new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)),
        );
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes.slice(0, 16), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        pendingRequests.current.set(
          key,
          `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
        );
      }
      const saved = await call<{ id: string }>("events", "POST", {
        request_id: pendingRequests.current.get(key),
        journey_id: journeyId,
        event: { ...event, confidence: 1 },
      });
      setReview(null);
      setMessages((previous) =>
        previous.map((m) =>
          m.result
            ? {
                ...m,
                result: {
                  ...m.result,
                  events: m.result.events.map((x, index) =>
                    `${m.id}-${index}` === key
                      ? { status: "saved", event: { ...event, id: saved.id } }
                      : x,
                  ),
                },
              }
            : m,
        ),
      );
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }
  async function undo(id: string) {
    try {
      await call(`events?id=${id}`, "DELETE");
      setMessages((previous) =>
        previous.map((m) =>
          m.result
            ? {
                ...m,
                result: {
                  ...m.result,
                  events: m.result.events.filter((e) => e.event.id !== id),
                },
              }
            : m,
        ),
      );
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const latestUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const careText = urgentQuery || latestUser?.content || "";
  const showCare =
    isHealthText(careText) ||
    isCareSearch(careText) ||
    screenSafety(careText).urgency !== "none";
  return (
    <div className="chat-page">
      <div className="chat-heading">
        <button
          className="icon-button"
          aria-label="Back to home"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={21} />
        </button>
        <div className="chat-avatar">
          <Bot size={23} />
        </div>
        <div>
          <h1>
            {activeJourney
              ? activeJourney.destination_name.split(",")[0] + " companion"
              : "Your companion"}
          </h1>
          <span>
            {preview
              ? "Development preview"
              : activeJourney
                ? `Along for your ${activeJourney.destination_name} journey`
                : "Your companion, along the way"}
          </span>
        </div>
        <div className="chat-heading-actions">
          <button
            className="icon-button"
            onClick={openHistory}
            aria-label="Conversation history"
          >
            <History size={19} />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setMessages([]);
              setConversation(null);
              setRetry(null);
              setUrgent(null);
              setUrgentQuery(null);
              setCareEpoch((n) => n + 1);
            }}
            aria-label="New conversation"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
      {urgent && (
        <div className="urgent-banner" role="alert">
          <ShieldAlert size={22} />
          <div>
            <strong>Don’t wait for this conversation.</strong>
            <p>{urgent}</p>
          </div>
          <Button variant="danger" onClick={onSOS}>
            Emergency access
          </Button>
        </div>
      )}
      <div className="messages-scroll">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="welcome-bot">
              <Bot size={48} />
            </div>
            <span className="eyebrow">A LITTLE COMPANY, WHEREVER YOU GO</span>
            <h2>What’s on your mind?</h2>
            <p>
              A meal to remember, a question about your trip,
              <br />
              or just a little help along the way.
            </p>
            <div className="chat-prompts">
              {[
                "I just had lunch.",
                `What food can I explore in ${activeJourney?.destination_name || "my destination"}?`,
                "I’m not feeling well.",
              ].map((prompt) => (
                <button key={prompt} onClick={() => setText(prompt)}>
                  {prompt}
                  <ArrowUpIcon />
                </button>
              ))}
            </div>
            <small className="muted">
              General health information, not diagnosis or personalized
              treatment.
            </small>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message-row ${message.role}`}>
              {message.role === "assistant" && (
                <div className="message-avatar">
                  <Bot size={19} />
                </div>
              )}
              <div className="message-column">
                <div className="message-bubble">
                  {message.role === "assistant" ? (
                    <AssistantReply
                      result={message.result}
                      journey={activeJourney || null}
                      reply={message.content}
                      inlineCare={showCare}
                    />
                  ) : (
                    message.content
                  )}
                </div>
                {message.result && (
                  <>
                    {message.result.persistence_error && (
                      <p className="message-note">
                        {message.result.persistence_error}
                      </p>
                    )}
                    {message.result.events.map((entry, index) => (
                      <div
                        className="saved-event-card"
                        key={entry.event.id || index}
                      >
                        <div>
                          <span className="mini-icon green">
                            {entry.status === "saved" ? (
                              <Check size={17} />
                            ) : (
                              <Compass size={17} />
                            )}
                          </span>
                          <span>
                            <strong>{entry.event.title}</strong>
                            <small>
                              {entry.status === "saved"
                                ? "Saved to journey"
                                : "Check this extracted entry before saving"}
                            </small>
                          </span>
                        </div>
                        {entry.status === "saved" && entry.event.id ? (
                          <button
                            className="text-link"
                            onClick={() => void undo(entry.event.id!)}
                          >
                            <CornerUpLeft size={14} />
                            Undo
                          </button>
                        ) : (
                          <Button
                            variant="secondary"
                            loading={saving === `${message.id}-${index}`}
                            onClick={() =>
                              setReview({
                                event: entry.event,
                                key: `${message.id}-${index}`,
                              })
                            }
                          >
                            Confirm & save
                          </Button>
                        )}
                      </div>
                    ))}
                    {message.result.recent_events?.length &&
                    message.result.medical_context.contains_health_guidance ? (
                      <details className="context-details">
                        <summary>
                          Recent reported moments ·{" "}
                          {message.result.recent_events.length}
                        </summary>
                        <ul>
                          {message.result.recent_events.map((e) => (
                            <li key={e.id}>
                              {e.title}
                              {e.time_text ? ` · ${e.time_text}` : ""}
                            </li>
                          ))}
                        </ul>
                        <small>
                          Reported facts. This does not establish a cause.
                        </small>
                      </details>
                    ) : null}
                    {!!message.result.historical_events?.length && (
                      <details className="context-details">
                        <summary>
                          Earlier reported symptoms ·{" "}
                          {message.result.historical_events.length}
                        </summary>
                        <ul>
                          {message.result.historical_events.map((e) => (
                            <li key={e.id}>
                              {e.title} ·{" "}
                              {new Date(
                                e.occurred_at || e.created_at,
                              ).toLocaleDateString()}
                            </li>
                          ))}
                        </ul>
                        <small>
                          Earlier records, not a diagnosis or an inferred
                          connection.
                        </small>
                      </details>
                    )}
                    {message.result.medical_context.source_ids.length > 0 && (
                      <div className="source-cards">
                        {message.result.medical_context.source_ids
                          .map((id) => sources.find((s) => s.id === id))
                          .filter(Boolean)
                          .map((source) => (
                            <a
                              key={source!.id}
                              href={source!.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span>{source!.organization}</span>
                              <strong>
                                {source!.topic}
                                <ExternalLink size={13} />
                              </strong>
                              <p>{source!.summary}</p>
                            </a>
                          ))}
                      </div>
                    )}
                    {message.result.actions.length > 0 && (
                      <div className="message-actions">
                        {message.result.actions.map((a) => (
                          <Button
                            key={a.type}
                            variant="secondary"
                            onClick={() => action(a.type)}
                          >
                            {a.label}
                            <ArrowRight size={14} />
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <time className="message-time">
                  {new Date(message.created_at).toLocaleTimeString("en", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          ))
        )}
        {showCare && (
          <CareFinder
            key={`${identity}:${activeJourney?.id || "general"}:${careEpoch}`}
            destination={activeJourney?.destination_name}
            urgency={screenSafety(careText).urgency}
            onSOS={onSOS}
          />
        )}
        {busy && (
          <div className="thinking">
            <Bot size={17} />
            <LoaderCircle size={16} className="spin" />A little moment…
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-bottom">
        {error && (
          <ErrorBox
            message={error}
            retry={
              retry ? () => void send(retry.text, retry.request_id) : undefined
            }
          />
        )}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <button
            type="button"
            className="icon-button"
            aria-label="Add a photo"
            onClick={onPhoto}
          >
            <Camera size={21} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Record voice message"
            onClick={onVoice}
          >
            <Mic size={21} />
          </button>
          <textarea
            aria-label="Message LINC-33"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            placeholder="Tell me a little about your day…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
          />
          <button
            className="send-button"
            aria-label="Send message"
            disabled={
              !text.trim() || (busy && screenSafety(text).urgency === "none")
            }
          >
            <ArrowRight size={21} />
          </button>
        </form>
        <p>
          General information only. For urgent concerns, use emergency access.
        </p>
      </div>
      <Modal
        open={!!review}
        onOpenChange={(v) => {
          if (!v && !saving) setReview(null);
        }}
        title="Review extracted entry"
        description="Correct what was understood. Nothing is saved until you confirm."
      >
        {review && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await savePending(review.event, review.key);
            }}
          >
            <label>
              Title
              <input
                required
                maxLength={160}
                value={review.event.title}
                onChange={(e) =>
                  setReview({
                    ...review,
                    event: { ...review.event, title: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Details
              <textarea
                maxLength={2000}
                value={review.event.description || ""}
                onChange={(e) =>
                  setReview({
                    ...review,
                    event: { ...review.event, description: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Reported time
              <input
                value={review.event.time_text || ""}
                maxLength={160}
                placeholder="Time not reported"
                onChange={(e) =>
                  setReview({
                    ...review,
                    event: { ...review.event, time_text: e.target.value },
                  })
                }
              />
            </label>
            {error && <ErrorBox message={error} />}
            <Button type="submit" loading={!!saving}>
              Confirm &amp; save
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={history}
        onOpenChange={setHistory}
        title="Pick up where you left off"
        description={
          signedIn
            ? "Your saved conversations. Deleting a conversation also removes events extracted from its messages."
            : "Older conversations saved on this device. New guest conversations are not saved. Device history is not uploaded when you sign in."
        }
      >
        {error && <ErrorBox message={error} />}
        <div className="conversation-list">
          {conversations.length ? (
            conversations.map((c) => (
              <div key={c.id}>
                <button onClick={() => resume(c.id)}>
                  <History size={19} />
                  <span>
                    <strong>{c.title || "A conversation"}</strong>
                    <small>{new Date(c.updated_at).toLocaleDateString()}</small>
                  </span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete conversation"
                  onClick={() => setDeleteId(c.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="muted">No saved conversations yet.</p>
          )}
        </div>
      </Modal>
      <Modal
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Delete this conversation?"
        description="Messages and events extracted from this conversation will be deleted."
      >
        <Button variant="danger" onClick={deleteConversation}>
          Delete conversation
        </Button>
      </Modal>
    </div>
  );
}
function ArrowUpIcon() {
  return <ArrowRight size={15} />;
}
