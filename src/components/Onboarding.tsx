import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Check, ShieldCheck } from "lucide-react";
import {
  signupInput,
  interestOptions,
  allergyOptions,
  dietaryOptions,
} from "../../shared/contracts";
import { useLinc } from "../state";
import { Button, Modal, ErrorBox } from "./ui";
const order = [
  "name",
  "birthday",
  "sex",
  "allergies",
  "diet",
  "interests",
  "contact",
  "privacy",
] as const;
type Step = (typeof order)[number];
type Values = {
  display_name: string;
  date_of_birth: string;
  sex: "" | "male" | "female";
  allergies: string[];
  dietary_preference: string;
  interests: string[];
  contactName: string;
  contactPhone: string;
  relationship: string;
  storage_consent: boolean;
  ai_consent: boolean;
};
const labels: Record<Step, string> = {
  name: "What should we call you?",
  birthday: "When were you born?",
  sex: "Your sex",
  allergies: "Any allergies we should know about?",
  diet: "How do you usually eat?",
  interests: "What are you here for?",
  contact: "Who should we reach in an emergency?",
  privacy: "Your choices, made plainly",
};
const dietLabels: Record<string, string> = {
  vegetarian: "Vegetarian",
  non_vegetarian: "Non-vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  no_preference: "No preference",
};
export function ageFrom(dob: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const born = new Date(`${dob}T00:00:00`);
  if (
    Number.isNaN(born.getTime()) ||
    born.getFullYear() !== Number(dob.slice(0, 4)) ||
    born.getMonth() + 1 !== Number(dob.slice(5, 7)) ||
    born.getDate() !== Number(dob.slice(8, 10))
  )
    return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const months = now.getMonth() - born.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < born.getDate())) age -= 1;
  return age < 0 || age > 130 ? null : age;
}
export function Onboarding({
  open,
  onClose,
  mode = "signup",
}: {
  open: boolean;
  onClose: () => void;
  mode?: "signup" | "edit";
}) {
  const { profile, call, refresh, notify } = useLinc();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Values>({
    display_name: "",
    date_of_birth: "",
    sex: "",
    allergies: [],
    dietary_preference: "no_preference",
    interests: [],
    contactName: "",
    contactPhone: "",
    relationship: "",
    storage_consent: false,
    ai_consent: false,
  });
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const hydrated = useRef(false);
  useEffect(() => {
    // Fill in saved answers once per opening. Without this guard, a background
    // profile refresh would wipe what the person is currently typing.
    if (!open) {
      hydrated.current = false;
      return;
    }
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = profile.signup;
    const health = profile.profile;
    setStep(0);
    setError("");
    setValues({
      display_name: profile.display_name || "",
      date_of_birth: saved?.date_of_birth || "",
      sex: saved?.sex || "",
      allergies: health?.allergies || [],
      dietary_preference: saved?.dietary_preference || "no_preference",
      interests: saved?.interests || [],
      contactName: health?.emergency_contact?.name || "",
      contactPhone: health?.emergency_contact?.phone || "",
      relationship: health?.emergency_contact?.relationship || "",
      storage_consent: profile.consents.sensitive_storage,
      ai_consent: profile.consents.external_ai,
    });
  }, [open, profile]);
  const age = ageFrom(values.date_of_birth);
  const current = order[step];
  const toggle = (key: "allergies" | "interests", value: string) =>
    setValues((v) => {
      const list = v[key];
      if (key === "allergies" && value === "none")
        return { ...v, allergies: list.includes("none") ? [] : ["none"] };
      const next = list.includes(value)
        ? list.filter((x) => x !== value)
        : [...list.filter((x) => x !== "none"), value];
      return { ...v, [key]: next };
    });
  const valid =
    current === "name"
      ? values.display_name.trim().length >= 1
      : current === "birthday"
        ? !!age && age >= 18
        : current === "sex"
          ? !!values.sex
          : current === "allergies"
            ? values.allergies.length > 0
            : current === "diet"
              ? !!values.dietary_preference
              : current === "interests"
                ? values.interests.length > 0
                : current === "contact"
                  ? !values.contactPhone ||
                    (values.contactName.trim().length > 0 &&
                      /^\+?[\d ()-]{7,25}$/.test(values.contactPhone))
                  : true;
  async function finish() {
    setBusy(true);
    setError("");
    try {
      const input = signupInput.parse({
        display_name: values.display_name.trim(),
        date_of_birth: values.date_of_birth,
        sex: values.sex,
        allergies: values.allergies,
        dietary_preference: values.dietary_preference,
        interests: values.interests,
        emergency_contact: values.contactPhone
          ? {
              name: values.contactName.trim(),
              phone: values.contactPhone,
              relationship: values.relationship,
            }
          : null,
        adult: true,
        storage_consent: values.storage_consent,
        ai_consent: values.ai_consent,
      });
      await call("onboarding", "POST", input);
      await refresh();
      notify(
        mode === "signup"
          ? `Welcome aboard, ${values.display_name.trim().split(" ")[0]}.`
          : "Your details are updated.",
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={
        mode === "signup"
          ? "Let’s set up your companion"
          : "Update your details"
      }
      description={
        mode === "signup"
          ? "Add preferences for more relevant guidance, or skip for now and complete them in Profile. Only the privacy step changes what we store."
          : "Change any answer and save. Your privacy choices stay separate, in the Profile screen."
      }
    >
      <div className="wizard">
        {mode === "signup" && (
          <Button variant="ghost" onClick={onClose}>
            Skip preferences for now
          </Button>
        )}
        <div className="wizard-progress" role="status">
          <span>
            {mode === "signup"
              ? `Step ${step + 1} of ${order.length}`
              : labels[current]}
          </span>
          <div className="wizard-bar" aria-hidden="true">
            <i style={{ width: `${((step + 1) / order.length) * 100}%` }} />
          </div>
        </div>
        {mode === "signup" && (
          <h3 className="wizard-question">{labels[current]}</h3>
        )}
        {current === "name" && (
          <label className="full-width">
            Your name
            <input
              value={values.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              maxLength={100}
              placeholder="Alex"
              autoFocus
            />
          </label>
        )}
        {current === "birthday" && (
          <>
            <label className="full-width">
              Date of birth
              <input
                type="date"
                value={values.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <p className="wizard-note">
              {age === null
                ? "We use this to keep health information age-appropriate."
                : age >= 18
                  ? `You’re ${age}. We keep age-appropriate information in mind.`
                  : "LINC-33 is for adults aged 18 and over."}
            </p>
          </>
        )}
        {current === "sex" && (
          <div className="chip-grid">
            {(["male", "female"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${values.sex === option ? "selected" : ""}`}
                aria-pressed={values.sex === option}
                onClick={() => set("sex", option)}
              >
                {option === "male" ? "Male" : "Female"}
                {values.sex === option && <Check size={15} />}
              </button>
            ))}
          </div>
        )}
        {current === "allergies" && (
          <>
            <div className="chip-grid">
              {allergyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${values.allergies.includes(option) ? "selected" : ""}`}
                  aria-pressed={values.allergies.includes(option)}
                  onClick={() => toggle("allergies", option)}
                >
                  {option === "none" ? "None" : option}
                  {values.allergies.includes(option) && <Check size={15} />}
                </button>
              ))}
            </div>
            <p className="wizard-note">
              We use these only to flag dishes worth double-checking. We never
              claim a dish is safe for you.
            </p>
          </>
        )}
        {current === "diet" && (
          <div className="chip-grid">
            {dietaryOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${values.dietary_preference === option ? "selected" : ""}`}
                aria-pressed={values.dietary_preference === option}
                onClick={() => set("dietary_preference", option)}
              >
                {dietLabels[option]}
                {values.dietary_preference === option && <Check size={15} />}
              </button>
            ))}
          </div>
        )}
        {current === "interests" && (
          <>
            <div className="chip-grid">
              {interestOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${values.interests.includes(option) ? "selected" : ""}`}
                  aria-pressed={values.interests.includes(option)}
                  onClick={() => toggle("interests", option)}
                >
                  {option}
                  {values.interests.includes(option) && <Check size={15} />}
                </button>
              ))}
            </div>
            <p className="wizard-note">Pick as many as you like.</p>
          </>
        )}
        {current === "contact" && (
          <>
            <label className="full-width">
              Their name
              <input
                value={values.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                maxLength={100}
                placeholder="Optional"
              />
            </label>
            <label className="full-width">
              Their phone
              <input
                type="tel"
                value={values.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </label>
            <label className="full-width">
              Relationship
              <input
                value={values.relationship}
                onChange={(e) => set("relationship", e.target.value)}
                maxLength={80}
                placeholder="Sister, friend, spouse…"
              />
            </label>
            <p className="wizard-note">
              Optional, and only stored if private storage is on. Leave it blank
              to skip.
            </p>
          </>
        )}
        {current === "privacy" && (
          <div className="wizard-choices">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={values.storage_consent}
                onChange={(e) => set("storage_consent", e.target.checked)}
              />
              <span>
                <strong>Private storage</strong>
                <small>
                  Save journeys, meals, symptoms and allergies to your own
                  account. Without this, nothing new can be stored.
                </small>
              </span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={values.ai_consent}
                onChange={(e) => set("ai_consent", e.target.checked)}
              />
              <span>
                <strong>External AI processing</strong>
                <small>
                  Send your messages and recordings to Google Gemini for
                  transcription, translation and travel replies. Your allergies
                  and contact never go to the model.
                </small>
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" required defaultChecked readOnly />
              <span>
                <strong>I’m 18 or older</strong>
                <small>Confirmed at sign-up.</small>
              </span>
            </label>
            <p className="wizard-note">
              <ShieldCheck size={14} /> You can change either choice later in
              Profile. Declining never blocks emergency information.
            </p>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        <div className="wizard-actions">
          {step > 0 && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
            >
              <ArrowLeft size={17} />
              Back
            </Button>
          )}
          {step < order.length - 1 ? (
            <Button
              type="button"
              disabled={!valid}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
              <ArrowRight size={17} />
            </Button>
          ) : (
            <Button type="button" loading={busy} onClick={finish}>
              {mode === "signup" ? "Enter LINC-33" : "Save changes"}
              <ArrowRight size={17} />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
