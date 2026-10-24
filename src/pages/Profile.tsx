import { useEffect, useState } from "react";
import {
  Heart,
  ShieldCheck,
  Phone,
  Globe,
  Check,
  LogOut,
  Trash2,
  ArrowRight,
  ExternalLink,
  Leaf,
  LockKeyhole,
  Mic,
} from "lucide-react";
import type { HealthProfileInput, ConsentType } from "../../shared/contracts";
import { healthInput } from "../../shared/contracts";
import { sources } from "../../shared/knowledge";
import { useLinc } from "../state";
import { Button, ErrorBox, Modal, Empty } from "../components/ui";
import { Onboarding, ageFrom } from "../components/Onboarding";
import { AccountIcon } from "../components/AccountIcon";
const dietLabels: Record<string, string> = {
  vegetarian: "Vegetarian",
  non_vegetarian: "Non-vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  no_preference: "No preference",
};
const split = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export function Profile({ onVoiceMeal }: { onVoiceMeal: () => void }) {
  const {
    profile,
    session,
    signedIn,
    preview,
    setAuthOpen,
    call,
    refresh,
    notify,
    signOut,
  } = useLinc();
  const [tab, setTab] = useState<"health" | "privacy" | "sources">("health");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [blood, setBlood] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editDetails, setEditDetails] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [eraseHealth, setEraseHealth] = useState(false);
  useEffect(() => {
    const p = profile.profile;
    setName(profile.display_name);
    setAge(p?.age_range || "");
    setBlood(p?.blood_group || "");
    setAllergies(p?.allergies?.join(", ") || "");
    setConditions(p?.medical_conditions?.join(", ") || "");
    setMedications(p?.current_medications?.join(", ") || "");
    setContactName(p?.emergency_contact?.name || "");
    setContactPhone(p?.emergency_contact?.phone || "");
    setRelationship(p?.emergency_contact?.relationship || "");
  }, [profile]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = healthInput.parse({
        display_name: name,
        age_range: age || null,
        blood_group: blood || null,
        allergies: split(allergies),
        medical_conditions: split(conditions),
        current_medications: split(medications),
        emergency_contact: contactPhone
          ? { name: contactName, phone: contactPhone, relationship }
          : null,
      });
      await call("health-context", "PATCH", input);
      await refresh();
      notify("Your profile is updated.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setConsent(type: ConsentType, granted: boolean) {
    setBusy(true);
    setError("");
    try {
      await call("privacy", "POST", { consent_type: type, granted });
      await refresh();
      notify(
        granted
          ? "Your choice is saved."
          : "Consent revoked. Existing records remain until you delete them.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount() {
    setBusy(true);
    setError("");
    try {
      if (preview)
        throw new Error(
          "Account deletion is unavailable in the synthetic development preview.",
        );
      await call("privacy", "DELETE", { confirm });
      await signOut();
      setDeleteOpen(false);
      notify("Account and associated records deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeHealth() {
    setBusy(true);
    try {
      await call("health-context", "DELETE");
      await refresh();
      setEraseHealth(false);
      notify("Health profile and emergency contact deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR JOURNEY. YOUR CHOICES.</div>
          <h1>
            A little about you<span className="greeting-dot">.</span>
          </h1>
          <p>
            Share only what you’re comfortable with. You’re always in control.
          </p>
        </div>
        {signedIn && !preview && (
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut size={17} />
            Sign out
          </Button>
        )}
      </div>
      <div className="profile-layout">
        <aside className="profile-sidebar panel">
          <div className="profile-avatar">
            {name ? (
              name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            ) : (
              <AccountIcon size={32} />
            )}
          </div>
          <h2>{name || "Your traveler profile"}</h2>
          <p>{session?.user.email || "A little further. A little better."}</p>
          <span className="traveler-badge">
            <Leaf size={13} />
            {preview ? "Sample traveler" : "Along for the journey"}
          </span>
          <nav aria-label="Profile sections">
            <button
              className={tab === "health" ? "active" : ""}
              onClick={() => setTab("health")}
            >
              <Heart size={18} />
              Health profile
              <ArrowRight size={15} />
            </button>
            <button
              className={tab === "privacy" ? "active" : ""}
              onClick={() => setTab("privacy")}
            >
              <ShieldCheck size={18} />
              Privacy & choices
              <ArrowRight size={15} />
            </button>
            <button
              className={tab === "sources" ? "active" : ""}
              onClick={() => setTab("sources")}
            >
              <Globe size={18} />
              Our sources
              <ArrowRight size={15} />
            </button>
          </nav>
          <div className="privacy-reassurance">
            <LockKeyhole size={20} />
            <p>
              Your health profile stays out of Gemini’s conversation context.
            </p>
          </div>
        </aside>
        <section className="panel profile-content">
          <div className="voice-food-card">
            <span className="action-icon green">
              <Mic size={22} />
            </span>
            <div>
              <h3>Your food diary, by voice</h3>
              <p>
                Tell us what you ate for breakfast, lunch or dinner. Review the
                transcript, then keep reported meals in your journey.
              </p>
            </div>
            <Button variant="secondary" onClick={onVoiceMeal}>
              <Mic size={18} />
              Log foods by voice
            </Button>
          </div>
          {signedIn && tab === "health" && (
            <div className="about-you">
              <div className="card-title">
                <div>
                  <AccountIcon size={19} />
                  <h3>About you</h3>
                </div>
                <button
                  className="text-link"
                  onClick={() => setEditDetails(true)}
                >
                  Update details
                  <ArrowRight size={14} />
                </button>
              </div>
              {profile.signup?.onboarded ? (
                <dl className="about-grid">
                  <div>
                    <dt>Age</dt>
                    <dd>
                      {ageFrom(profile.signup.date_of_birth || "") ?? "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Sex</dt>
                    <dd>
                      {profile.signup.sex
                        ? profile.signup.sex[0].toUpperCase() +
                          profile.signup.sex.slice(1)
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Usually eats</dt>
                    <dd>
                      {dietLabels[profile.signup.dietary_preference || ""] ||
                        "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Interests</dt>
                    <dd>
                      {profile.signup.interests?.length
                        ? profile.signup.interests.join(", ")
                        : "Not set"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="muted">
                  Tell us a little about yourself and your answers shape your
                  journey and food diary.{" "}
                  <button
                    className="text-link"
                    onClick={() => setEditDetails(true)}
                  >
                    Answer seven questions
                    <ArrowRight size={14} />
                  </button>
                </p>
              )}
            </div>
          )}
          <Onboarding
            open={editDetails}
            onClose={() => setEditDetails(false)}
            mode="edit"
          />
          {error && <ErrorBox message={error} />}
          {tab === "sources" ? (
            <>
              <span className="eyebrow">CLEAR SOURCES. HONEST LIMITS.</span>
              <h2>Information you can inspect.</h2>
              <p className="muted">
                Original general-information summaries with direct source links.
                Source-verified, not clinically reviewed. LINC-33 is not
                endorsed by these organizations.
              </p>
              <div className="profile-sources">
                {sources.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="eyebrow">{s.organization}</span>
                    <h3>
                      {s.topic}
                      <ExternalLink size={16} />
                    </h3>
                    <p>{s.summary}</p>
                    <small>
                      Last verified {s.verified_at} · {s.review_status}
                    </small>
                  </a>
                ))}
              </div>
            </>
          ) : !signedIn ? (
            <Empty
              icon={<ShieldCheck size={30} />}
              title="A profile that belongs to you"
              action={
                <Button onClick={() => setAuthOpen(true)}>Sign in</Button>
              }
            >
              Sign in to choose what you share and save.
            </Empty>
          ) : tab === "privacy" ? (
            <>
              <span className="eyebrow">YOU DECIDE WHAT STAYS</span>
              <h2>Privacy, without the guesswork.</h2>
              <div className="consent-card">
                <div>
                  <h3>Private journey storage</h3>
                  <p>
                    Save conversations, meals, symptoms, health profile and
                    emergency contact in your user-owned Supabase records.
                    Optional; you can revoke this at any time.
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    aria-label="Allow private storage"
                    checked={profile.consents.sensitive_storage}
                    disabled={busy}
                    onChange={(e) =>
                      void setConsent("sensitive_storage", e.target.checked)
                    }
                  />
                  <span />
                </label>
              </div>
              <div className="consent-card">
                <div>
                  <h3>External AI processing</h3>
                  <p>
                    Send your current message or recording, destination and
                    limited non-health conversation context to Google Gemini for
                    transcription, travel responses and factual extraction. Your
                    stored health profile is excluded. Provider retention
                    follows its terms.
                  </p>
                  <a
                    className="text-link"
                    href="https://ai.google.dev/gemini-api/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read provider terms
                    <ExternalLink size={14} />
                  </a>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    aria-label="Allow external AI processing"
                    checked={profile.consents.external_ai}
                    disabled={busy}
                    onChange={(e) =>
                      void setConsent("external_ai", e.target.checked)
                    }
                  />
                  <span />
                </label>
              </div>
              <div className="privacy-details">
                <Check size={18} />
                <p>
                  Raw recordings aren’t retained by this app. Location is
                  requested only when needed. We don’t cache health records for
                  offline use.
                </p>
              </div>
              <p className="small muted">
                Revoking consent stops future processing; it does not remove
                earlier records. Delete entries in Journey, conversations in
                Ask, or your account below. Previously sent information is
                subject to provider retention; database backups follow Supabase
                retention settings.
              </p>
              <div className="danger-zone">
                <h3>Remove your information</h3>
                <p>
                  You can remove your optional health profile separately, or
                  delete your account and all associated records.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setEraseHealth(true)}
                >
                  <Trash2 size={16} />
                  Delete health profile
                </Button>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={16} />
                  Delete account
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="eyebrow">OPTIONAL. ALWAYS.</span>
              <h2>A little context, if you’d like.</h2>
              <p className="muted">
                Keep important information together for your own reference.
                Blood group is a reported profile detail, not a basis for health
                predictions.
              </p>
              {!profile.consents.sensitive_storage && (
                <div className="consent-notice">
                  <ShieldCheck size={20} />
                  <p>Choose private storage before saving sensitive details.</p>
                  <Button variant="secondary" onClick={() => setTab("privacy")}>
                    Privacy choices
                  </Button>
                </div>
              )}
              <form className="form-stack profile-form" onSubmit={save}>
                <label>
                  Your name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    placeholder="What should we call you?"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Age range
                    <select
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    >
                      <option value="">Prefer not to say</option>
                      {["18–29", "30–44", "45–59", "60+"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Blood group
                    <select
                      value={blood}
                      onChange={(e) => setBlood(e.target.value)}
                    >
                      <option value="">Unknown / skip</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                <label>
                  Known allergies
                  <input
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Separate with commas, or leave blank"
                  />
                </label>
                <label>
                  Medical conditions
                  <input
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder="Only what you choose to share"
                  />
                </label>
                <label>
                  Current medications
                  <input
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    placeholder="Reported medicines, not treatment recommendations"
                  />
                </label>
                <div className="form-divider">
                  <Phone size={17} />
                  <h3>Someone you trust</h3>
                </div>
                <div className="form-grid">
                  <label>
                    Contact name
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Relationship
                    <input
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      maxLength={80}
                    />
                  </label>
                </div>
                <label>
                  Phone number
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 …"
                    maxLength={25}
                  />
                </label>
                <Button
                  loading={busy}
                  disabled={!profile.consents.sensitive_storage}
                  type="submit"
                >
                  <Check size={18} />
                  Save my choices
                </Button>
                <p className="small muted">
                  You can leave every optional field blank and keep exploring.
                </p>
              </form>
            </>
          )}
        </section>
      </div>
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="This permanently removes your active account and associated records. Infrastructure backups follow provider retention. Previously sent AI data follows provider terms."
      >
        <div className="form-stack">
          <label>
            Type DELETE MY ACCOUNT
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <ErrorBox message={error} />}
          <Button
            variant="danger"
            loading={busy}
            disabled={confirm !== "DELETE MY ACCOUNT"}
            onClick={deleteAccount}
          >
            Delete my account
          </Button>
        </div>
      </Modal>
      <Modal
        open={eraseHealth}
        onOpenChange={setEraseHealth}
        title="Remove your health profile?"
        description="Deletes your profile details and emergency contact. Journey events and conversations remain until you delete them separately."
      >
        <Button variant="danger" loading={busy} onClick={removeHealth}>
          Delete health profile
        </Button>
      </Modal>
    </div>
  );
}
