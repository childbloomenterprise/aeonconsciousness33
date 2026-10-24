import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "./ui/calendar";
const Calendar = lazy(() =>
  import("./ui/calendar").then((m) => ({ default: m.Calendar })),
);
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="date-picker" ref={root}>
      <button
        type="button"
        className="date-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarDays size={16} />
        {value ? format(parseISO(value), "EEE, MMM d, yyyy") : placeholder}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="date-picker-pop"
        >
          <Suspense fallback={<p role="status">Loading dates…</p>}>
            <Calendar
              selected={value ? parseISO(value) : undefined}
              defaultMonth={value ? parseISO(value) : new Date()}
              disabled={(d) =>
                (!!min && format(d, "yyyy-MM-dd") < min) ||
                (!!max && format(d, "yyyy-MM-dd") > max)
              }
              onSelect={(d) => {
                if (d) {
                  onChange(format(d, "yyyy-MM-dd"));
                  setOpen(false);
                }
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

export function JourneyDateRangePicker({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const selected: DateRange = {
    from: start ? parseISO(start) : undefined,
    to: end ? parseISO(end) : undefined,
  };
  const compact = (value: string) =>
    value ? format(parseISO(value), "MMM d, yyyy") : "Open ended";

  return (
    <div className="journey-range-picker" ref={root}>
      <button
        type="button"
        className="journey-range-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarDays size={18} />
        <span>
          <small>Departure</small>
          <strong>{compact(start)}</strong>
        </span>
        <i aria-hidden="true" />
        <span>
          <small>Return</small>
          <strong>{compact(end)}</strong>
        </span>
      </button>
      <p className="muted small">
        Tap once for departure, then again for return.
      </p>
      {open && (
        <div
          role="dialog"
          aria-label="Choose journey dates"
          className="journey-range-pop"
        >
          <Suspense fallback={<p role="status">Loading dates.</p>}>
            <Calendar
              mode="range"
              selected={selected}
              defaultMonth={selected.from || new Date()}
              onSelect={(range) => {
                onStartChange(
                  range?.from ? format(range.from, "yyyy-MM-dd") : "",
                );
                onEndChange(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                if (range?.from && range.to) setOpen(false);
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
