// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Nearby } from "../src/pages/Nearby";
import { Voice } from "../src/components/Voice";
import { Chat } from "../src/pages/Chat";
import { StrictMode } from "react";
import { sourceReply } from "../shared/health";
const { call, state } = vi.hoisted(() => ({
  call: vi.fn(),
  state: {
    signedIn: true,
    preview: false,
    activeJourney: { destination_name: "Munnar" },
    profile: { consents: { external_ai: true } },
    setAuthOpen: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock("../src/state", () => ({ useLinc: () => ({ ...state, call }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  call.mockReset();
  state.preview = false;
  state.signedIn = true;
  state.profile.consents.external_ai = true;
  vi.restoreAllMocks();
});
describe("permission and honest fallback interactions", () => {
  it("keeps guest health conversations out of persistent browser storage", async () => {
    state.signedIn = false;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/chat",
            state: { send: "I have nausea (synthetic test)" },
          },
        ]}
      >
        <Chat onVoice={() => {}} onSOS={() => {}} onNew={() => {}} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/This guest conversation stays in memory/),
      ).toBeTruthy(),
    );
    expect(storage).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it("food voice mode offers an editable meal report without claiming it saved", () => {
    const sent = vi.fn();
    render(<Voice open mode="meal" onClose={() => {}} onTranscript={sent} />);
    expect(
      screen.getByRole("heading", { name: "Your food diary, by voice" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Type my foods instead" }),
    );
    const send = screen.getByRole("button", { name: "Review entry" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Foods you ate" }), {
      target: {
        value: "I ate appam for breakfast and rice for lunch yesterday.",
      },
    });
    fireEvent.click(send);
    expect(sent).toHaveBeenCalledWith(
      "Meal report: I ate appam for breakfast and rice for lunch yesterday.",
    );
    expect(screen.queryByText("Saved")).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });
  it("preserves the first user message through StrictMode and sends once", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const text = "I have nausea (synthetic test)";
    call.mockResolvedValue(sourceReply(text));
    render(
      <StrictMode>
        <MemoryRouter
          initialEntries={[{ pathname: "/chat", state: { send: text } }]}
        >
          <Chat onVoice={() => {}} onSOS={() => {}} onNew={() => {}} />
        </MemoryRouter>
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByText(text)).toBeTruthy());
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("location denial retains manual destination search", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
    });
    render(
      <MemoryRouter>
        <Nearby />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a town");
    fireEvent.change(screen.getByRole("textbox", { name: "Search location" }), {
      target: { value: "Kochi" },
    });
    call.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        "nearby?category=hospitals&location=Kochi",
      ),
    );
  });
  it("missing nearby provider never displays a fake hospital", async () => {
    call.mockRejectedValue(new Error("Nearby search is not connected yet."));
    render(
      <MemoryRouter>
        <Nearby />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("not connected"),
    );
    expect(screen.queryByText("Government Hospital Munnar")).toBeNull();
  });
  it("voice consent denial happens before microphone access", () => {
    state.profile.consents.external_ai = false;
    const mic = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: mic },
    });
    render(<Voice open onClose={() => {}} onTranscript={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Enable external AI",
    );
    expect(mic).not.toHaveBeenCalled();
  });
  it("an unsupported browser offers text instead", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    render(<Voice open onClose={() => {}} onTranscript={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Please type instead",
    );
    expect(
      screen.getByRole("button", { name: "Use text instead" }),
    ).toBeTruthy();
  });
});
