import { useState } from "react";
import {
  Mail,
  LockKeyhole,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MailCheck,
  KeyRound,
} from "lucide-react";
import { useLinc } from "../state";
import { supabase } from "../lib/client";
import { Button, Modal, ErrorBox } from "./ui";
export function Auth() {
  const {
    authOpen,
    setAuthOpen,
    authConfigured,
    recovery,
    notify,
    completeRecovery,
    setOnboardingOpen,
  } = useLinc();
  const [usePassword, setUsePassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submitMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!adult) {
      setError("Confirm you are at least 18 years old.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (result.error) throw result.error;
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function resetAuthForm() {
    setSent(false);
    setUsePassword(false);
    setMode("login");
    setEmail("");
    setPassword("");
    setAdult(false);
    setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!recovery && mode !== "recovery" && !adult) {
      setError("Confirm you are at least 18 years old.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (recovery) {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        notify("Password updated. Welcome aboard.");
        setAuthOpen(false);
        completeRecovery();
        window.history.replaceState({}, "", "/");
        return;
      }
      if (mode === "recovery") {
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (result.error) throw result.error;
        notify("If that account exists, a recovery link will arrive shortly.");
        setMode("login");
        return;
      }
      if (mode === "signup") {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (result.error) throw result.error;
        // With email confirmation enabled there is no session yet, so the
        // questionnaire has to wait until the first sign-in.
        if (result.data.session) {
          setAuthOpen(false);
          setOnboardingOpen(true);
        } else {
          notify(
            "Almost there — confirm your email address, then sign in to finish setting up.",
          );
          setMode("login");
        }
        return;
      }
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (result.error) throw result.error;
      notify("Welcome back.");
      setAuthOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={authOpen}
      onOpenChange={(open) => {
        setAuthOpen(open);
        if (!open) resetAuthForm();
      }}
      title={
        recovery
          ? "Choose your password"
          : sent
            ? "Check your email"
            : !usePassword
              ? "Welcome aboard"
              : mode === "recovery"
                ? "Find your way back"
                : mode === "signup"
                  ? "Start your journey"
                  : "Welcome aboard"
      }
      description={
        sent
          ? "Tap the link we just sent to finish signing in."
          : !usePassword
            ? "LINC-33 is a travel companion for adults aged 18 and over. One email, no password to remember."
            : mode === "signup"
              ? "Create your account, then choose your details and privacy preferences. For adults aged 18 and over."
              : "LINC-33 is a travel companion for adults aged 18 and over."
      }
    >
      {!authConfigured ? (
        <div className="setup-message">
          <ShieldCheck size={32} />
          <h3>We’re getting ready for your journey.</h3>
          <p>
            Account services haven’t been connected yet. You can explore local
            foods and general health resources, and emergency access stays
            available.
          </p>
          <p className="muted small">
            Pilot administrator: connect Supabase and authentication email
            delivery using the setup guide.
          </p>
        </div>
      ) : sent ? (
        <div className="setup-message">
          <MailCheck size={32} />
          <h3>Link sent to {email}</h3>
          <p>
            Open it on this device to continue. It signs you in and creates your
            account automatically if you’re new here.
          </p>
          <Button variant="ghost" type="button" onClick={resetAuthForm}>
            Use a different email
          </Button>
        </div>
      ) : !usePassword && !recovery ? (
        <form onSubmit={submitMagicLink} className="form-stack">
          <label>
            Email address
            <div className="input-icon">
              <Mail size={18} />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              required
            />
            I confirm I am at least 18 years old.
          </label>
          {error && <ErrorBox message={error} />}
          <Button type="submit" loading={busy} disabled={!adult}>
            <Sparkles size={17} />
            Email me a sign-in link
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setUsePassword(true)}
          >
            <KeyRound size={15} />
            Use a password instead
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} className="form-stack">
          {!recovery && (
            <Button
              variant="ghost"
              type="button"
              className="auth-back-link"
              onClick={() => setUsePassword(false)}
            >
              <Sparkles size={15} />
              Use a one-time email link instead
            </Button>
          )}
          {!recovery && (
            <label>
              Email address
              <div className="input-icon">
                <Mail size={18} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
            </label>
          )}
          {(recovery || mode !== "recovery") && (
            <label>
              Password
              <div className="input-icon">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  autoComplete={
                    recovery || mode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  minLength={recovery || mode === "signup" ? 12 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Your password"
                />
              </div>
            </label>
          )}
          {mode !== "recovery" && !recovery && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                required
              />
              I confirm I am at least 18 years old.
            </label>
          )}
          {mode === "signup" && (
            <p className="muted small">
              Use at least 12 characters. We never send you marketing email.
            </p>
          )}
          {error && <ErrorBox message={error} />}
          <Button
            type="submit"
            loading={busy}
            disabled={!recovery && mode !== "recovery" && !adult}
          >
            {recovery
              ? "Set password"
              : mode === "recovery"
                ? "Send recovery link"
                : mode === "signup"
                  ? "Create my account"
                  : "Sign in"}
            <ArrowRight size={17} />
          </Button>
          {!recovery && (
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                setMode(
                  mode === "recovery"
                    ? "login"
                    : mode === "login"
                      ? "recovery"
                      : "login",
                )
              }
            >
              {mode === "login"
                ? "Forgot your password?"
                : mode === "signup"
                  ? "I already have an account"
                  : "Back to sign in"}
            </Button>
          )}
          {mode === "login" && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => setMode("signup")}
            >
              New here? Create an account
            </Button>
          )}
        </form>
      )}
    </Modal>
  );
}
