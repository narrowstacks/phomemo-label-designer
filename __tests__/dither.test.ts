import { describe, it, expect } from "vitest";
import { ditherImageData, generateBlueNoiseMap } from "@/lib/imaging/dither";
import type { ImageDataLike } from "@/lib/imaging/types";

function gray(width: number, height: number, value: number): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

function isBlackOrWhite(img: ImageDataLike): boolean {
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i];
    if (v !== 0 && v !== 255) return false;
    if (img.data[i + 1] !== v || img.data[i + 2] !== v) return false;
  }
  return true;
}

describe("ditherImageData", () => {
  it("threshold: pure white stays white", () => {
    const out = ditherImageData(gray(4, 4, 255), "threshold", 128, 0, 0, 0, true, null);
    expect(Array.from(out.data).every((_, i) => i % 4 === 3 || out.data[i] === 255)).toBe(true);
  });
  it("threshold: pure black stays black", () => {
    const out = ditherImageData(gray(4, 4, 0), "threshold", 128, 0, 0, 0, true, null);
    for (let i = 0; i < out.data.length; i += 4) expect(out.data[i]).toBe(0);
  });
  it("floyd: output is strictly 1-bit (0 or 255)", () => {
    const out = ditherImageData(gray(8, 8, 130), "floyd", 128, 0, 0, 0, true, null);
    expect(isBlackOrWhite(out)).toBe(true);
  });
  it("ordered4: output is strictly 1-bit", () => {
    const out = ditherImageData(gray(8, 8, 100), "ordered4", 128, 0, 0, 0, false, null);
    expect(isBlackOrWhite(out)).toBe(true);
  });
  it("atkinson: a mid-gray field yields a mix of black and white", () => {
    const out = ditherImageData(gray(16, 16, 128), "atkinson", 128, 0, 0, 0, true, null);
    const blacks = [...out.data].filter((_, i) => i % 4 === 0 && out.data[i] === 0).length;
    expect(blacks).toBeGreaterThan(0);
  });
});

describe("generateBlueNoiseMap", () => {
  it("returns size*size entries", () => {
    const m = generateBlueNoiseMap(8);
    expect(m.length).toBe(64);
  });
});
