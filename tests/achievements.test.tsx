// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
const fixture = vi.hoisted(() => ({
  signedIn: true,
  loginCelebration: 1,
  profile: { display_name: "V" },
  journeys: [] as { id: string; destination_name: string }[],
  events: [] as { journey_id: string }[],
  selectedJourney: null as null | { id: string },
  authOpen: false,
  onboardingOpen: false,
  recovery: false,
  busy: false,
  session: { user: { id: "one" } },
}));
vi.mock("../src/state", () => ({ useLinc: () => fixture }));
import { Achievements } from "../src/components/Achievements";
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(fixture, {
    signedIn: true,
    loginCelebration: 1,
    journeys: [],
    events: [],
    selectedJourney: null,
    authOpen: false,
    onboardingOpen: false,
    recovery: false,
    busy: false,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("celebrates once, opens interactive badges, and does not replay on rerender", () => {
  const view = render(<Achievements />);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByText("You're on board, V!")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View achievements" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "A new horizon: locked" }),
  );
  expect(
    screen.getByText("Create your first journey to unlock this achievement."),
  ).toBeTruthy();
  view.rerender(<Achievements />);
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
});
it("waits for onboarding and suppresses guest and recovery celebrations", () => {
  fixture.onboardingOpen = true;
  const view = render(<Achievements />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
  fixture.onboardingOpen = false;
  view.rerender(<Achievements />);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByLabelText("Sign-in celebration")).toBeTruthy();
  fixture.signedIn = false;
  view.rerender(<Achievements />);
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
});
it("uses actual journey progress and keeps all milestones keyboard accessible", () => {
  fixture.loginCelebration = 0;
  fixture.journeys = [
    { id: "trip", destination_name: "Dubai" },
    { id: "other", destination_name: "Mumbai" },
  ];
  fixture.selectedJourney = { id: "trip" };
  fixture.events = [
    { journey_id: "trip" },
    { journey_id: "trip" },
    { journey_id: "trip" },
  ];
  render(<Achievements />);
  fireEvent.click(
    screen.getByRole("button", { name: "Achievements: 5 of 5 unlocked" }),
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("5");
  expect(
    screen.getByRole("button", { name: "A story taking shape: unlocked" }),
  ).toBeTruthy();
});
it("does not celebrate a restored session and auto-dismisses a fresh sign-in", () => {
  fixture.loginCelebration = 0;
  const view = render(<Achievements />);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
  fixture.loginCelebration = 1;
  view.rerender(<Achievements />);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByLabelText("Sign-in celebration")).toBeTruthy();
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
});

it("waits for account data and keeps the celebration out of recovery dialogs", () => {
  fixture.busy = true;
  const view = render(<Achievements />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
  fixture.busy = false;
  view.rerender(<Achievements />);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByLabelText("Sign-in celebration")).toBeTruthy();
  fixture.recovery = true;
  view.rerender(<Achievements />);
  expect(screen.queryByLabelText("Sign-in celebration")).toBeNull();
});
