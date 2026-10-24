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
import { EntryCapture } from "../src/components/EntryCapture";
import { JourneyForm } from "../src/components/JourneyForms";
const { call, state } = vi.hoisted(() => ({
  call: vi.fn(),
  state: {
    signedIn: true,
    preview: false,
    session: { user: { id: "account-a" } },
    selectedJourney: {
      id: "22222222-2222-4222-8222-222222222222",
      destination_name: "Dubai",
    },
    activeJourney: {
      id: "33333333-3333-4333-8333-333333333333",
      destination_name: "Munnar",
    },
    profile: { consents: { sensitive_storage: true, external_ai: false } },
    refresh: vi.fn(),
    notify: vi.fn(),
    setAuthOpen: vi.fn(),
    selectJourney: vi.fn(),
  },
}));
vi.mock("../src/state", () => ({ useLinc: () => ({ ...state, call }) }));
beforeEach(() => {
  call.mockReset();
  sessionStorage.clear();
  localStorage.clear();
  state.signedIn = true;
  state.profile.consents.sensitive_storage = true;
});
afterEach(cleanup);
function capture(text = "Lunch at the market") {
  return render(
    <MemoryRouter>
      <EntryCapture
        open
        onClose={vi.fn()}
        onPhoto={vi.fn()}
        onVoice={vi.fn()}
        initialText={text}
        initialType="meal"
      />
    </MemoryRouter>,
  );
}
it("reviews before saving, and targets the selected journey even if another is active", async () => {
  call.mockResolvedValue({ id: "saved" });
  capture();
  expect(call).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
  expect(call.mock.calls[0][0]).toBe("events");
  expect(call.mock.calls[0][2].journey_id).toBe(state.selectedJourney.id);
  expect(call.mock.calls[0][2].event.event_type).toBe("meal");
});
it("retains corrections and reuses the request id after a failed save", async () => {
  call
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce({ id: "saved" });
  capture();
  fireEvent.change(screen.getByRole("textbox", { name: "What happened?" }), {
    target: { value: "Corrected lunch" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  await screen.findByRole("alert");
  expect(
    (
      screen.getByRole("textbox", {
        name: "What happened?",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Corrected lunch");
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
  expect(call.mock.calls[0][2].request_id).toBe(
    call.mock.calls[1][2].request_id,
  );
});
it("does not use AI or save without private storage consent", async () => {
  state.profile.consents.sensitive_storage = false;
  capture();
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Enable private storage",
  );
  expect(call).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});
it("restores an unfinished draft after remount in the same account and journey", async () => {
  const view = capture("");
  fireEvent.change(screen.getByRole("textbox", { name: "What happened?" }), {
    target: { value: "A long walk" },
  });
  view.unmount();
  capture("");
  expect(
    (
      screen.getByRole("textbox", {
        name: "What happened?",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("A long walk");
});
it("does not restore another journey's unfinished draft", () => {
  sessionStorage.setItem(
    "linc-entry-draft:account-a:other-trip",
    JSON.stringify({ text: "Other trip private note" }),
  );
  capture("");
  expect(
    (
      screen.getByRole("textbox", {
        name: "What happened?",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("");
});
it("keeps a destination choice before asking a guest to sign in", () => {
  state.signedIn = false;
  render(
    <MemoryRouter>
      <JourneyForm open onClose={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.change(
    screen.getByPlaceholderText("Dubai, Mumbai, a waterfall, or anywhere else"),
    { target: { value: "Dubai" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue to sign in" }));
  expect(
    JSON.parse(localStorage.getItem("linc-journey-draft")!).destination,
  ).toBe("Dubai");
  expect(localStorage.getItem("linc-pending-journey")).toBe("1");
  expect(state.setAuthOpen).toHaveBeenCalled();
  expect(call).not.toHaveBeenCalled();
});
