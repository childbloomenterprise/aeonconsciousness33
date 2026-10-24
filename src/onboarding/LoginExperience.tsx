import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  LockKeyhole,
  Compass,
  Mail,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";
import {
  coreQuestions,
  deeperQuestions,
  isAdult,
  type Answers,
} from "./questions";
import "./login.css";

type Stage = "login" | "intro" | "core" | "choice" | "deep" | "review" | "done";
export function LoginExperience({ onSignIn }: { onSignIn?: () => void } = {}) {
  const live = !!onSignIn;
  const [stage, setStage] = useState<Stage>("login");
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [storage, setStorage] = useState(false);
  const [ai, setAi] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [editing, setEditing] = useState(false);
  const reduced = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = answers.name?.trim().split(" ")[0] || "traveller";
  const questions =
    stage === "deep" ? deeperQuestions(answers) : coreQuestions(answers);
  const q = questions[index];
  const questioning = stage === "core" || stage === "deep";
  useEffect(() => {
    heading.current?.focus();
    setError("");
  }, [stage, index]);
  function change(value: string) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
  }
  const valid =
    !questioning ||
    q.id === "privacy" ||
    q.optional ||
    (q.kind === "date"
      ? isAdult(answers[q.id] || "")
      : !!answers[q.id]?.trim());
  function next(skip = false) {
    if (!valid && !skip) return;
    if (skip)
      setAnswers((a) => {
        const b = { ...a };
        delete b[q.id];
        return b;
      });
    if (editing) {
      setEditing(false);
      setStage("review");
      return;
    }
    if (index < questions.length - 1) setIndex(index + 1);
    else {
      setStage(stage === "core" ? "choice" : "review");
      setIndex(0);
    }
  }
  function startDeep() {
    setIndex(0);
    setStage("deep");
  }
  function restart() {
    setAnswers({});
    setIndex(0);
    setStorage(false);
    setAi(false);
    setEmail("");
    setShowEmail(false);
    setEditing(false);
    setStage("login");
  }
  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <div className="lx-root">
      <header className="lx-header">
        <a
          className="lx-brand"
          href={live ? "/login" : "/login-review"}
          aria-label="LINC-33 login"
        >
          <span className="lx-logo">
            <Plus size={20} strokeWidth={1.8} />
          </span>
          LINC<span>33</span>
        </a>
        <div className="lx-header-right">
          <span className="lx-preview">
            <i />
            {live ? "Your travel companion" : "Local design preview"}
          </span>
          <button
            className="lx-link lx-restart"
            onClick={restart}
            aria-label="Restart preview"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </header>
      <main className={`lx-layout ${questioning ? "lx-question-layout" : ""}`}>
        <aside className="lx-story" aria-label="Your companion">
          <span className="lx-eyebrow">
            <span className="lx-small-line" /> A LITTLE CONTEXT. A BETTER
            JOURNEY.
          </span>
          <h1>
            Go somewhere new.
            <br />
            <span>Feel more like you.</span>
          </h1>
          <p>
            A companion that gets to know you.
            <br />
            For the food, the feelings, and everything
            <br className="lx-desktop" /> in between.
          </p>
          <div className="lx-art" aria-hidden="true">
            <div className="lx-orbit lx-orbit-one" />
            <div className="lx-orbit lx-orbit-two" />
            <div className="lx-orbit lx-orbit-three" />
            <div className="lx-orb">
              <Plus size={34} strokeWidth={1} />
            </div>
            <div className="lx-orbit-dot" />
            <span className="lx-art-label lx-art-food">
              <i />
              Your everyday rhythms
            </span>
            <span className="lx-art-label lx-art-you">
              <span />A little more understood
            </span>
          </div>
          <div className="lx-story-footer">
            <Compass size={16} />
            <span>Made for wherever life takes you.</span>
          </div>
        </aside>
        <section
          className="lx-content"
          aria-label="Account and personalisation"
        >
          {questioning && (
            <div className="lx-progress">
              <div>
                <span>
                  {stage === "core" ? "THE ESSENTIALS" : "A LITTLE MORE YOU"}
                </span>
                <span>
                  {String(index + 1).padStart(2, "0")}{" "}
                  <em>/ {questions.length}</em>
                </span>
              </div>
              <div className="lx-progress-track">
                <motion.i
                  animate={{
                    width: `${((index + 1) / questions.length) * 100}%`,
                  }}
                  transition={transition}
                />
              </div>
            </div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${stage}-${questioning ? q.id : ""}`}
              className="lx-scene"
              onAnimationComplete={() => heading.current?.focus()}
              initial={{
                opacity: 0,
                y: reduced ? 0 : 16,
                filter: reduced ? "none" : "blur(3px)",
              }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: reduced ? 0 : -10 }}
              transition={transition}
            >
              {stage === "login" && (
                <>
                  <div className="lx-section-icon">
                    <Compass size={24} strokeWidth={1.4} />
                  </div>
                  <span className="lx-eyebrow">
                    YOUR JOURNEY STARTS WITH YOU
                  </span>
                  <h2 ref={heading} tabIndex={-1}>
                    A familiar feeling.
                    <br />A fresh start.
                  </h2>
                  <p className="lx-subtitle">
                    A little about you makes all the difference.
                    <br />
                    Let’s make this feel like your companion.
                  </p>
                  <button
                    className="lx-primary"
                    onClick={() => (live ? onSignIn() : setStage("intro"))}
                  >
                    Explore your personal setup <ArrowRight size={18} />
                  </button>
                  <div className="lx-divider">
                    <span />
                    or sign in
                    <span />
                  </div>
                  {!showEmail ? (
                    <button
                      className="lx-secondary"
                      onClick={() => (live ? onSignIn() : setShowEmail(true))}
                    >
                      <Mail size={17} />
                      Continue with email
                      <ArrowUpRight size={16} />
                    </button>
                  ) : (
                    <form
                      className="lx-email-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setError(
                          'Live sign-in is not connected in this review copy. Use "Explore your personal setup" to try the complete experience.',
                        );
                      }}
                    >
                      <label htmlFor="lx-email">Email address</label>
                      <input
                        id="lx-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <button className="lx-secondary" type="submit">
                        Email me a sign-in link
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  )}
                  {error && (
                    <p className="lx-notice" role="status">
                      {error}
                    </p>
                  )}
                  <p className="lx-fine">
                    <LockKeyhole size={13} /> Your pace. Your choices. Always.
                  </p>
                  <p className="lx-preview-note">
                    {live
                      ? "Sign in securely, then choose what your companion remembers."
                      : "Preview only · No account is created or personal details saved."}
                  </p>
                </>
              )}
              {stage === "intro" && (
                <>
                  <span className="lx-eyebrow">
                    NOT A FORM. A CONVERSATION.
                  </span>
                  <h2 ref={heading} tabIndex={-1}>
                    Let’s begin
                    <br />
                    with the little things.
                  </h2>
                  <p className="lx-subtitle">
                    Nine thoughtful questions. One at a time.
                    <br />
                    Your answers shape what we ask next.
                  </p>
                  <div className="lx-intro-list">
                    <span>
                      <i>01</i>The essentials<span>About 2 minutes</span>
                    </span>
                    <span>
                      <i>02</i>Make it more personal
                      <span>Optional, 26+ questions</span>
                    </span>
                    <span>
                      <i>03</i>Review your choices<span>You’re in control</span>
                    </span>
                  </div>
                  <button
                    className="lx-primary"
                    onClick={() => {
                      setIndex(0);
                      setStage("core");
                    }}
                  >
                    Let’s get acquainted
                    <ArrowRight size={18} />
                  </button>
                  <p className="lx-fine">
                    For adults 18 and over. Use sample details for this preview.
                  </p>
                </>
              )}
              {questioning && (
                <>
                  <span className="lx-eyebrow">
                    {q.optional
                      ? "ONLY IF YOU’D LIKE TO SHARE"
                      : q.id === "name"
                        ? "NICE TO MEET YOU"
                        : `GETTING TO KNOW ${answers.name ? first.toUpperCase() : "YOU"}`}
                  </span>
                  <h2 ref={heading} tabIndex={-1}>
                    {q.title}
                  </h2>
                  <p className="lx-subtitle">{q.note}</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                  >
                    {q.choices ? (
                      <div
                        className="lx-options"
                        role="group"
                        aria-label={q.title}
                      >
                        {q.choices.map((s, i) => (
                          <button
                            key={s}
                            type="button"
                            className={`lx-option ${answers[q.id] === s ? "is-selected" : ""}`}
                            aria-pressed={answers[q.id] === s}
                            onClick={() => change(s)}
                          >
                            <span
                              className="lx-option-number"
                              aria-hidden="true"
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{s}</span>
                            <span className="lx-option-check">
                              {answers[q.id] === s ? (
                                <Check size={14} />
                              ) : (
                                <Plus size={14} />
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : q.id === "privacy" ? (
                      <div className="lx-consents">
                        <label>
                          <span>
                            <strong>Remember my journey</strong>
                            <small>
                              Save the details I choose to share in my private
                              profile.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            checked={storage}
                            onChange={(e) => setStorage(e.target.checked)}
                          />
                          <i />
                        </label>
                        <label>
                          <span>
                            <strong>Let Gemini help</strong>
                            <small>
                              Allow external AI processing of supported
                              conversation context. Separate from storage.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            checked={ai}
                            onChange={(e) => setAi(e.target.checked)}
                          />
                          <i />
                        </label>
                        <p>
                          Preview choices only. Nothing is sent to Gemini or
                          saved by this flow.
                        </p>
                      </div>
                    ) : (
                      <div className="lx-answer-field">
                        <label htmlFor={`answer-${q.id}`}>
                          {q.kind === "date"
                            ? "Date of birth"
                            : q.id === "name"
                              ? "Your first name"
                              : "Your answer"}
                        </label>
                        <input
                          id={`answer-${q.id}`}
                          type={q.kind || "text"}
                          autoComplete={
                            q.id === "name"
                              ? "given-name"
                              : q.kind === "date"
                                ? "bday"
                                : "off"
                          }
                          placeholder={q.placeholder}
                          value={answers[q.id] || ""}
                          onChange={(e) => change(e.target.value)}
                          maxLength={q.id === "name" ? 60 : 500}
                          max={
                            q.kind === "date"
                              ? new Date().toISOString().slice(0, 10)
                              : undefined
                          }
                        />
                        {q.kind === "date" &&
                          answers[q.id] &&
                          !isAdult(answers[q.id]) && (
                            <p role="status">
                              Enter a valid date of birth. This pilot is
                              available to adults aged 18–130.
                            </p>
                          )}
                      </div>
                    )}
                    {q.id === "allergies" &&
                      answers.allergies === "Yes, I have food allergies" && (
                        <p className="lx-response">
                          <span />
                          We’ll offer space for the details in your deeper
                          profile.
                        </p>
                      )}
                    {q.id === "purpose" && answers.purpose && (
                      <p className="lx-response">
                        <span />
                        {answers.purpose === "Feel better on a trip"
                          ? "Understood. We’ll start with where you are in your journey."
                          : "Got it. Let’s build around what matters to you."}
                      </p>
                    )}
                    <div className="lx-navigation">
                      <button
                        className="lx-back"
                        type="button"
                        onClick={() => {
                          if (editing) {
                            setEditing(false);
                            setStage("review");
                          } else if (index > 0) setIndex(index - 1);
                          else setStage(stage === "core" ? "intro" : "choice");
                        }}
                        aria-label="Previous question"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      {q.optional && (
                        <button
                          className="lx-link"
                          type="button"
                          onClick={() => next(true)}
                        >
                          Skip for now
                        </button>
                      )}
                      <button
                        className="lx-primary"
                        disabled={!valid}
                        type="submit"
                      >
                        {editing
                          ? "Update answer"
                          : index === questions.length - 1
                            ? stage === "core"
                              ? "Finish the essentials"
                              : "Review my answers"
                            : "Continue"}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    {stage === "deep" && (
                      <button
                        className="lx-deep-exit lx-link"
                        type="button"
                        onClick={() => setStage("review")}
                      >
                        That’s enough for now — review my answers
                      </button>
                    )}
                  </form>
                </>
              )}
              {stage === "choice" && (
                <>
                  <div className="lx-section-icon">
                    <Check size={25} />
                  </div>
                  <span className="lx-eyebrow">
                    THE ESSENTIALS, BEAUTIFULLY DONE
                  </span>
                  <h2 ref={heading} tabIndex={-1}>
                    A little more you,
                    <br />
                    {first}?
                  </h2>
                  <p className="lx-subtitle">
                    We have a starting point. If you’d like, tell us about your
                    rhythms, preferences, and the little things that make travel
                    feel better.
                  </p>
                  <div className="lx-deep-card">
                    <span className="lx-eyebrow">THE DEEPER PROFILE</span>
                    <strong>Good companions pay attention.</strong>
                    <p>
                      {deeperQuestions(answers).length}+ optional questions,
                      shaped around your answers. Skip any, or stop whenever you
                      like.
                    </p>
                    <span className="lx-deep-tags">
                      Food & habits <i /> Travel & rhythm <i /> Your preferences
                    </span>
                  </div>
                  <button className="lx-primary" onClick={startDeep}>
                    Let’s make it more personal
                    <Plus size={17} />
                  </button>
                  <button
                    className="lx-secondary lx-quiet"
                    onClick={() => setStage("review")}
                  >
                    I’m ready with the essentials
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
              {stage === "review" && (
                <>
                  <span className="lx-eyebrow">A REFLECTION, NOT A LABEL</span>
                  <h2 ref={heading} tabIndex={-1}>
                    This sounds
                    <br />a little like you.
                  </h2>
                  <p className="lx-subtitle">
                    Take a moment, {first}. Every answer is yours to change.
                  </p>
                  <div className="lx-review-list">
                    {[...coreQuestions(answers), ...deeperQuestions(answers)]
                      .filter((v) => v.id !== "privacy" && answers[v.id])
                      .map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            const c = coreQuestions(answers).findIndex(
                              (c) => c.id === v.id,
                            );
                            setIndex(
                              c >= 0
                                ? c
                                : deeperQuestions(answers).findIndex(
                                    (c) => c.id === v.id,
                                  ),
                            );
                            setStage(c >= 0 ? "core" : "deep");
                            setEditing(true);
                          }}
                        >
                          <span>
                            {v.id === "birthday" ? "Date of birth" : v.title}
                            <strong>{answers[v.id]}</strong>
                          </span>
                          <span className="lx-edit">
                            Edit
                            <ArrowUpRight size={13} />
                          </span>
                        </button>
                      ))}
                  </div>
                  <p className="lx-fine">
                    Storage: {storage ? "chosen" : "off"} · Gemini processing:{" "}
                    {ai ? "chosen" : "off"}{" "}
                    <button
                      className="lx-link"
                      onClick={() => {
                        setIndex(8);
                        setStage("core");
                        setEditing(true);
                      }}
                    >
                      Change
                    </button>
                  </p>
                  <button
                    className="lx-primary"
                    onClick={() => setStage("done")}
                  >
                    This feels like me
                    <Check size={17} />
                  </button>
                </>
              )}
              {stage === "done" && (
                <>
                  <div className="lx-success-orb">
                    <Check size={30} strokeWidth={1.4} />
                  </div>
                  <span className="lx-eyebrow">A GOOD PLACE TO BEGIN</span>
                  <h2 ref={heading} tabIndex={-1}>
                    Here’s to feeling
                    <br />
                    more understood, {first}.
                  </h2>
                  <p className="lx-subtitle">
                    Your setup preview is complete.
                    <br />A calmer, more personal journey starts here.
                  </p>
                  <div className="lx-complete-note">
                    <LockKeyhole size={20} />
                    <p>
                      This was a local design review. Your answers stay in
                      memory until you refresh or restart. No account or saved
                      profile was created.
                    </p>
                  </div>
                  <button
                    className="lx-primary"
                    onClick={() => setStage("review")}
                  >
                    Revisit my answers
                    <ArrowLeft size={17} />
                  </button>
                  <button className="lx-secondary lx-quiet" onClick={restart}>
                    Try a different journey
                    <RotateCcw size={16} />
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
      <footer className="lx-footer">
        <span>A little further. A little better.</span>
        <span>
          CONSIDERED CARE, WHEREVER YOU ARE <span>✳</span>
        </span>
        <a href="/">
          Back to existing app
          <ArrowUpRight size={13} />
        </a>
      </footer>
    </div>
  );
}
