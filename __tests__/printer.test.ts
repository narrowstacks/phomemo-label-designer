import { describe, it, expect } from "vitest";
import { getWhitePixel, getPrintData, buildHeader } from "@/lib/printer";

// helper: build a width x height RGBA buffer from a 0/1 black-map (1 = black)
function makeCanvas(blackMap: number[][]) {
  const height = blackMap.length;
  const width = blackMap[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = blackMap[y][x] ? 0 : 255; // black -> 0, white -> 255
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("getWhitePixel", () => {
  it("returns 1 (print black) for a black pixel", () => {
    const { width, data } = makeCanvas([[1]]);
    expect(getWhitePixel(width, data, 0, 0)).toBe(1);
  });
  it("returns 0 (leave white) for a white pixel", () => {
    const { width, data } = makeCanvas([[0]]);
    expect(getWhitePixel(width, data, 0, 0)).toBe(0);
  });
  it("uses a 384 threshold on R+G+B", () => {
    const width = 1;
    const data = new Uint8ClampedArray([128, 128, 128, 255]); // sum 384 -> white
    expect(getWhitePixel(width, data, 0, 0)).toBe(0);
    const data2 = new Uint8ClampedArray([127, 128, 128, 255]); // sum 383 -> black
    expect(getWhitePixel(width, data2, 0, 0)).toBe(1);
  });
});

describe("getPrintData", () => {
  it("packs 8 pixels per byte, MSB first", () => {
    // one row, 8 pixels: black at position 0 only -> 0b10000000 = 128
    const canvas = makeCanvas([[1, 0, 0, 0, 0, 0, 0, 0]]);
    const out = getPrintData(canvas);
    expect(out[0]).toBe(128);
  });
  it("packs an all-black byte as 255", () => {
    const canvas = makeCanvas([[1, 1, 1, 1, 1, 1, 1, 1]]);
    const out = getPrintData(canvas);
    expect(out[0]).toBe(255);
  });
  it("produces (width/8)*height + 8 bytes", () => {
    const canvas = makeCanvas([
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ]);
    const out = getPrintData(canvas);
    expect(out.length).toBe((8 / 8) * 2 + 8);
  });
});

describe("buildHeader", () => {
  it("encodes mmWidth and bytes as little-endian pairs", () => {
    const h = buildHeader(300, 12);
    expect(Array.from(h)).toEqual([
      0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00,
      300 % 256, Math.floor(300 / 256),
      12 % 256, Math.floor(12 / 256),
    ]);
  });
});
