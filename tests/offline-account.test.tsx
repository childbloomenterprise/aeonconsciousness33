// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const fixtures = vi.hoisted(() => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const profile = {
    display_name: "Test",
    profile: null,
    consents: { sensitive_storage: true, external_ai: false },
    signup: { onboarded: true },
  };
  const state = { marker: owner as string | null, sessionId: second };
  const clear = vi.fn(async () => {});
  const request = vi.fn(async (route: string) =>
    route === "health-context" ? profile : [],
  );
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: { user: { id: state.sessionId } } },
    })),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signOut: vi.fn(async () => {}),
  };
  return { owner, second, state, clear, request, auth, profile };
});
vi.mock("../src/lib/client", () => ({
  supabase: { auth: fixtures.auth },
  request: fixtures.request,
}));
vi.mock("../src/lib/offline", () => ({
  readOfflineOwner: () => fixtures.state.marker,
  rememberOfflineOwner: (id: string | null) => {
    fixtures.state.marker = id;
  },
  offlineChanged: "linc33-offline-changed",
  networkFailure: (error: unknown) => error instanceof TypeError,
  offlineJourneys: {
    clear: fixtures.clear,
    reconcile: vi.fn(),
    read: vi.fn(async () => ({
      id: fixtures.owner,
      profile: fixtures.profile,
      bundles: {},
      queue: [],
    })),
    journeys: async () => [],
  },
}));
import { LincProvider, useLinc } from "../src/state";
function Account() {
  const state = useLinc();
  return (
    <>
      <p>{state.session?.user.id || "No live session"}</p>
      <button onClick={() => void state.signOut()}>Sign out</button>
    </>
  );
}
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <LincProvider>
        <Account />
      </LincProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.state.marker = fixtures.owner;
  fixtures.state.sessionId = fixtures.second;
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("clears a different remembered account on cold session restoration", async () => {
  mount();
  await screen.findByText(fixtures.second);
  await waitFor(() =>
    expect(fixtures.clear).toHaveBeenCalledWith(fixtures.owner),
  );
  expect(fixtures.state.marker).toBeNull();
});
it("signout clears both the active account and a stale remembered account marker", async () => {
  fixtures.state.sessionId = fixtures.owner;
  mount();
  await screen.findByText(fixtures.owner);
  fixtures.state.marker = fixtures.second;
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    expect(fixtures.clear).toHaveBeenCalledWith(fixtures.second),
  );
  expect(fixtures.clear).toHaveBeenCalledWith(fixtures.owner);
  expect(fixtures.state.marker).toBeNull();
});
