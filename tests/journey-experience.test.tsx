// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { JourneyForm } from "../src/components/QuickJourneyForm";
import { JourneyToday, todaySuggestion } from "../src/components/JourneyToday";
import { Chat } from "../src/pages/Chat";
import { sourceReply } from "../shared/health";
import {
  eventDraft,
  type Journey,
  type JourneyEvent,
} from "../shared/contracts";
const { state, call } = vi.hoisted(() => ({
  call: vi.fn(),
  state: {
    signedIn: true,
    preview: false,
    session: { user: { id: "account-a" } },
    profile: { consents: { sensitive_storage: true } },
    refresh: vi.fn(),
    notify: vi.fn(),
    rememberJourney: vi.fn(),
    selectJourney: vi.fn(),
    setAuthOpen: vi.fn(),
    activeJourney: null,
  },
}));
vi.mock("../src/state", () => ({ useLinc: () => ({ ...state, call }) }));
const trip: Journey = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "account-a",
  title: "Mumbai trip",
  destination_name: "Mumbai",
  started_at: "2026-10-01T00:00:00Z",
  ended_at: null,
  status: "active",
  created_at: "2026-10-01T00:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  state.signedIn = true;
  state.refresh.mockReset();
  state.rememberJourney.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("opens a committed journey with today's default date without waiting for background refresh", async () => {
  const closed = vi.fn();
  state.refresh.mockImplementation(() => new Promise(() => {}));
  call.mockResolvedValue(trip);
  render(<JourneyForm open onClose={closed} />);
  fireEvent.click(screen.getByRole("button", { name: "Mumbai" }));
  fireEvent.click(screen.getByRole("button", { name: "Start my journey" }));
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
  expect(call).toHaveBeenCalledOnce();
  expect(call.mock.calls[0][2].title).toBe("Mumbai trip");
  expect(call.mock.calls[0][2].ended_at).toBeNull();
  expect(state.rememberJourney).toHaveBeenCalledWith(trip);
  expect(state.refresh).not.toHaveBeenCalled();
  expect(localStorage.getItem("linc-journey-draft")).toBeNull();
});
it("prevents duplicate creation while the first request is pending", async () => {
  call.mockImplementation(() => new Promise(() => {}));
  render(<JourneyForm open onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Mumbai" }));
  const submit = screen.getByRole("button", { name: "Start my journey" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(call).toHaveBeenCalledOnce();
});
it("keeps the draft on a failed creation and allows a retry", async () => {
  call
    .mockRejectedValueOnce(new Error("Temporary connection failure"))
    .mockResolvedValue(trip);
  const closed = vi.fn();
  render(<JourneyForm open onClose={closed} />);
  fireEvent.click(screen.getByRole("button", { name: "Mumbai" }));
  fireEvent.click(screen.getByRole("button", { name: "Start my journey" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "connection failure",
  );
  expect(closed).not.toHaveBeenCalled();
  expect(
    JSON.parse(localStorage.getItem("linc-journey-draft")!).destination,
  ).toBe("Mumbai");
  fireEvent.click(screen.getByRole("button", { name: "Start my journey" }));
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
});
it("follows a food suggestion through to reviewed meal capture and scopes dismissal to the journey", () => {
  const food = vi.fn(),
    meal = vi.fn();
  const view = render(
    <JourneyToday
      journey={trip}
      events={[]}
      scope="account-a"
      onFood={food}
      onMeal={meal}
      onCapture={vi.fn()}
      onJourney={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Explore local flavours" }),
  );
  expect(food).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Add my meal" }));
  expect(meal).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", { name: "Dismiss today's suggestion" }),
  );
  view.unmount();
  render(
    <JourneyToday
      journey={trip}
      events={[]}
      scope="account-b"
      onFood={food}
      onMeal={meal}
      onCapture={vi.fn()}
      onJourney={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Explore local flavours" }),
  ).toBeTruthy();
});
it("does not treat unknown-time or another journey's meals as today's meal", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const event = {
    ...eventDraft.parse({
      event_type: "meal",
      title: "Meal",
      occurred_at: null,
    }),
    id: "e",
    user_id: "account-a",
    journey_id: trip.id,
    created_at: now.toISOString(),
    source_message_id: null,
  } as JourneyEvent;
  expect(todaySuggestion(trip, [event], now).kind).toBe("food");
  expect(
    todaySuggestion(
      trip,
      [{ ...event, occurred_at: now.toISOString(), journey_id: "other" }],
      now,
    ).kind,
  ).toBe("food");
  expect(
    todaySuggestion(trip, [{ ...event, occurred_at: now.toISOString() }], now)
      .kind,
  ).toBe("capture");
});
it("lets the next message be composed when the reply is ready even if refresh is slow", async () => {
  state.refresh.mockImplementation(() => new Promise(() => {}));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true }),
  });
  call.mockResolvedValue(sourceReply("I have nausea"));
  render(
    <MemoryRouter>
      <Chat onVoice={vi.fn()} onSOS={vi.fn()} onNew={vi.fn()} />
    </MemoryRouter>,
  );
  const input = screen.getByRole("textbox", { name: "Message LINC-33" });
  fireEvent.change(input, { target: { value: "I have nausea" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(state.refresh).toHaveBeenCalledWith(["events"]));
  fireEvent.change(input, { target: { value: "Another question" } });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Send message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
});
