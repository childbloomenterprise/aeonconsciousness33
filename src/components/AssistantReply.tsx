import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { ChatResult, Journey } from "../../shared/contracts";
export function AssistantReply({
  result,
  journey,
  reply,
  inlineCare = false,
}: {
  result?: ChatResult;
  journey: Journey | null;
  reply: string;
  inlineCare?: boolean;
}) {
  const health = !!result?.medical_context.contains_health_guidance;
  const guidance = result?.guidance;
  const nearby = (category: string) =>
    "/nearby?category=" +
    category +
    (journey
      ? "&location=" + encodeURIComponent(journey.destination_name)
      : "");
  return (
    <div className="structured-answer">
      <span className="answer-context">
        {journey?.destination_name || "General companion"}
        {health ? " · General health information" : ""}
      </span>
      <p className="answer-primary">{reply}</p>
      {guidance?.immediate_suggestion && (
        <p className="answer-next">
          <strong>Next step</strong>
          <br />
          {guidance.immediate_suggestion}
        </p>
      )}
      {guidance && (
        <details className="answer-details">
          <summary>Why this fits your journey</summary>
          <p>{guidance.reason}</p>
          <p>{guidance.personalised_support}</p>
          {health && <p>{guidance.cause}</p>}
        </details>
      )}
      {health && !inlineCare && (
        <div className="answer-nearby">
          <Link to={nearby("pharmacies")}>
            <MapPin size={15} />
            Search pharmacies
          </Link>
          <Link to={nearby("hospitals")}>
            <MapPin size={15} />
            Search hospitals
          </Link>
          <p className="muted small">
            Confirm your current location on Nearby. Service availability needs
            checking.
          </p>
        </div>
      )}
    </div>
  );
}
