import { useState } from "react";
import { CloudCheck, Download, RefreshCw, WifiOff } from "lucide-react";
import type { Journey } from "../../shared/contracts";
import { useLinc } from "../state";
import { Button, ErrorBox } from "./ui";
import "./offline-journey.css";

export function OfflineJourneyPanel({ journey }: { journey: Journey | null }) {
  const { offline, online, preview, profile } = useLinc();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  if (!journey || !offline || preview) return null;
  const bundle = offline.account?.bundles[journey.id];
  const queue =
    offline.account?.queue.filter((item) => item.journeyId === journey.id) ||
    [];
  async function act(action: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="offline-journey" aria-label="Journey offline access">
      <div className="offline-journey-heading">
        <span className="offline-journey-icon">
          {bundle ? <CloudCheck size={21} /> : <Download size={21} />}
        </span>
        <div>
          <h2>
            {bundle
              ? "Stored on this phone"
              : "Saving to this phone automatically"}
          </h2>
          <p>
            {bundle
              ? `${bundle.events.length} saved entries · Updated ${new Date(bundle.savedAt).toLocaleString()}`
              : "Your journeys and entries are saved automatically when connected. No preparation is needed."}
          </p>
        </div>
      </div>
      <p className="offline-journey-detail">
        {bundle
          ? "Opens from your local copy. Text logs save here first and sync when connected. AI, live maps, nearby search, photo analysis and voice transcription need internet."
          : "Keep the app open while initial setup finishes. Use your own device; signing out removes local copies and unsynced entries."}
      </p>
      {!profile.consents.sensitive_storage && (
        <p className="small">
          Enable private storage in Profile once to keep your account data on
          this phone automatically.
        </p>
      )}
      {bundle && (
        <div
          className="offline-journey-status"
          role="status"
          aria-live="polite"
        >
          {!online && (
            <>
              <WifiOff size={15} />
              <span>Using your saved journey.</span>
            </>
          )}
          <span>
            {offline.syncing
              ? "Syncing your entries…"
              : queue.length
                ? `${queue.length} ${queue.length === 1 ? "entry" : "entries"} saved on this device, waiting to sync`
                : "No pending entries"}
          </span>
          {queue.length > 0 && (
            <Button
              variant="ghost"
              disabled={!online || working}
              loading={offline.syncing}
              onClick={() => void act(offline.sync)}
            >
              <RefreshCw size={15} /> Sync now
            </Button>
          )}
        </div>
      )}
      {queue
        .filter((item) => item.state !== "pending")
        .map((item) => {
          const server = bundle?.events.find(
            (event) => event.id === item.eventId,
          );
          return (
            <div className="offline-entry-issue" key={item.id}>
              <strong>
                {item.state === "conflict"
                  ? "Review a changed entry"
                  : "An entry needs attention"}
              </strong>
              <p>{item.error}</p>
              <p>
                <b>Your device:</b> {item.event.title}
                {item.event.description ? ` — ${item.event.description}` : ""}
              </p>
              {server && (
                <p>
                  <b>Saved account version:</b> {server.title}
                  {server.description ? ` — ${server.description}` : ""}
                </p>
              )}
              <div className="offline-issue-actions">
                <Button
                  variant="secondary"
                  disabled={!online || working}
                  onClick={() => void act(() => offline.resolve(item, "copy"))}
                >
                  Save mine as a separate entry
                </Button>
                <Button
                  variant="ghost"
                  disabled={!online || working}
                  onClick={() =>
                    void act(() => offline.resolve(item, "server"))
                  }
                >
                  Use account version
                </Button>
              </div>
            </div>
          );
        })}
      {offline.deviceSyncing && (
        <p role="status">Updating your local app data…</p>
      )}
      {offline.deviceError && (
        <ErrorBox
          message={offline.deviceError}
          retry={() => void act(offline.sync)}
        />
      )}
      {error && <ErrorBox message={error} />}
    </section>
  );
}
