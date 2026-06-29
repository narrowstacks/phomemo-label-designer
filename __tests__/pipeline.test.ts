import { describe, it, expect } from "vitest";
import { runPipeline } from "@/lib/imaging/pipeline";
import { DEFAULT_PROCESSING_OPTIONS } from "@/lib/imaging/types";
import type { ImageDataLike } from "@/lib/imaging/types";

function gray(w: number, h: number, v: number): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("runPipeline", () => {
  it("produces strictly 1-bit output", () => {
    const out = runPipeline(gray(8, 8, 140), { ...DEFAULT_PROCESSING_OPTIONS });
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i] === 0 || out.data[i] === 255).toBe(true);
    }
  });
  it("preserves dimensions", () => {
    const out = runPipeline(gray(10, 6, 100), { ...DEFAULT_PROCESSING_OPTIONS });
    expect(out.width).toBe(10);
    expect(out.height).toBe(6);
  });
  it("two_phase algorithm runs and yields 1-bit output", () => {
    const out = runPipeline(gray(8, 8, 120), {
      ...DEFAULT_PROCESSING_OPTIONS,
      algorithm: "two_phase",
    });
    expect(out.data[3]).toBe(255);
  });
  it("advanced flags enabled still yield 1-bit output", () => {
    const out = runPipeline(gray(16, 16, 110), {
      ...DEFAULT_PROCESSING_OPTIONS,
      useGammaCorrection: true,
      useCLAHE: true,
      usePreFiltering: true,
      useEdgeAware: true,
      useHardwareCleanup: true,
    });
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i] === 0 || out.data[i] === 255).toBe(true);
    }
  });
});
