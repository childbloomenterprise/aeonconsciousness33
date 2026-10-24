// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OfflineJourneyPanel } from "../src/components/OfflineJourneyPanel";
import type { Journey } from "../shared/contracts";
const { state, prepare } = vi.hoisted(() => {
  const prepare = vi.fn();
  return {
    prepare,
    state: {
      online: true,
      preview: false,
      profile: { consents: { sensitive_storage: true } },
      offline: {
        account: null,
        syncing: false,
        prepare,
        sync: vi.fn(),
        remove: vi.fn(),
        resolve: vi.fn(),
      },
    },
  };
});
vi.mock("../src/state", () => ({ useLinc: () => state }));
afterEach(() => {
  cleanup();
  prepare.mockReset();
  state.online = true;
});
const journey = { id: "test-journey" } as Journey;
it("saves journeys automatically without exposing a prepare/download action", () => {
  render(<OfflineJourneyPanel journey={journey} />);
  expect(screen.getByText("Saving to this phone automatically")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /prepare|download/i }),
  ).toBeNull();
  expect(prepare).not.toHaveBeenCalled();
});
it("explains one-time storage consent instead of trip-by-trip preparation", () => {
  state.profile.consents.sensitive_storage = false;
  render(<OfflineJourneyPanel journey={journey} />);
  expect(
    screen.getByText(/enable private storage in profile once/i),
  ).toBeTruthy();
  state.profile.consents.sensitive_storage = true;
});
