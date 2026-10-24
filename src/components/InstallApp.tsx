import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, ErrorBox, Modal } from "./ui";
import { prepareOfflineShell } from "../lib/offlineShell";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        display.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
      setOpen(false);
    };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", complete);
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setBusy(true);
    setError("");
    try {
      // Keep the native prompt directly in the tap's user activation.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      if (choice.outcome === "accepted") setOpen(false);
    } catch {
      setPrompt(null);
      setError(
        "The install dialog could not open. Use your browser menu to add LINC-33 to your home screen.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    const setup = async () => {
      try {
        await prepareOfflineShell();
        if (alive) {
          setReady(true);
          setError("");
        }
        await navigator.storage?.persist?.().catch(() => false);
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    };
    void setup();
    window.addEventListener("online", setup);
    navigator.serviceWorker?.addEventListener("controllerchange", setup);
    return () => {
      alive = false;
      window.removeEventListener("online", setup);
      navigator.serviceWorker?.removeEventListener("controllerchange", setup);
    };
  }, []);

  return (
    <>
      {!installed && (
        <button
          className="install-app-button"
          aria-label="Add LINC-33 to home screen"
          onClick={() => setOpen(true)}
        >
          <Smartphone size={19} />
          <span>Install app</span>
        </button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Your journey, one tap away."
        description="Add LINC-33 to your home screen for a travel companion that opens in its own app window."
      >
        <div className="install-app-content">
          {prompt ? (
            <Button loading={busy} onClick={() => void install()}>
              <Download size={18} />
              Add to home screen
            </Button>
          ) : (
            <ol>
              {ios ? (
                <>
                  <li>Open this page in Safari.</li>
                  <li>
                    Tap Share, then Add to Home Screen. You may need to scroll
                    down.
                  </li>
                  <li>Keep Open as Web App enabled if shown, then tap Add.</li>
                </>
              ) : (
                <>
                  <li>Open your browser menu.</li>
                  <li>
                    Choose Install app or Add to Home screen, then confirm.
                  </li>
                  <li>
                    If this option is missing, open LINC-33 in Chrome, Edge or
                    Safari.
                  </li>
                </>
              )}
            </ol>
          )}
          <h3>Runs on your phone</h3>
          <p>
            The app saves its screens automatically. Once private storage is
            enabled, your journeys, entries and conversation history are kept on
            this phone and updated when connected. There is nothing to prepare
            trip by trip.
          </p>
          <p role="status">
            {ready
              ? "App files saved on this device automatically."
              : "Saving app files to this phone… Keep the app open while initial setup finishes."}
          </p>
          {error && <ErrorBox message={error} />}
          <Link
            to="/journey"
            className="text-link"
            onClick={() => setOpen(false)}
          >
            Open journeys
          </Link>
          <p className="small muted">
            After initial online setup, the app opens from this phone. Text logs
            save locally first and sync while the app is open and connected. AI,
            live maps, nearby search, photo analysis and voice transcription
            need internet. First sign-in, creating journeys and account changes
            also need a connection. Signing out removes local account data; your
            browser or device can also clear its storage.
          </p>
        </div>
      </Modal>
    </>
  );
}
