// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstallApp } from "../src/components/InstallApp";
import { prepareOfflineShell } from "../src/lib/offlineShell";
vi.mock("../src/lib/offlineShell", () => ({ prepareOfflineShell: vi.fn() }));
let display: EventTarget & { matches: boolean };
beforeEach(() => {
  display = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", () => display);
  vi.mocked(prepareOfflineShell).mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const mount = () =>
  render(
    <MemoryRouter>
      <InstallApp />
    </MemoryRouter>,
  );
const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Add LINC-33 to home screen" }),
  );
it("provides manual install guidance without a native prompt", () => {
  mount();
  open();
  expect(screen.getByText("Open your browser menu.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Open journeys" }).getAttribute("href"),
  ).toBe("/journey");
});
it("offers iPhone Share-sheet steps", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
  mount();
  open();
  expect(screen.getByText("Open this page in Safari.")).toBeTruthy();
});
it("invokes the native prompt from a tap and allows retry via browser menu after dismissal", async () => {
  mount();
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    { prompt, userChoice: Promise.resolve({ outcome: "dismissed" }) },
  );
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Add to home screen" }));
  await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  await screen.findByText("Open your browser menu.");
});
it("hides installation for an installed app and reacts to appinstalled", () => {
  display.matches = true;
  const view = mount();
  expect(
    screen.queryByRole("button", { name: "Add LINC-33 to home screen" }),
  ).toBeNull();
  view.unmount();
  display.matches = false;
  mount();
  act(() => window.dispatchEvent(new Event("appinstalled")));
  expect(
    screen.queryByRole("button", { name: "Add LINC-33 to home screen" }),
  ).toBeNull();
});
it("downloads the app automatically without a download button", async () => {
  vi.mocked(prepareOfflineShell).mockResolvedValueOnce(undefined);
  mount();
  open();
  await screen.findByText("App files saved on this device automatically.");
  expect(prepareOfflineShell).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /download app/i })).toBeNull();
});
it("reports interrupted automatic setup and retries on reconnect", async () => {
  vi.mocked(prepareOfflineShell).mockRejectedValueOnce(
    new Error("Download interrupted"),
  );
  mount();
  open();
  await screen.findByText("Download interrupted");
  expect(
    screen.queryByText("App files saved on this device automatically."),
  ).toBeNull();
  vi.mocked(prepareOfflineShell).mockResolvedValueOnce(undefined);
  act(() => window.dispatchEvent(new Event("online")));
  await screen.findByText("App files saved on this device automatically.");
});
it("recognizes a late completed app download without asking for a refresh", async () => {
  const worker = new EventTarget();
  Object.defineProperty(navigator, "serviceWorker", {
    value: worker,
    configurable: true,
  });
  try {
    vi.mocked(prepareOfflineShell).mockRejectedValueOnce(
      new Error("Initial setup timed out"),
    );
    mount();
    open();
    await screen.findByText("Initial setup timed out");
    vi.mocked(prepareOfflineShell).mockResolvedValueOnce(undefined);
    act(() => worker.dispatchEvent(new Event("controllerchange")));
    await screen.findByText("App files saved on this device automatically.");
    expect(screen.queryByText("Initial setup timed out")).toBeNull();
  } finally {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});
