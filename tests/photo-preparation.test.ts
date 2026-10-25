// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { photoDimensions, preparePhoto } from "../src/lib/photo";
afterEach(() => vi.restoreAllMocks());
it("bounds phone photo dimensions while preserving aspect ratio", () => {
  expect(photoDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(photoDimensions(800, 600)).toEqual({ width: 800, height: 600 });
});
it("turns an oversized phone photo into a bounded JPEG before upload", async () => {
  const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:photo"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revoke,
  });
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 4000;
      naturalHeight = 3000;
      onload = () => {};
      set src(_value: string) {
        queueMicrotask(() => this.onload());
      }
    },
  );
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(),
    drawImage: draw,
  } as any);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["compressed"], { type: "image/jpeg" })),
  );
  const result = await preparePhoto(
    new File([new Uint8Array(5 * 1024 * 1024)], "phone.jpg", {
      type: "image/jpeg",
    }),
  );
  expect(result.type).toBe("image/jpeg");
  expect(result.size).toBeLessThan(3 * 1024 * 1024);
  expect(draw.mock.calls[0].slice(1)).toEqual([0, 0, 1600, 1200]);
  expect(revoke).toHaveBeenCalledWith("blob:photo");
  vi.unstubAllGlobals();
});
it("rejects unsupported photos before decoding or uploading", async () => {
  await expect(
    preparePhoto(new File(["x"], "photo.heic", { type: "image/heic" })),
  ).rejects.toThrow("JPEG, PNG or WebP");
});
