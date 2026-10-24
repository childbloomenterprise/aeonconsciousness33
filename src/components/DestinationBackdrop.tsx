import { Mountain } from "lucide-react";
import { cn } from "../lib/utils";
import { destinationVisual } from "../lib/destinationVisual";

/** Renders a destination's photo when one exists, else a toned gradient. */
export function DestinationBackdrop({
  destination,
  className,
}: {
  destination?: string | null;
  className?: string;
}) {
  const visual = destinationVisual(destination);
  if (visual.photo)
    return (
      <img
        className={cn("destination-backdrop", className)}
        src={visual.photo}
        alt={visual.alt}
        fetchPriority="high"
      />
    );
  return (
    <div
      className={cn(
        "destination-backdrop",
        "destination-backdrop-gradient",
        className,
      )}
      style={{ background: visual.gradient }}
      role="img"
      aria-label={visual.alt}
    >
      <Mountain size={28} className="destination-backdrop-icon" />
    </div>
  );
}
