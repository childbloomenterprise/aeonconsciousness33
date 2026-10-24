// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
const fixtures = vi.hoisted(() => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const journey = {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: owner,
    status: "active",
    destination_name: "Dubai",
    title: "Restored offline journey",
  };
  const profile = {
    display_name: "Offline traveller",
    profile: null,
    consents: { sensitive_storage: true, external_ai: false },
  };
  const events = [
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Saved breakfast",
      journey_id: journey.id,
      user_id: owner,
    },
  ];
  return {
    owner,
    journey,
    profile,
    events,
    request: vi.fn(),
    read: vi.fn(async () => ({
      id: owner,
      profile,
      bundles: {
        [journey.id]: { journey, events, savedAt: "2026-10-23T08:00:00Z" },
      },
      queue: [],
    })),
  };
});
vi.mock("../src/lib/client", () => ({
  supabase: null,
  request: fixtures.request,
}));
vi.mock("../src/lib/offline", () => ({
  readOfflineOwner: () => fixtures.owner,
  rememberOfflineOwner: vi.fn(),
  offlineChanged: "linc33-offline-changed",
  networkFailure: (error: unknown) => error instanceof TypeError,
  offlineJourneys: {
    read: fixtures.read,
    journeys: async () => [fixtures.journey],
    events: async () => fixtures.events,
  },
}));
import { LincProvider, useLinc } from "../src/state";
function Contents() {
  const state = useLinc();
  return (
    <>
      <p>{state.signedIn ? "Offline account restored" : "Guest"}</p>
      {state.journeys.map((journey) => (
        <h1 key={journey.id}>{journey.title}</h1>
      ))}
      {state.events.map((entry) => (
        <p key={entry.id}>{entry.title}</p>
      ))}
    </>
  );
}
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
it("loads the saved journey and entries even when React Query's network manager is offline", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  onlineManager.setOnline(false);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LincProvider>
        <Contents />
      </LincProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Restored offline journey")).toBeTruthy();
  expect(await screen.findByText("Saved breakfast")).toBeTruthy();
  expect(screen.getByText("Offline account restored")).toBeTruthy();
  expect(fixtures.request).not.toHaveBeenCalled();
});
