// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "../src/pages/Home";
const { state } = vi.hoisted(() => ({
  state: {
    journeys: [],
    selectedJourney: {
      id: "trip-a",
      destination_name: "Munnar",
      started_at: "2026-10-16T00:00:00Z",
      status: "active",
    },
    activeJourney: null,
    selectJourney: vi.fn(),
    events: [
      {
        id: "meal-a",
        journey_id: "trip-a",
        event_type: "meal",
        title: "My breakfast",
        description: "A reported meal",
        occurred_at: "2026-10-16T08:00:00Z",
        created_at: "2026-10-16T08:00:00Z",
      },
      {
        id: "walk-a",
        journey_id: "trip-a",
        event_type: "activity",
        title: "Tea garden walk",
        description: null,
        occurred_at: "2026-10-16T09:00:00Z",
        created_at: "2026-10-16T09:00:00Z",
      },
      {
        id: "meal-b",
        journey_id: "trip-b",
        event_type: "meal",
        title: "Other journey meal",
        description: null,
        occurred_at: "2026-10-16T09:00:00Z",
        created_at: "2026-10-16T09:00:00Z",
      },
    ],
    profile: {
      display_name: "Alex",
      consents: { external_ai: false, sensitive_storage: false },
    },
    signedIn: true,
    setAuthOpen: vi.fn(),
    refresh: vi.fn(),
    busy: false,
    dataError: null,
  },
}));
vi.mock("../src/state", () => ({ useLinc: () => state }));
vi.mock("../src/components/DatePicker", () => ({
  DatePicker: () => <button>Any day</button>,
}));
afterEach(cleanup);
it("keeps the feed inside its selected journey and filters food entries", () => {
  render(
    <MemoryRouter>
      <Home
        onNew={vi.fn()}
        onVoice={vi.fn()}
        onVoiceMeal={vi.fn()}
        onMeal={vi.fn()}
        onFood={vi.fn()}
        onPhoto={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("My breakfast")).toBeTruthy();
  expect(screen.getByText("Tea garden walk")).toBeTruthy();
  expect(screen.queryByText("Other journey meal")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Food" }));
  expect(screen.queryByText("Tea garden walk")).toBeNull();
  expect(screen.getByText("My breakfast")).toBeTruthy();
});
it("offers working photo, voice and typed-entry controls", () => {
  const photo = vi.fn(),
    voice = vi.fn();
  render(
    <MemoryRouter>
      <Home
        onNew={vi.fn()}
        onVoice={voice}
        onVoiceMeal={vi.fn()}
        onMeal={vi.fn()}
        onFood={vi.fn()}
        onPhoto={photo}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Add a photo" })[0]);
  expect(photo).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Record a voice entry" }));
  expect(voice).toHaveBeenCalledTimes(1);
  expect(
    (
      screen.getByRole("button", {
        name: "Review message",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
