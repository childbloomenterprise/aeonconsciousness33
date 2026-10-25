import { preparePhoto } from "../lib/photo";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ScanLine } from "lucide-react";
import { photoResult } from "../../shared/contracts";
import { useLinc } from "../state";
import { Button, ErrorBox, Modal } from "./ui";

export function PhotoCapture({
  open,
  onClose,
  onTranscript,
}: {
  open: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}) {
  const {
    call,
    signedIn,
    profile,
    setAuthOpen,
    preview: designPreview,
  } = useLinc();
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [text, setText] = useState(""),
    [uncertainty, setUncertainty] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [eaten, setEaten] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!open) {
      generation.current++;
      setFile(null);
      setText("");
      setError("");
      setUncertainty("");
      setEaten(false);
      setBusy(false);
    }
  }, [open]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function analyze() {
    if (designPreview) {
      setError(
        "Photo AI needs a connected account outside design preview. You can type a description below.",
      );
      return;
    }
    if (!signedIn) {
      onClose();
      setAuthOpen(true);
      return;
    }
    if (!profile.consents.external_ai) {
      setError(
        "Enable external AI processing in Profile before analysing a photo.",
      );
      return;
    }
    if (!file) return;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () =>
          reject(new Error("The photo could not be read."));
        reader.readAsDataURL(file);
      });
      const data = photoResult.parse(
        await call("photo", "POST", { image, mime: file.type }),
      );
      if (current !== generation.current) return;
      setText(data.text);
      setUncertainty(data.uncertainty);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="A moment, in a photo."
      description="Photograph a meal or travel moment. Review the description before adding it to your journey."
    >
      <div className="form-stack photo-capture">
        <label className="photo-drop">
          <ImagePlus size={28} />
          <span>
            {file ? "Choose a different photo" : "Take a photo or choose one"}
          </span>
          <input
            aria-label="Choose a meal or travel photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const chosen = e.target.files?.[0];
              const current = ++generation.current;
              setFile(null);
              setText("");
              setError("");
              setUncertainty("");
              setEaten(false);
              if (!chosen) return;
              setBusy(true);
              try {
                const prepared = await preparePhoto(chosen);
                if (current === generation.current) setFile(prepared);
              } catch (error) {
                if (current === generation.current)
                  setError((error as Error).message);
              } finally {
                if (current === generation.current) setBusy(false);
              }
            }}
          />
        </label>
        {preview && (
          <img
            className="photo-preview"
            src={preview}
            alt="Photo selected for review"
          />
        )}
        {busy && !file && (
          <p role="status">Preparing a smaller photo on this device.</p>
        )}
        {error && <ErrorBox message={error} />}
        <Button onClick={analyze} disabled={!file || busy} loading={busy}>
          <ScanLine size={18} />
          Describe this photo
        </Button>
        <label>
          Review or type the description
          <textarea
            aria-label="Photo description"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="You can also describe the photo yourself."
          />
        </label>
        {uncertainty && <p className="muted small">{uncertainty}</p>}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={eaten}
            onChange={(e) => setEaten(e.target.checked)}
          />
          I ate this meal and want to report it.
        </label>
        <Button
          disabled={!text.trim() || busy}
          onClick={() => {
            onTranscript(
              `${eaten ? "Meal I ate (photo reviewed)" : "Photo description (reviewed)"}: ${text.trim()}`,
            );
            onClose();
          }}
        >
          <Camera size={17} />
          Review entry
        </Button>
        <p className="muted small">
          Photos are sent to Gemini only when you choose Describe. The image is
          not stored. Only text you review and send can be saved with
          private-storage consent. Ingredients and allergens cannot be verified
          from a photo.
        </p>
      </div>
    </Modal>
  );
}
