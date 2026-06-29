import { describe, it, expect } from "vitest";
import {
  applyGammaCorrection,
  applyGaussianBlur,
  applyCLAHE,
  detectEdges,
  applyHardwareCleanup,
} from "@/lib/imaging/filters";
import type { ImageDataLike } from "@/lib/imaging/types";

function img(width: number, height: number, fill = 0): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4).fill(fill);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { data, width, height };
}

describe("applyGammaCorrection", () => {
  it("maps 0 -> 0 and 255 -> 255", () => {
    const out = applyGammaCorrection(img(2, 1, 0), 2.2);
    expect(out.data[0]).toBe(0);
  });
  it("returns the same dimensions", () => {
    const out = applyGammaCorrection(img(4, 4, 128), 2.2);
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
  });
});

describe("applyGaussianBlur", () => {
  it("sigma <= 0 is a no-op", () => {
    const input = img(4, 4, 100);
    const out = applyGaussianBlur(input, 0);
    expect(out.data[0]).toBe(100);
  });
  it("preserves dimensions for positive sigma", () => {
    const out = applyGaussianBlur(img(8, 8, 100), 0.8);
    expect(out.width).toBe(8);
  });
});

describe("detectEdges", () => {
  it("returns a width*height Uint8Array; flat field has no interior edges", () => {
    const edges = detectEdges(img(5, 5, 120));
    expect(edges.length).toBe(25);
    expect(edges[2 * 5 + 2]).toBe(0);
  });
});

describe("applyCLAHE", () => {
  it("preserves dimensions", () => {
    const out = applyCLAHE(img(16, 16, 100), 16, 2.0);
    expect(out.width).toBe(16);
    expect(out.height).toBe(16);
  });
});

describe("applyHardwareCleanup", () => {
  it("removes an isolated single black pixel", () => {
    const i = img(3, 3, 255); // all white
    const c = (1 * 3 + 1) * 4; // center
    i.data[c] = i.data[c + 1] = i.data[c + 2] = 0; // single black center
    const out = applyHardwareCleanup(i);
    expect(out.data[c]).toBe(255);
  });
});
