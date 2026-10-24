import { useEffect, useRef, useState } from "react";
import { Mic, Square, LoaderCircle, ArrowRight } from "lucide-react";
import { useLinc } from "../state";
import { Button, Modal, ErrorBox } from "./ui";

export function Voice({
  open,
  onClose,
  onTranscript,
  mode = "conversation",
}: {
  open: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
  mode?: "conversation" | "meal";
}) {
  const { call, profile, signedIn, preview, setAuthOpen } = useLinc();
  const [state, setState] = useState<
    "idle" | "recording" | "processing" | "review"
  >("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState<{ language?: string; original?: string }>(
    {},
  );
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const cleanup = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    cancelAnimationFrame(frame.current);
    void audio.current?.close();
    audio.current = null;
    setLevel(0);
  };
  useEffect(() => {
    if (!open) {
      cancelled.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
      setState("idle");
      setSeconds(0);
      setText("");
      setHeard({});
      setError("");
    }
    return () => {
      cancelled.current = true;
    };
  }, [open]);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(frame.current);
      void audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);
  useEffect(() => {
    if (seconds >= 30 && recorder.current?.state === "recording")
      recorder.current.stop();
  }, [seconds]);
  async function start() {
    if (!signedIn) {
      onClose();
      setAuthOpen(true);
      return;
    }
    if (!profile.consents.external_ai) {
      setError(
        "Enable external AI processing in Profile before recording. You can still type.",
      );
      return;
    }
    if (preview) {
      setError(
        "Real transcription needs a connected voice service. This preview lets you explore the recording interface, but does not simulate speech results.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Voice recording is unavailable in this browser. Please type instead.",
      );
      return;
    }
    try {
      cancelled.current = false;
      setSeconds(0);
      chunks.current = [];
      const status = await call<{ private_ai: boolean; voice_ai?: boolean }>(
        "status",
      );
      if (!(status.voice_ai ?? status.private_ai))
        throw new Error(
          "Voice transcription is awaiting provider privacy setup. Please type or add an entry manually.",
        );
      if (cancelled.current) return;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((x) => MediaRecorder.isTypeSupported(x));
      if (!mime)
        throw new Error(
          "Your recording format is unsupported. Please use text.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (cancelled.current) {
        cleanup();
        return;
      }
      const rec = new MediaRecorder(stream.current, {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      });
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        cleanup();
        if (cancelled.current) {
          chunks.current = [];
          return;
        }
        setState("processing");
        try {
          const blob = new Blob(chunks.current, { type: mime });
          if (blob.size > 3 * 1024 * 1024)
            throw new Error(
              "Recording is too large. Try a shorter voice message.",
            );
          const data = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          const result = await call<{
            text: string;
            original?: string;
            language?: string;
          }>("transcribe", "POST", {
            data,
            mime,
          });
          if (cancelled.current) return;
          setText(result.text);
          setHeard({ language: result.language, original: result.original });
          setState("review");
          setError("");
        } catch (err) {
          if (cancelled.current) return;
          setError((err as Error).message);
          setState("idle");
        } finally {
          chunks.current = [];
        }
      };
      audio.current = new AudioContext();
      const source = audio.current.createMediaStreamSource(stream.current);
      const analyser = audio.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const values = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(values);
        setLevel(values.reduce((a, b) => a + b, 0) / values.length / 255);
        frame.current = requestAnimationFrame(update);
      };
      update();
      rec.start(500);
      setState("recording");
    } catch (err) {
      cleanup();
      setError(
        (err as Error).name === "NotAllowedError"
          ? "Microphone access was denied. You can type instead."
          : (err as Error).message,
      );
      setState("idle");
    }
  }
  const translated =
    !!heard.language &&
    !!heard.original &&
    !/^english$/i.test(heard.language.trim());
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={
        mode === "meal"
          ? "Your food diary, by voice"
          : "A little conversation goes a long way"
      }
      description={
        mode === "meal"
          ? "Say what you ate in Malayalam, Hindi, Tamil or English. Review the English transcript, then choose what to save. Audio goes to the configured AI provider for transcription and is discarded locally. Nothing is saved until you press Save entry."
          : "Speak naturally in Malayalam, Hindi, Tamil or English. We translate it into English for you to review before sending. This app discards its local recording."
      }
    >
      <div className="voice-view">
        {state === "review" ? (
          <>
            {translated ? (
              <p className="voice-translation" role="status">
                <strong>Heard in {heard.language}.</strong> Showing the English
                translation — edit it if anything is off.
                <span className="heard-original">{heard.original}</span>
              </p>
            ) : null}
            <label className="full-width">
              {mode === "meal" ? "Foods you ate" : "Your words"}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
              />
            </label>
            <Button
              disabled={!text.trim()}
              onClick={() => {
                onTranscript(
                  mode === "meal" ? `Meal report: ${text.trim()}` : text.trim(),
                );
                onClose();
              }}
            >
              {mode === "meal" ? "Review entry" : "Review message"}
              <ArrowRight size={18} />
            </Button>
          </>
        ) : (
          <>
            <div
              className={`voice-orbit ${state}`}
              style={{ "--voice-level": level } as React.CSSProperties}
            >
              <button
                className="voice-main"
                aria-label={
                  state === "recording" ? "Stop recording" : "Start recording"
                }
                disabled={state === "processing"}
                onClick={
                  state === "recording" ? () => recorder.current?.stop() : start
                }
              >
                {state === "processing" ? (
                  <LoaderCircle className="spin" size={38} />
                ) : state === "recording" ? (
                  <Square size={32} />
                ) : (
                  <Mic size={38} />
                )}
              </button>
            </div>
            <h3>
              {state === "recording"
                ? "I’m listening."
                : state === "processing"
                  ? "Finding your words…"
                  : mode === "meal"
                    ? "What did you eat?"
                    : "What’s on your mind?"}
            </h3>
            <p className="muted">
              {state === "recording"
                ? `${seconds.toString().padStart(2, "0")} / 30 seconds`
                : "Tap the microphone when you’re ready."}
            </p>
            <div className="voice-examples">
              <span>“I had appam for breakfast.”</span>
              <span>
                {mode === "meal"
                  ? "“For lunch, rice and fish curry around noon.”"
                  : "“Find a pharmacy near me.”"}
              </span>
              <span>“ഇന്ന് രാവിലെ ഇഡ്ഡലി കഴിച്ചു”</span>
            </div>
          </>
        )}
        {error && <ErrorBox message={error} />}
        <Button
          variant="ghost"
          onClick={() => {
            cancelled.current = true;
            if (recorder.current?.state === "recording")
              recorder.current.stop();
            cleanup();
            setError("");
            setHeard({});
            setState("review");
          }}
        >
          {mode === "meal" ? "Type my foods instead" : "Use text instead"}
        </Button>
      </div>
    </Modal>
  );
}
