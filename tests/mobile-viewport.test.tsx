// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useMobileViewport } from "../src/lib/useMobileViewport";

let viewport: EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};
function Harness() {
  useMobileViewport();
  return <input aria-label="Message" />;
}
beforeEach(() => {
  vi.useFakeTimers();
  viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
    scale: 1,
  });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const flush = () =>
  act(() => {
    vi.runOnlyPendingTimers();
  });

it("keeps the composer in the visible area and restores navigation when typing ends", () => {
  const view = render(<Harness />);
  flush();
  expect(
    document.documentElement.style.getPropertyValue("--visible-height"),
  ).toBe("800px");
  view.getByRole("textbox").focus();
  viewport.height = 450;
  viewport.offsetTop = 20;
  viewport.dispatchEvent(new Event("resize"));
  flush();
  expect(document.documentElement.classList.contains("keyboard-open")).toBe(
    true,
  );
  expect(
    document.documentElement.style.getPropertyValue("--visible-height"),
  ).toBe("450px");
  expect(document.documentElement.style.getPropertyValue("--visible-top")).toBe(
    "20px",
  );
  view.getByRole("textbox").blur();
  flush();
  expect(document.documentElement.classList.contains("keyboard-open")).toBe(
    false,
  );
});

it("preserves pinch zoom and cleans up viewport listeners on unmount", () => {
  const remove = vi.spyOn(viewport, "removeEventListener");
  const view = render(<Harness />);
  flush();
  view.getByRole("textbox").focus();
  viewport.scale = 2;
  viewport.height = 400;
  viewport.dispatchEvent(new Event("resize"));
  flush();
  expect(document.documentElement.classList.contains("keyboard-open")).toBe(
    false,
  );
  expect(
    document.documentElement.style.getPropertyValue("--visible-height"),
  ).toBe("800px");
  view.unmount();
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  expect(
    document.documentElement.style.getPropertyValue("--visible-height"),
  ).toBe("");
});
