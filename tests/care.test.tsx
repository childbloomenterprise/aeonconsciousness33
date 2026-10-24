// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CareFinder } from "../src/components/CareFinder";
import { Chat } from "../src/pages/Chat";
import { sourceReply } from "../shared/health";
const { call, state } = vi.hoisted(() => ({
  call: vi.fn(),
  state: {
    signedIn: true,
    preview: false,
    activeJourney: null,
    selectedJourney: null,
    setAuthOpen: vi.fn(),
    refresh: vi.fn(),
    session: null,
  },
}));
vi.mock("../src/state", () => ({ useLinc: () => ({ ...state, call }) }));
vi.mock("../src/components/PlaceMap", () => ({
  PlaceMap: () => <div>In-chat map</div>,
}));
const hospital = {
  id: "hospital-id",
  name: "Example Hospital",
  address: "Test Road, Kochi",
  lat: 10,
  lng: 76,
  phone: "+91 1234567890",
  open_now: true,
  distance_km: 1.2,
  maps_url:
    "https://www.google.com/maps/dir/?api=1&destination=10,76&destination_place_id=hospital-id",
};
const pharmacy = {
  ...hospital,
  id: "pharmacy-id",
  name: "Example Pharmacy",
  phone: undefined,
  open_now: undefined,
};
function mount(urgency: "routine" | "emergency" = "routine") {
  const sos = vi.fn();
  render(<CareFinder destination="Kochi" urgency={urgency} onSOS={sos} />);
  return sos;
}
function search(town = "Kochi") {
  fireEvent.change(screen.getByLabelText("Current town or area"), {
    target: { value: town },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find care" }));
}
beforeEach(() => {
  state.signedIn = true;
  state.preview = false;
  call.mockReset();
  state.setAuthOpen.mockClear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true }),
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("care in the conversation", () => {
  it("waits for a deliberate search and shows hospital and pharmacy details, map and calling", async () => {
    const gps = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: gps },
    });
    call.mockImplementation(async (route: string) =>
      route.includes("hospitals") ? [hospital] : [pharmacy],
    );
    mount();
    expect(call).not.toHaveBeenCalled();
    expect(gps).not.toHaveBeenCalled();
    search();
    await screen.findByText("Example Hospital");
    await screen.findByText("Example Pharmacy");
    expect(screen.getByText("Reported open")).toBeTruthy();
    expect(screen.getByText("Hours unavailable")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Call" }).getAttribute("href"),
    ).toBe("tel:+911234567890");
    expect(
      screen
        .getAllByRole("link", { name: "Directions" })[0]
        .getAttribute("href"),
    ).toContain("destination_place_id=hospital-id");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Show map here" })[0],
    );
    expect(screen.getByText("In-chat map")).toBeTruthy();
    expect(call.mock.calls.map((c) => c[0])).toEqual([
      "nearby?category=hospitals&location=Kochi",
      "nearby?category=pharmacies&location=Kochi",
    ]);
  });
  it("keeps hospital results when the pharmacy request fails", async () => {
    call.mockImplementation(async (route: string) => {
      if (route.includes("pharmacies"))
        throw new Error("Pharmacy provider unavailable");
      return [hospital];
    });
    mount("emergency");
    search();
    await screen.findByText("Example Hospital");
    await screen.findByText("Pharmacy provider unavailable");
    expect(
      screen.getByRole("button", { name: "Emergency calling options" }),
    ).toBeTruthy();
  });
  it("ignores older search results after a location change", async () => {
    const old: ((x: unknown) => void)[] = [];
    call.mockImplementation((route: string) =>
      route.includes("Kochi")
        ? new Promise((resolve) => old.push(resolve))
        : Promise.resolve([{ ...hospital, id: route, name: "Current result" }]),
    );
    mount();
    search();
    search("Munnar");
    await screen.findAllByText("Current result");
    old.forEach((resolve) => resolve([{ ...hospital, name: "Stale result" }]));
    await waitFor(() => expect(screen.queryByText("Stale result")).toBeNull());
  });
  it("keeps manual and Google Maps fallbacks after location denial", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
    });
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Enter your current town",
    );
    expect(
      screen.getByRole("link", { name: "Hospital search in Google Maps" }),
    ).toBeTruthy();
    call.mockResolvedValue([]);
    search();
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
  });
  it("does not transmit coordinates without a location action, and sends no symptom text", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (position: unknown) => void) =>
          ok({
            coords: { latitude: 10, longitude: 76 },
            timestamp: Date.now(),
          }),
      },
    });
    call.mockResolvedValue([]);
    mount();
    expect(call).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        "nearby?category=hospitals&lat=10&lng=76",
      ),
    );
    expect(call.mock.calls.every((c) => c.length === 1)).toBe(true);
  });
  it("preserves emergency access for guests and never invents listings", () => {
    state.signedIn = false;
    const sos = mount("emergency");
    fireEvent.click(
      screen.getByRole("button", { name: "Emergency calling options" }),
    );
    expect(sos).toHaveBeenCalledOnce();
    search();
    expect(state.setAuthOpen).toHaveBeenCalledWith(true);
    expect(call).not.toHaveBeenCalled();
    expect(screen.queryByText("Example Hospital")).toBeNull();
  });
  it("rejects demo places outside development preview", async () => {
    call.mockResolvedValue([{ ...hospital, demo: true }]);
    mount();
    search();
    await screen.findByText(/No hospitals returned/);
    expect(screen.queryByText("Example Hospital")).toBeNull();
  });
  it("handles a plain pharmacy request locally for a signed-out user", async () => {
    state.signedIn = false;
    render(
      <MemoryRouter>
        <Chat onVoice={() => {}} onSOS={() => {}} onNew={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Message LINC-33"), {
      target: { value: "Find a pharmacy near me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByRole("region", { name: "Care near you" });
    expect(state.setAuthOpen).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it("shows emergency guidance and care controls even while another reply is pending", async () => {
    call.mockImplementation(() => new Promise(() => {}));
    const sos = vi.fn();
    render(
      <MemoryRouter>
        <Chat onVoice={() => {}} onSOS={sos} onNew={() => {}} />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText("Message LINC-33");
    fireEvent.change(input, { target: { value: "Plan my trip" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.change(input, { target: { value: "I cannot breathe" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText(/Don.t wait for this conversation\./)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Care near you" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Emergency calling options" }),
    );
    expect(sos).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("describes a facility search without claiming a symptom or medication recommendation", () => {
    const result = sourceReply("Show nearby pharmaceuticals and hospitals");
    expect(result.guidance).toBeUndefined();
    expect(result.reply).toContain("care panel");
    expect(result.medical_context.urgency).toBe("routine");
  });
});
