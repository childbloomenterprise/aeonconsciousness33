// @vitest-environment jsdom
import { useState } from "react";
import { Modal } from "../src/components/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MotionPolish } from "../src/components/MotionPolish";
const disconnect = vi.fn();
let reduced = false;
let originalAnimate: PropertyDescriptor | undefined;
beforeEach(() => {
  reduced = false;
  disconnect.mockReset();
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    },
  );
  originalAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(() => ({ onfinish: null, oncancel: null })),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalAnimate)
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});
it("adds decorative press feedback without intercepting the real action", () => {
  const click = vi.fn();
  render(
    <>
      <MotionPolish />
      <button onClick={click}>Save entry</button>
    </>,
  );
  const button = screen.getByRole("button", { name: "Save entry" });
  fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 });
  expect(button.querySelector(".touch-wave")?.getAttribute("aria-hidden")).toBe(
    "true",
  );
  fireEvent.click(button);
  expect(click).toHaveBeenCalledTimes(1);
});
it("does not animate disabled controls or add feedback when reduced motion is requested", () => {
  reduced = true;
  render(
    <>
      <MotionPolish />
      <button>Open journey</button>
      <button disabled>Saving</button>
    </>,
  );
  fireEvent.pointerDown(screen.getByRole("button", { name: "Open journey" }), {
    button: 0,
  });
  fireEvent.pointerDown(screen.getByRole("button", { name: "Saving" }), {
    button: 0,
  });
  expect(document.querySelector(".touch-wave")).toBeNull();
});
it("disconnects observers and removes delegated feedback on unmount", () => {
  const view = render(<MotionPolish />);
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
  const button = document.createElement("button");
  document.body.appendChild(button);
  fireEvent.pointerDown(button, { button: 0 });
  expect(button.querySelector(".touch-wave")).toBeNull();
  button.remove();
});

it("returns keyboard focus to the opener when a dialog closes", async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Choose destination</button>
        <Modal open={open} onOpenChange={setOpen} title="Choose a trip">
          <input aria-label="Destination" />
        </Modal>
      </>
    );
  }
  render(<Example />);
  const opener = screen.getByRole("button", { name: "Choose destination" });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
it("pauses delegated feedback immediately and resumes without duplicate waves", () => {
  render(
    <>
      <MotionPolish />
      <button>Continue trip</button>
    </>,
  );
  const button = screen.getByRole("button", { name: "Continue trip" });
  document.documentElement.dataset.motionPaused = "true";
  window.dispatchEvent(new Event("linc-motion-change"));
  fireEvent.pointerDown(button, { button: 0 });
  expect(button.querySelector(".touch-wave")).toBeNull();
  document.documentElement.dataset.motionPaused = "false";
  window.dispatchEvent(new Event("linc-motion-change"));
  fireEvent.pointerDown(button, { button: 0 });
  expect(button.querySelectorAll(".touch-wave")).toHaveLength(1);
  delete document.documentElement.dataset.motionPaused;
});

it("keeps pointer lighting decorative and cleans it up on pause", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(
    <>
      <MotionPolish />
      <div className="place-card">
        <button>Directions</button>
      </div>
    </>,
  );
  const button = screen.getByRole("button", { name: "Directions" });
  fireEvent.pointerMove(button, { clientX: 20, clientY: 30 });
  await waitFor(() =>
    expect(
      button.closest(".place-card")?.getAttribute("data-light-active"),
    ).toBe("true"),
  );
  expect(
    document.querySelector(".card-light")?.getAttribute("aria-hidden"),
  ).toBe("true");
  document.documentElement.dataset.motionPaused = "true";
  window.dispatchEvent(new Event("linc-motion-change"));
  expect(document.querySelector(".card-light")).toBeNull();
  expect(button.hasAttribute("disabled")).toBe(false);
  delete document.documentElement.dataset.motionPaused;
});
