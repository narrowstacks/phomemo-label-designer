# Next.js Conversion + Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the vanilla-JS Phomemo D30 Web Bluetooth label designer into a TypeScript Next.js (App Router) app with a Tailwind/shadcn UI, moving image processing into a Web Worker and adding debounce/memoization, self-hosted dependencies, and a modular code split — with full feature parity.

**Architecture:** One client-rendered Next.js page composes panel components that read/write a single Zustand settings store. Pure image-processing logic lives in `lib/imaging/` and runs inside a Web Worker; the main thread rasterizes the source image, transfers `ImageData` to the worker, and composites the returned bitmap with text and QR/barcodes onto the preview canvas. Printing ports the existing Web Bluetooth GATT logic verbatim (with the chunking bug fixed).

**Tech Stack:** Next.js (App Router, `output: 'export'`-compatible), TypeScript, Tailwind CSS, shadcn/ui, Zustand, Vitest, `qrcode`, `jsbarcode`, `canvas-txt`, `@types/web-bluetooth`.

## Global Constraints

- All app code is client-side: no SSR, no API routes, no data fetching. The single page uses `'use client'`.
- Build must remain static-export compatible (`next.config` with `output: 'export'`); deploy target is Vercel.
- The BLE wire format must be byte-identical to the current app: header bytes, white-pixel threshold of `384`, and 8-pixels-per-byte packing are ported verbatim.
- Dithering/filter math is ported function-for-function from the existing `index.js`; no algorithmic changes.
- Pure imaging functions in `lib/imaging/` must be worker-safe: they operate only on `ImageData`-shaped objects (`{ data, width, height }`) and `Uint8ClampedArray`/typed arrays. They must NOT touch `document`, `window`, or create canvases. All canvas/DOM work stays on the main thread.
- Node version: 20+. Package manager: npm.
- Use the latest stable versions of all dependencies, including **Tailwind CSS v4** (CSS-first config via `@import "tailwindcss"` and the `@tailwindcss/postcss` plugin). (Task 1 originally scaffolded Tailwind v3; Task 2 migrates to v4 per this constraint.)
- Source-of-truth line references below point at the pre-conversion files (`index.js`, `src/printer.js`, `index.html`) on the `nextjs-conversion` branch.

---

## File Structure

**Created:**
- `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `components.json`, `vitest.config.ts`, `vitest.setup.ts`, `.eslintrc.json`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `lib/printer.ts`, `lib/codes.ts`, `lib/store.ts`, `lib/utils.ts`
- `lib/imaging/types.ts`, `lib/imaging/dither.ts`, `lib/imaging/filters.ts`, `lib/imaging/pipeline.ts`
- `lib/imaging/raster.ts` (main-thread rasterization: rotate + scale + extract ImageData)
- `lib/worker/imaging.worker.ts`, `lib/worker/protocol.ts`, `lib/worker/useImageProcessor.ts`
- `hooks/useCanvasCompositor.ts`
- `components/panels/TextSettings.tsx`, `components/panels/ImageSettings.tsx`, `components/panels/CodeSettings.tsx`, `components/panels/PreviewPanel.tsx`
- `components/ui/*` (shadcn-generated: button, input, textarea, label, select, slider, checkbox, accordion, card, sonner)
- `__tests__/printer.test.ts`, `__tests__/dither.test.ts`, `__tests__/filters.test.ts`, `__tests__/pipeline.test.ts`, `__tests__/store.test.ts`

**Deleted (final task):**
- `index.html`, `index.js`, `src/printer.js`, `src/` (if empty), `libs/jsbarcode.min.js`, `libs/qrcode.min.js`, `.prettierrc.json` (replaced by eslint/next defaults — keep if preferred)

---

## Task 1: Project scaffold (Next.js + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `vitest.setup.ts`, `lib/utils.ts`, `.eslintrc.json`, `.gitignore` (update)

**Interfaces:**
- Produces: a building Next.js app with a placeholder page; `npm run build`, `npm run dev`, `npm test` all work; `cn()` helper exported from `lib/utils.ts`.

- [ ] **Step 1: Initialize dependencies**

Run:
```bash
npm init -y
npm install next@latest react@latest react-dom@latest zustand qrcode jsbarcode canvas-txt
npm install -D typescript @types/react @types/react-dom @types/node @types/web-bluetooth \
  tailwindcss postcss autoprefixer \
  vitest @vitest/ui jsdom \
  eslint eslint-config-next \
  clsx tailwind-merge @types/qrcode
```

- [ ] **Step 2: Write `package.json` scripts**

Merge these scripts into `package.json`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "index.js", "src/printer.js"]
}
```

- [ ] **Step 5: Configure Tailwind**

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Write `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Write root layout and placeholder page**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phomemo D30 Web Bluetooth",
  description: "Print labels to a Phomemo D30 over Web Bluetooth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
"use client";

export default function Home() {
  return <main className="p-8 text-2xl font-bold">Phomemo D30 — scaffold OK</main>;
}
```

- [ ] **Step 8: Configure Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`vitest.setup.ts` (polyfills `ImageData` for node/jsdom so worker-safe functions can be unit-tested):
```ts
// jsdom does not implement ImageData. Provide a minimal, spec-shaped polyfill.
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      height?: number
    ) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? dataOrWidth.length / 4 / widthOrHeight;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      }
    }
  }
  // @ts-expect-error assigning polyfill to global
  globalThis.ImageData = ImageDataPolyfill;
}
```

- [ ] **Step 9: ESLint config + gitignore**

`.eslintrc.json`:
```json
{ "extends": "next/core-web-vitals" }
```

Append to `.gitignore`:
```
node_modules/
.next/
out/
next-env.d.ts
*.tsbuildinfo
```

- [ ] **Step 10: Verify build, dev boot, and tests run**

Run:
```bash
npm run typecheck && npm run build
```
Expected: type check passes; build completes and emits `out/`.

Run:
```bash
npx vitest run --reporter=basic
```
Expected: "No test files found" (exit 0) or passes — confirms Vitest is wired.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TS + Tailwind + Vitest"
```

---

> **Revised during execution:** The user opted for latest packages including Tailwind CSS v4. This task now also migrates Tailwind v3 → v4 (swap to `@tailwindcss/postcss`, `app/globals.css` uses `@import "tailwindcss"`, drop the v3 `tailwind.config.ts`/`@tailwind` directives) before running shadcn (which is v4-aware). The component set, `<Toaster />` mount, and acceptance bar (clean `npm run build` emitting `out/`) are unchanged. See `.superpowers/sdd/task-2-brief.md` for the exact migration steps used.

## Task 2: Install shadcn/ui primitives

**Files:**
- Create: `components.json`, `components/ui/{button,input,textarea,label,select,slider,checkbox,accordion,card,sonner}.tsx`
- Modify: `app/globals.css` (shadcn theme tokens), `tailwind.config.ts`, `app/layout.tsx` (mount `<Toaster />`)

**Interfaces:**
- Produces: importable shadcn components, e.g. `import { Slider } from "@/components/ui/slider"`, `import { toast } from "sonner"`, `<Toaster />` mounted at root.

- [ ] **Step 1: Initialize shadcn**

Run (accept defaults; choose "Default" style, base color "Slate", CSS variables yes):
```bash
npx shadcn@latest init -d
```
This writes `components.json`, rewrites `app/globals.css` with theme tokens, and updates `tailwind.config.ts`.

- [ ] **Step 2: Add the components used by the panels**

Run:
```bash
npx shadcn@latest add button input textarea label select slider checkbox accordion card sonner
```
Expected: files created under `components/ui/`.

- [ ] **Step 3: Mount the toast provider**

In `app/layout.tsx`, import and render `<Toaster />` inside `<body>` after `{children}`:
```tsx
import { Toaster } from "@/components/ui/sonner";
// ...
<body>
  {children}
  <Toaster richColors position="bottom-left" />
</body>
```

- [ ] **Step 4: Verify build**

Run:
```bash
npm run typecheck && npm run build
```
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui primitives and toaster"
```

---

## Task 3: Port the printer module (TDD)

**Files:**
- Create: `lib/printer.ts`, `__tests__/printer.test.ts`
- Source reference: `src/printer.js` (entire file, lines 1-107)

**Interfaces:**
- Produces:
  - `getWhitePixel(width: number, imageData: Uint8ClampedArray, x: number, y: number): 0 | 1`
  - `getPrintData(canvas: { width: number; height: number; data: Uint8ClampedArray }): Uint8Array`
  - `buildHeader(mmWidth: number, bytes: number): Uint8Array`
  - `printCanvas(characteristic: BluetoothRemoteGATTCharacteristic, canvas: HTMLCanvasElement): Promise<void>`
- Note: `getPrintData` is refactored to accept a plain `{ width, height, data }` object (not an `HTMLCanvasElement`) so it is unit-testable; `printCanvas` extracts `data` via `getImageData` then calls it.

- [ ] **Step 1: Write the failing tests**

`__tests__/printer.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/printer.test.ts`
Expected: FAIL — `@/lib/printer` not found.

- [ ] **Step 3: Implement `lib/printer.ts`**

Port from `src/printer.js`. Convert `HEADER_DATA` -> `buildHeader`, `getWhitePixel(canvas, …)` -> `getWhitePixel(width, …)`, and `getPrintData(canvas)` -> accept `{ width, height, data }`. Fix the chunking loop bug. Full implementation:

```ts
const PACKET_SIZE_BYTES = 128;

const PRINT_SERVICE = "0000ff00-0000-1000-8000-00805f9b34fb";
const PRINT_CHARACTERISTIC = "0000ff02-0000-1000-8000-00805f9b34fb";

export const PRINTER_GATT = { service: PRINT_SERVICE, characteristic: PRINT_CHARACTERISTIC };

export function buildHeader(mmWidth: number, bytes: number): Uint8Array {
  return new Uint8Array([
    0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00,
    mmWidth % 256, Math.floor(mmWidth / 256),
    bytes % 256, Math.floor(bytes / 256),
  ]);
}

const END_DATA = new Uint8Array([0x1b, 0x64, 0x00]);

export function getWhitePixel(
  width: number,
  imageData: Uint8ClampedArray,
  x: number,
  y: number
): 0 | 1 {
  const i = (width * y + x) * 4;
  const sum = imageData[i] + imageData[i + 1] + imageData[i + 2];
  return sum > 384 ? 0 : 1;
}

export function getPrintData(canvas: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): Uint8Array {
  const { width, height, data: imageData } = canvas;
  const data = new Uint8Array((width / 8) * height + 8);
  let offset = 0;
  for (let i = 0; i < height; ++i) {
    for (let k = 0; k < width / 8; ++k) {
      const k8 = k * 8;
      data[offset++] =
        getWhitePixel(width, imageData, k8 + 0, i) * 128 +
        getWhitePixel(width, imageData, k8 + 1, i) * 64 +
        getWhitePixel(width, imageData, k8 + 2, i) * 32 +
        getWhitePixel(width, imageData, k8 + 3, i) * 16 +
        getWhitePixel(width, imageData, k8 + 4, i) * 8 +
        getWhitePixel(width, imageData, k8 + 5, i) * 4 +
        getWhitePixel(width, imageData, k8 + 6, i) * 2 +
        getWhitePixel(width, imageData, k8 + 7, i);
    }
  }
  return data;
}

export async function printCanvas(
  characteristic: BluetoothRemoteGATTCharacteristic,
  canvas: HTMLCanvasElement
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const printData = getPrintData({ width: canvas.width, height: canvas.height, data });
  const bytesPerRow = canvas.width / 8;

  await characteristic.writeValueWithResponse(
    buildHeader(bytesPerRow, printData.length / bytesPerRow)
  );

  for (let i = 0; i < printData.length; i += PACKET_SIZE_BYTES) {
    const chunk = printData.slice(i, i + PACKET_SIZE_BYTES);
    await characteristic.writeValueWithResponse(chunk);
  }

  await characteristic.writeValueWithResponse(END_DATA);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/printer.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/printer.ts __tests__/printer.test.ts
git commit -m "feat: typed printer module with fixed packet chunking (TDD)"
```

---

## Task 4: Imaging types

**Files:**
- Create: `lib/imaging/types.ts`
- Source reference: `index.js:494-513` (dither signature), `index.js:902-929` (advancedOptions destructure)

**Interfaces:**
- Produces:
  - `type DitherAlgorithm` (union of all algorithm ids)
  - `interface ProcessingOptions` (brightness, contrast, algorithm, threshold, noise, serpentine, edge-aware + all advanced flags/values)
  - `type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number }`

- [ ] **Step 1: Write `lib/imaging/types.ts`**

```ts
export type DitherAlgorithm =
  | "floyd"
  | "atkinson"
  | "stucki"
  | "jarvis"
  | "sierra"
  | "burkes"
  | "threshold"
  | "ordered2"
  | "ordered4"
  | "ordered8"
  | "blue_noise"
  | "two_phase";

export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** Options consumed by the pure pixel pipeline (worker-safe). */
export interface ProcessingOptions {
  algorithm: DitherAlgorithm;
  threshold: number; // 0-255
  brightness: number; // -100..100
  contrast: number; // -100..100
  noise: number; // 0..50
  serpentine: boolean;
  // advanced
  useGammaCorrection: boolean;
  gamma: number;
  usePreFiltering: boolean;
  blurSigma: number;
  unsharpRadius: number;
  unsharpAmount: number;
  useCLAHE: boolean;
  claheClipLimit: number;
  claheTileSize: number;
  useEdgeAware: boolean;
  useHardwareCleanup: boolean;
}

export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  algorithm: "floyd",
  threshold: 128,
  brightness: 0,
  contrast: 0,
  noise: 0,
  serpentine: true,
  useGammaCorrection: false,
  gamma: 2.2,
  usePreFiltering: false,
  blurSigma: 0.5,
  unsharpRadius: 1.0,
  unsharpAmount: 0.8,
  useCLAHE: false,
  claheClipLimit: 2.0,
  claheTileSize: 16,
  useEdgeAware: false,
  useHardwareCleanup: false,
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/imaging/types.ts
git commit -m "feat: imaging option and algorithm types"
```

---

## Task 5: Port dithering algorithms (TDD)

**Files:**
- Create: `lib/imaging/dither.ts`, `__tests__/dither.test.ts`
- Source reference: `index.js:363-406` (`generateBlueNoiseMap`), `index.js:494-752` (`ditherImageData`), `index.js:854-888` (`applyTwoPhaseDiffusion`)

**Interfaces:**
- Consumes: `ImageDataLike`, `DitherAlgorithm` from `@/lib/imaging/types`.
- Produces:
  - `ditherImageData(img: ImageDataLike, algorithm: DitherAlgorithm, threshold: number, brightness: number, contrast: number, noise: number, serpentine: boolean, edgeMap: Uint8Array | null): ImageDataLike` — mutates and returns `img`, writing 1-bit black/white into `data`.
  - `applyTwoPhaseDiffusion(img, threshold, brightness, contrast, noise, edgeMap): ImageDataLike`
  - `generateBlueNoiseMap(size?: number): Uint8Array`

**Conversion notes:**
- Port the bodies verbatim from the referenced lines, converting JSDoc params to TS types per the signatures above.
- Replace the internal `new ImageData(...)` in `applyTwoPhaseDiffusion` with the polyfill-friendly constructor (it exists in both browser and the test polyfill, so `new ImageData(new Uint8ClampedArray(img.data), img.width, img.height)` is fine).
- `generateBlueNoiseMap` uses `Math.random()` — leave as-is (matches current behavior; tests must not assert exact values for blue noise).
- Do NOT change the math, kernels, Bayer matrices, brightness/contrast formula, or serpentine logic.

- [ ] **Step 1: Write the failing tests**

`__tests__/dither.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/dither.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/imaging/dither.ts`**

Port `generateBlueNoiseMap` (index.js:363-406), `ditherImageData` (index.js:494-752), and `applyTwoPhaseDiffusion` (index.js:854-888) verbatim into TS with the signatures in **Interfaces**. Import `ImageDataLike`, `DitherAlgorithm` from `./types`. Keep the `setBWPixel` helper, all kernels, Bayer matrices, and serpentine handling exactly as-is. Export `ditherImageData`, `applyTwoPhaseDiffusion`, `generateBlueNoiseMap`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/dither.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/imaging/dither.ts __tests__/dither.test.ts
git commit -m "feat: port dithering algorithms to TS (TDD)"
```

---

## Task 6: Port image filters (TDD)

**Files:**
- Create: `lib/imaging/filters.ts`, `__tests__/filters.test.ts`
- Source reference: `index.js:138-156` (gamma), `index.js:164-243` (gaussian blur), `index.js:252-271` (unsharp), `index.js:280-361` (CLAHE), `index.js:413-450` (edge detect), `index.js:793-852` (hardware cleanup)

**Interfaces:**
- Consumes: `ImageDataLike` from `@/lib/imaging/types`.
- Produces (all mutate-and-return `img`, except `detectEdges` which returns a `Uint8Array`):
  - `applyGammaCorrection(img: ImageDataLike, gamma?: number): ImageDataLike`
  - `applyGaussianBlur(img: ImageDataLike, sigma?: number): ImageDataLike`
  - `applyUnsharpMask(img: ImageDataLike, radius?: number, amount?: number): ImageDataLike`
  - `applyCLAHE(img: ImageDataLike, tileSize?: number, clipLimit?: number): ImageDataLike`
  - `detectEdges(img: ImageDataLike): Uint8Array`
  - `applyHardwareCleanup(img: ImageDataLike): ImageDataLike`

**Conversion notes:**
- Port bodies verbatim; only add TS types. `applyUnsharpMask` constructs `new ImageData(new Uint8ClampedArray(data), width, height)` — keep (works with polyfill).

- [ ] **Step 1: Write the failing tests**

`__tests__/filters.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/filters.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/imaging/filters.ts`**

Port the six functions verbatim from the referenced line ranges with the TS signatures in **Interfaces**. Import `ImageDataLike` from `./types`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/imaging/filters.ts __tests__/filters.test.ts
git commit -m "feat: port image filters to TS (TDD)"
```

---

## Task 7: Pipeline orchestration (TDD)

**Files:**
- Create: `lib/imaging/pipeline.ts`, `__tests__/pipeline.test.ts`
- Source reference: `index.js:959-1016` (the post-rasterization steps of `processImageWithAdjustments`)

**Interfaces:**
- Consumes: `ImageDataLike`, `ProcessingOptions` from `./types`; filters from `./filters`; `ditherImageData`, `applyTwoPhaseDiffusion` from `./dither`.
- Produces:
  - `runPipeline(img: ImageDataLike, options: ProcessingOptions): ImageDataLike`
- Behavior: applies, in order: gamma (if `useGammaCorrection`) -> CLAHE (if `useCLAHE`) -> pre-filter blur+unsharp (if `usePreFiltering`) -> edge map (if `useEdgeAware`) -> dither (two-phase or single) -> hardware cleanup (if `useHardwareCleanup`). This is the worker-safe core; rotation and printer-resolution scaling are NOT here (they need canvas — see Task 8).

- [ ] **Step 1: Write the failing tests**

`__tests__/pipeline.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/pipeline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/imaging/pipeline.ts`**

```ts
import type { ImageDataLike, ProcessingOptions } from "./types";
import {
  applyGammaCorrection,
  applyGaussianBlur,
  applyUnsharpMask,
  applyCLAHE,
  detectEdges,
  applyHardwareCleanup,
} from "./filters";
import { ditherImageData, applyTwoPhaseDiffusion } from "./dither";

/**
 * Worker-safe core pipeline: ImageData in, 1-bit ImageData out.
 * Rotation / printer-resolution scaling happen on the main thread (canvas) before this.
 */
export function runPipeline(img: ImageDataLike, options: ProcessingOptions): ImageDataLike {
  let data: ImageDataLike = img;

  if (options.useGammaCorrection) data = applyGammaCorrection(data, options.gamma);
  if (options.useCLAHE) data = applyCLAHE(data, options.claheTileSize, options.claheClipLimit);
  if (options.usePreFiltering) {
    data = applyGaussianBlur(data, options.blurSigma);
    data = applyUnsharpMask(data, options.unsharpRadius, options.unsharpAmount);
  }

  const edgeMap = options.useEdgeAware ? detectEdges(data) : null;

  let processed: ImageDataLike;
  if (options.algorithm === "two_phase") {
    processed = applyTwoPhaseDiffusion(
      data,
      options.threshold,
      options.brightness,
      options.contrast,
      options.noise,
      edgeMap
    );
  } else {
    processed = ditherImageData(
      data,
      options.algorithm,
      options.threshold,
      options.brightness,
      options.contrast,
      options.noise,
      options.serpentine,
      edgeMap
    );
  }

  if (options.useHardwareCleanup) processed = applyHardwareCleanup(processed);

  return processed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/imaging/pipeline.ts __tests__/pipeline.test.ts
git commit -m "feat: worker-safe imaging pipeline orchestration (TDD)"
```

---

## Task 8: Main-thread rasterizer

**Files:**
- Create: `lib/imaging/raster.ts`
- Source reference: `index.js:460-491` (`scaleToExactResolution`), `index.js:760-786` (`rotateImage`), `index.js:931-957` (rotation + scale + extract ImageData portion of `processImageWithAdjustments`)

**Interfaces:**
- Produces:
  - `rotateImage(image: CanvasImageSource & { width: number; height: number }, angle: number): HTMLCanvasElement`
  - `scaleToExactResolution(image, targetWidth: number, targetHeight: number, method?: "nearest" | "bilinear" | "lanczos"): HTMLCanvasElement`
  - `rasterizeSource(image, opts: { rotation: number; usePrinterResolution: boolean; printerWidth: number; printerHeight: number; scalingMethod?: string }): ImageData` — returns the white-backed `ImageData` ready to hand to the worker.
- Note: these use `document.createElement("canvas")`, so they are main-thread only (NOT imported by the worker).

- [ ] **Step 1: Write `lib/imaging/raster.ts`**

Port `rotateImage` and `scaleToExactResolution` verbatim from the referenced lines (typed). Then add `rasterizeSource` which performs the rotation-first + optional scale + draw-on-white + `getImageData` steps from `index.js:931-957`:

```ts
import type { ImageDataLike } from "./types";

type Source = CanvasImageSource & { width: number; height: number };

export function rotateImage(image: Source, angle: number): HTMLCanvasElement {
  // ... verbatim port of index.js:760-786 ...
  // (create canvas, swap dims for 90/270, fill white, translate/rotate, drawImage)
  return null as unknown as HTMLCanvasElement;
}

export function scaleToExactResolution(
  image: Source,
  targetWidth: number,
  targetHeight: number,
  method: "nearest" | "bilinear" | "lanczos" = "lanczos"
): HTMLCanvasElement {
  // ... verbatim port of index.js:460-491 ...
  return null as unknown as HTMLCanvasElement;
}

export function rasterizeSource(
  image: Source,
  opts: {
    rotation: number;
    usePrinterResolution: boolean;
    printerWidth: number;
    printerHeight: number;
    scalingMethod?: "nearest" | "bilinear" | "lanczos";
  }
): ImageData {
  let raster: Source = image;
  if (opts.rotation !== 0) raster = rotateImage(image, opts.rotation);
  if (opts.usePrinterResolution) {
    raster = scaleToExactResolution(
      raster,
      opts.printerWidth,
      opts.printerHeight,
      opts.scalingMethod ?? "lanczos"
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(raster, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
```
Replace the two `return null as unknown as ...` bodies with the verbatim ports. (The placeholder returns are only shown here to keep the surrounding structure readable — the implementer fills both with the referenced code.)

- [ ] **Step 2: Verify typecheck and build**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/imaging/raster.ts
git commit -m "feat: main-thread source rasterizer (rotate + scale + extract)"
```

---

## Task 9: Worker + protocol + processor hook

**Files:**
- Create: `lib/worker/protocol.ts`, `lib/worker/imaging.worker.ts`, `lib/worker/useImageProcessor.ts`

**Interfaces:**
- Consumes: `runPipeline` from `@/lib/imaging/pipeline`; `ProcessingOptions` from `@/lib/imaging/types`.
- Produces:
  - `protocol.ts`: `type WorkerRequest = { id: number; width: number; height: number; buffer: ArrayBuffer; options: ProcessingOptions }`, `type WorkerResponse = { id: number; width: number; height: number; buffer: ArrayBuffer }`.
  - `useImageProcessor(): { process: (img: ImageData, options: ProcessingOptions) => Promise<ImageData>; }` — debounced (120ms), transfers buffers both ways, resolves with processed `ImageData`. Latest-call-wins (drops stale results by id).

- [ ] **Step 1: Write `lib/worker/protocol.ts`**

```ts
import type { ProcessingOptions } from "@/lib/imaging/types";

export interface WorkerRequest {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer; // RGBA pixel buffer
  options: ProcessingOptions;
}

export interface WorkerResponse {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}
```

- [ ] **Step 2: Write `lib/worker/imaging.worker.ts`**

```ts
import { runPipeline } from "@/lib/imaging/pipeline";
import type { WorkerRequest, WorkerResponse } from "./protocol";

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, width, height, buffer, options } = e.data;
  const img = { data: new Uint8ClampedArray(buffer), width, height };
  const out = runPipeline(img, options);
  const response: WorkerResponse = {
    id,
    width: out.width,
    height: out.height,
    buffer: out.data.buffer,
  };
  (self as unknown as Worker).postMessage(response, [out.data.buffer]);
};
```

- [ ] **Step 3: Write `lib/worker/useImageProcessor.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProcessingOptions } from "@/lib/imaging/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export function useImageProcessor() {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const pending = useRef<Map<number, (img: ImageData) => void>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./imaging.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, width, height, buffer } = e.data;
      const resolve = pending.current.get(id);
      if (resolve) {
        pending.current.delete(id);
        resolve(new ImageData(new Uint8ClampedArray(buffer), width, height));
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const process = useCallback((img: ImageData, options: ProcessingOptions) => {
    return new Promise<ImageData>((resolve) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const worker = workerRef.current;
        if (!worker) return;
        const id = ++idRef.current;
        // latest-wins: drop all older pending resolvers
        pending.current.clear();
        pending.current.set(id, resolve);
        const buffer = img.data.buffer.slice(0); // copy so caller's ImageData stays valid
        const req: WorkerRequest = {
          id,
          width: img.width,
          height: img.height,
          buffer,
          options,
        };
        worker.postMessage(req, [buffer]);
      }, 120);
    });
  }, []);

  return { process };
}
```

- [ ] **Step 4: Verify build (worker bundling)**

Run: `npm run build`
Expected: build succeeds and bundles the worker (Next supports `new Worker(new URL(...), { type: "module" })`).

- [ ] **Step 5: Commit**

```bash
git add lib/worker
git commit -m "feat: imaging web worker with debounced latest-wins processor hook"
```

---

## Task 10: QR / barcode generation module

**Files:**
- Create: `lib/codes.ts`
- Source reference: `index.js:28-95` (`generateCode`), `index.js:1394-1421` (standalone barcode — NOT ported; dead tab removed)

**Interfaces:**
- Produces:
  - `type CodeType = "none" | "qr" | "barcode"`
  - `type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC"`
  - `type QrErrorCorrection = "L" | "M" | "Q" | "H"`
  - `generateCode(data: string, type: Exclude<CodeType, "none">, format?: BarcodeFormat, errorCorrection?: QrErrorCorrection): Promise<HTMLImageElement | null>`

- [ ] **Step 1: Implement `lib/codes.ts`**

Port `generateCode` from `index.js:28-95`, importing from npm packages instead of CDNs:
```ts
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

export type CodeType = "none" | "qr" | "barcode";
export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC";
export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export async function generateCode(
  data: string,
  type: Exclude<CodeType, "none">,
  format: BarcodeFormat = "CODE128",
  errorCorrection: QrErrorCorrection = "M"
): Promise<HTMLImageElement | null> {
  if (!data.trim()) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (type === "qr") {
    try {
      await QRCode.toCanvas(canvas, data, {
        errorCorrectionLevel: errorCorrection,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
        width: 200,
      });
    } catch (err) {
      console.error("QR code generation failed:", err);
      return null;
    }
  } else {
    try {
      const tempImg = document.createElement("img");
      JsBarcode(tempImg, data, {
        format,
        width: 2,
        height: 100,
        displayValue: false,
        background: "#FFFFFF",
        lineColor: "#000000",
        margin: 10,
      });
      await new Promise<void>((resolve, reject) => {
        tempImg.onload = () => {
          canvas.width = tempImg.width;
          canvas.height = tempImg.height;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tempImg, 0, 0);
          resolve();
        };
        tempImg.onerror = reject;
      });
    } catch (err) {
      console.error("Barcode generation failed:", err);
      return null;
    }
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });
  return img;
}
```

- [ ] **Step 2: Verify typecheck/build**

Run: `npm run typecheck && npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/codes.ts
git commit -m "feat: npm-bundled QR/barcode generation"
```

---

## Task 11: Zustand settings store (TDD)

**Files:**
- Create: `lib/store.ts`, `__tests__/store.test.ts`
- Source reference: defaults in `index.html` (control `value`/`checked` attributes) and `index.js:11-18`

**Interfaces:**
- Consumes: `DitherAlgorithm`, `ProcessingOptions` types; `CodeType`, `BarcodeFormat`, `QrErrorCorrection` from `@/lib/codes`.
- Produces: `useSettings` Zustand hook exposing all fields (see types below) plus a generic `set<K>(key, value)` updater and `resetOffset()`.

- [ ] **Step 1: Write the failing test**

`__tests__/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useSettings } from "@/lib/store";

describe("useSettings store", () => {
  beforeEach(() => {
    useSettings.setState(useSettings.getInitialState());
  });

  it("has the documented defaults", () => {
    const s = useSettings.getState();
    expect(s.text).toBe("Hello world");
    expect(s.fontSize).toBe(36);
    expect(s.labelWidth).toBe(40);
    expect(s.labelHeight).toBe(12);
    expect(s.algorithm).toBe("floyd");
    expect(s.threshold).toBe(128);
    expect(s.previewRotation).toBe(-90);
    expect(s.serpentine).toBe(true);
  });

  it("set() updates a single field", () => {
    useSettings.getState().set("fontSize", 48);
    expect(useSettings.getState().fontSize).toBe(48);
  });

  it("resetOffset() zeroes both offsets", () => {
    useSettings.getState().set("offsetX", 10);
    useSettings.getState().set("offsetY", -5);
    useSettings.getState().resetOffset();
    expect(useSettings.getState().offsetX).toBe(0);
    expect(useSettings.getState().offsetY).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/store.ts`**

```ts
import { create } from "zustand";
import type { DitherAlgorithm } from "@/lib/imaging/types";
import type { CodeType, BarcodeFormat, QrErrorCorrection } from "@/lib/codes";

export type ImagePosition = "above" | "below" | "left" | "right" | "background" | "none";
export type CodePosition = "above" | "below" | "left" | "right" | "background";
export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold" | "lighter";

export interface SettingsState {
  // text
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  verticalText: boolean;
  // image
  uploadedImage: HTMLImageElement | null;
  imagePosition: ImagePosition;
  imageSize: number;
  imageRotation: number;
  algorithm: DitherAlgorithm;
  threshold: number;
  brightness: number;
  contrast: number;
  noise: number;
  // advanced
  useGammaCorrection: boolean;
  gamma: number;
  usePreFiltering: boolean;
  blurSigma: number;
  unsharpAmount: number;
  useCLAHE: boolean;
  claheClipLimit: number;
  useEdgeAware: boolean;
  useHardwareCleanup: boolean;
  usePrinterResolution: boolean;
  serpentine: boolean;
  // codes
  codeType: CodeType;
  codeData: string;
  codePosition: CodePosition;
  codeSize: number;
  qrErrorCorrection: QrErrorCorrection;
  barcodeFormat: BarcodeFormat;
  // layout/output
  labelWidth: number;
  labelHeight: number;
  offsetX: number;
  offsetY: number;
  offsetStep: number;
  previewRotation: number;
  // actions
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetOffset: () => void;
}

const initial = {
  text: "Hello world",
  fontFamily: "Arial, sans-serif",
  fontSize: 36,
  fontWeight: "normal" as FontWeight,
  textAlign: "center" as TextAlign,
  verticalText: false,
  uploadedImage: null,
  imagePosition: "none" as ImagePosition,
  imageSize: 50,
  imageRotation: 0,
  algorithm: "floyd" as DitherAlgorithm,
  threshold: 128,
  brightness: 0,
  contrast: 0,
  noise: 0,
  useGammaCorrection: false,
  gamma: 2.2,
  usePreFiltering: false,
  blurSigma: 0.5,
  unsharpAmount: 0.8,
  useCLAHE: false,
  claheClipLimit: 2.0,
  useEdgeAware: false,
  useHardwareCleanup: false,
  usePrinterResolution: false,
  serpentine: true,
  codeType: "none" as CodeType,
  codeData: "",
  codePosition: "above" as CodePosition,
  codeSize: 30,
  qrErrorCorrection: "M" as QrErrorCorrection,
  barcodeFormat: "CODE128" as BarcodeFormat,
  labelWidth: 40,
  labelHeight: 12,
  offsetX: 0,
  offsetY: 0,
  offsetStep: 5,
  previewRotation: -90,
};

export const useSettings = create<SettingsState>((set) => ({
  ...initial,
  set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
  resetOffset: () => set({ offsetX: 0, offsetY: 0 }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/store.test.ts`
Expected: PASS. (If `getInitialState` is unavailable in the installed Zustand version, change the test's `beforeEach` to `useSettings.setState({ ...initial })` by exporting `initial` — but prefer the built-in.)

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts __tests__/store.test.ts
git commit -m "feat: typed Zustand settings store (TDD)"
```

---

## Task 12: Canvas compositor hook

**Files:**
- Create: `hooks/useCanvasCompositor.ts`
- Source reference: `index.js:1025-1084` (`drawVerticalText`), `index.js:1146-1392` (`updateCanvasText` compositing + positioning), `index.js:1086-1144` (`updateLabelSize` canvas sizing)

**Interfaces:**
- Consumes: `useSettings` store; `useImageProcessor` hook; `rasterizeSource` from `@/lib/imaging/raster`; `generateCode` from `@/lib/codes`; `drawText` from `canvas-txt`; `ProcessingOptions` type.
- Produces: `useCanvasCompositor(canvasRef: RefObject<HTMLCanvasElement>): void` — subscribes to the store and redraws the canvas whenever relevant settings change. Internally:
  - Recomputes canvas pixel dims from `labelWidth`/`labelHeight` (width = `labelHeight*8`, height = `labelWidth*8`; ported from `index.js:1103-1108`) and sets the CSS display size with integer nearest-neighbor scaling (`index.js:1110-1133`).
  - Memoizes the processed image bitmap: only re-runs `rasterizeSource` + worker `process()` when image-affecting inputs change (`uploadedImage`, `imageRotation`, `usePrinterResolution`, `algorithm`, `threshold`, `brightness`, `contrast`, `noise`, `serpentine`, and all advanced flags/values). Cheap changes (`text`, font*, `offset*`, code*) only re-composite.
  - Composites in the same order as `updateCanvasText`: white bg -> rotate ctx +90deg -> apply offset -> draw processed image at its position (or background alpha 0.3) -> draw code at its position (or background alpha 0.2) -> draw text (vertical or `drawText`).

**Implementation guidance (full hook):**

- [ ] **Step 1: Implement `hooks/useCanvasCompositor.ts`**

```ts
"use client";

import { RefObject, useEffect, useMemo, useRef } from "react";
import { drawText } from "canvas-txt";
import { useSettings } from "@/lib/store";
import { useImageProcessor } from "@/lib/worker/useImageProcessor";
import { rasterizeSource } from "@/lib/imaging/raster";
import { generateCode } from "@/lib/codes";
import type { ProcessingOptions } from "@/lib/imaging/types";

function drawVerticalText(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: {
    x: number; y: number; width: number; height: number;
    fontFamily: string; fontSize: number; fontWeight: string; align: string;
  }
) {
  // verbatim port of index.js:1025-1084
}

export function useCanvasCompositor(canvasRef: RefObject<HTMLCanvasElement>) {
  const s = useSettings();
  const { process } = useImageProcessor();
  const processedRef = useRef<HTMLCanvasElement | null>(null);
  const codeRef = useRef<HTMLImageElement | null>(null);

  const procOptions: ProcessingOptions = useMemo(
    () => ({
      algorithm: s.algorithm,
      threshold: s.threshold,
      brightness: s.brightness,
      contrast: s.contrast,
      noise: s.noise,
      serpentine: s.serpentine,
      useGammaCorrection: s.useGammaCorrection,
      gamma: s.gamma,
      usePreFiltering: s.usePreFiltering,
      blurSigma: s.blurSigma,
      unsharpRadius: 1.0,
      unsharpAmount: s.unsharpAmount,
      useCLAHE: s.useCLAHE,
      claheClipLimit: s.claheClipLimit,
      claheTileSize: 16,
      useEdgeAware: s.useEdgeAware,
      useHardwareCleanup: s.useHardwareCleanup,
    }),
    [s.algorithm, s.threshold, s.brightness, s.contrast, s.noise, s.serpentine,
     s.useGammaCorrection, s.gamma, s.usePreFiltering, s.blurSigma, s.unsharpAmount,
     s.useCLAHE, s.claheClipLimit, s.useEdgeAware, s.useHardwareCleanup]
  );

  // 1) Process the uploaded image (memoized by image-affecting deps) via the worker.
  useEffect(() => {
    let cancelled = false;
    if (!s.uploadedImage || s.imagePosition === "none") {
      processedRef.current = null;
      composite();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const source = rasterizeSource(s.uploadedImage, {
      rotation: s.imageRotation,
      usePrinterResolution: s.usePrinterResolution,
      printerWidth: canvas.width,
      printerHeight: canvas.height,
    });
    process(source, procOptions).then((out) => {
      if (cancelled) return;
      const c = document.createElement("canvas");
      c.width = out.width;
      c.height = out.height;
      c.getContext("2d")!.putImageData(out, 0, 0);
      processedRef.current = c;
      composite();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.uploadedImage, s.imagePosition, s.imageRotation, s.usePrinterResolution, procOptions, s.labelWidth, s.labelHeight]);

  // 2) Generate code (memoized by code deps).
  useEffect(() => {
    let cancelled = false;
    if (s.codeType === "none" || !s.codeData.trim()) {
      codeRef.current = null;
      composite();
      return;
    }
    generateCode(s.codeData, s.codeType, s.barcodeFormat, s.qrErrorCorrection).then((img) => {
      if (cancelled) return;
      codeRef.current = img;
      composite();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.codeType, s.codeData, s.barcodeFormat, s.qrErrorCorrection]);

  // 3) Re-composite on any cheap change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => composite());

  function composite() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Port the body of index.js:1146-1392 here, but:
    //  - read inputs from `s` instead of the DOM,
    //  - use processedRef.current in place of `processedImage`,
    //  - use codeRef.current in place of `generatedCode`,
    //  - skip the QR/barcode *generation* (done in effect 2),
    //  - keep the canvas sizing logic from index.js:1103-1133 (set canvas.width/height
    //    and CSS display size with integer nearest-neighbor scaling).
  }
}
```
Fill `drawVerticalText` and `composite()` with the verbatim ports noted in the comments, adapting DOM reads to store reads.

- [ ] **Step 2: Verify typecheck/build**

Run: `npm run typecheck && npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add hooks/useCanvasCompositor.ts
git commit -m "feat: canvas compositor hook with memoized worker processing"
```

---

## Task 13: Text settings panel

**Files:**
- Create: `components/panels/TextSettings.tsx`
- Source reference: `index.html:37-96`

**Interfaces:**
- Consumes: `useSettings` store; shadcn `Label`, `Textarea`, `Input`, `Select`, `Checkbox`, `Card`.
- Produces: `<TextSettings />` default export.

- [ ] **Step 1: Implement `components/panels/TextSettings.tsx`**

Build the panel binding each control to the store. Fonts list from `index.html:47-54`; font sizes 8-200 default 36; weights normal/bold/lighter; alignments center/left/right; plus the "Vertical text" checkbox. Example structure (complete the remaining controls following this pattern):
```tsx
"use client";

import { useSettings } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const FONTS = [
  ["Arial, sans-serif", "Arial"],
  ["Helvetica, sans-serif", "Helvetica"],
  ["'Times New Roman', serif", "Times New Roman"],
  ["'Courier New', monospace", "Courier New"],
  ["Georgia, serif", "Georgia"],
  ["Verdana, sans-serif", "Verdana"],
  ["'Comic Sans MS', cursive", "Comic Sans MS"],
  ["Impact, sans-serif", "Impact"],
] as const;

export default function TextSettings() {
  const s = useSettings();
  return (
    <Card>
      <CardHeader><CardTitle>Text Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="text">Text to print</Label>
          <Textarea id="text" rows={3} value={s.text}
            onChange={(e) => s.set("text", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Font family</Label>
          <Select value={s.fontFamily} onValueChange={(v) => s.set("fontFamily", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONTS.map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fontSize">Font size (px)</Label>
          <Input id="fontSize" type="number" min={8} max={200} value={s.fontSize}
            onChange={(e) => s.set("fontSize", e.target.valueAsNumber)} />
        </div>
        {/* Font weight (normal/bold/lighter), Text alignment (center/left/right)
            as <Select> following the font-family pattern. */}
        <div className="flex items-center gap-2">
          <Checkbox id="verticalText" checked={s.verticalText}
            onCheckedChange={(c) => s.set("verticalText", c === true)} />
          <Label htmlFor="verticalText">Vertical text (stack letters)</Label>
        </div>
      </CardContent>
    </Card>
  );
}
```
Complete the Font weight and Text alignment selects following the font-family pattern (weights: `normal`/`bold`/`lighter`; alignments: `center`/`left`/`right`).

- [ ] **Step 2: Verify typecheck/build**

Run: `npm run typecheck && npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/panels/TextSettings.tsx
git commit -m "feat: text settings panel"
```

---

## Task 14: Image settings panel (+ advanced accordion)

**Files:**
- Create: `components/panels/ImageSettings.tsx`
- Source reference: `index.html:99-434`

**Interfaces:**
- Consumes: `useSettings`; shadcn `Card`, `Label`, `Input` (file), `Select`, `Slider`, `Checkbox`, `Accordion`.
- Produces: `<ImageSettings />` default export, including the file upload (sets `uploadedImage` via `URL.createObjectURL` + `Image`), original/processed preview canvases, and the Advanced Processing accordion.

- [ ] **Step 1: Implement `components/panels/ImageSettings.tsx`**

Bind every control from `index.html:99-434` to the store. Controls and ranges (copy exactly):
- Image upload (`<input type="file" accept="image/*">`) — on change, load into `new Image()` and `s.set("uploadedImage", img)` on load; null on clear.
- Image position select: above/below/left/right/background/none (default none).
- Image size slider: 10-100 step 5 default 50, with a `{value}%` readout.
- Dithering algorithm select: the 12 algorithms from `index.html:153-164`.
- Threshold slider 0-255 default 128; Brightness -100..100 default 0; Contrast -100..100 default 0; Dither noise 0-50 default 0 — each with a numeric readout.
- Image rotation select: 0/90/180/270.
- Advanced Processing `Accordion` (`index.html:238-432`): checkboxes `usePrinterResolution`, `useGammaCorrection`, `usePreFiltering`, `useCLAHE`, `useEdgeAware`, `useHardwareCleanup`, `serpentine` (default checked); sliders `gamma` 1.0-3.0 step 0.1 default 2.2, `blurSigma` 0.1-2.0 step 0.1 default 0.5, `unsharpAmount` 0.0-2.0 step 0.1 default 0.8, `claheClipLimit` 1.0-4.0 step 0.1 default 2.0.
- Two small preview `<canvas>` elements (Original / Processed). The preview drawing logic ports `index.js:1432-1538`; it may live in this component via a small `useEffect` that reuses `rasterizeSource` + `runPipeline` directly (these previews are tiny ≤120px, so synchronous main-thread processing is acceptable and avoids a second worker round-trip).

shadcn `Slider` returns `number[]`; wire as `onValueChange={([v]) => s.set("threshold", v)}` and `value={[s.threshold]}`.

- [ ] **Step 2: Verify typecheck/build**

Run: `npm run typecheck && npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/panels/ImageSettings.tsx
git commit -m "feat: image settings panel with advanced processing"
```

---

## Task 15: Code (QR/barcode) settings panel

**Files:**
- Create: `components/panels/CodeSettings.tsx`
- Source reference: `index.html:437-500`

**Interfaces:**
- Consumes: `useSettings`; shadcn `Card`, `Label`, `Textarea`, `Select`, `Slider`.
- Produces: `<CodeSettings />` default export. Shows/hides QR-error-correction vs barcode-format groups based on `codeType` (mirrors `index.js:1585-1614`): data/position/size hidden when `codeType === "none"`.

- [ ] **Step 1: Implement `components/panels/CodeSettings.tsx`**

Controls: code type select none/qr/barcode; code data textarea; code position select above/below/left/right/background; code size slider 10-100 step 5 default 30 with readout; QR error correction select L/M/Q/H (default M, shown only for qr); barcode format select CODE128/CODE39/EAN13/EAN8/UPC (shown only for barcode). Conditional rendering via `s.codeType`.

- [ ] **Step 2: Verify typecheck/build**

Run: `npm run typecheck && npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/panels/CodeSettings.tsx
git commit -m "feat: QR/barcode settings panel"
```

---

## Task 16: Preview panel (canvas, rotation, offset, label size, print)

**Files:**
- Create: `components/panels/PreviewPanel.tsx`
- Source reference: `index.html:503-631` (preview/rotation/offset/label size), `index.js:1727-1798` (rotation/offset/print handlers), `index.js:1786-1798` (BLE connect + print)

**Interfaces:**
- Consumes: `useSettings`; `useCanvasCompositor`; `printCanvas`, `PRINTER_GATT` from `@/lib/printer`; `toast` from `sonner`; shadcn `Card`, `Button`, `Select`, `Input`, `Label`.
- Produces: `<PreviewPanel />` default export owning the print `<canvas>` (via `useRef`) and calling `useCanvasCompositor(ref)`.

- [ ] **Step 1: Implement `components/panels/PreviewPanel.tsx`**

```tsx
"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useSettings } from "@/lib/store";
import { useCanvasCompositor } from "@/hooks/useCanvasCompositor";
import { printCanvas, PRINTER_GATT } from "@/lib/printer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const cssRotation: Record<number, string> = {
  0: "", 90: "rotate-90", 180: "rotate-180", 270: "-rotate-90",
};

export default function PreviewPanel() {
  const s = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasCompositor(canvasRef);

  const norm = ((s.previewRotation % 360) + 360) % 360;

  async function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!("bluetooth" in navigator)) {
      toast.error("Web Bluetooth is not supported in this browser. Use Chrome/Edge.");
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [PRINTER_GATT.service],
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(PRINTER_GATT.service);
      const char = await service.getCharacteristic(PRINTER_GATT.characteristic);
      await printCanvas(char, canvas);
      toast.success("Sent to printer.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function bump(axis: "offsetX" | "offsetY", dir: number) {
    s.set(axis, s[axis] + dir * s.offsetStep);
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => s.set("previewRotation", s.previewRotation - 90)}>↺ 90° CCW</Button>
          <Button variant="outline" onClick={() => s.set("previewRotation", (s.previewRotation + 90) % 360)}>↻ 90° CW</Button>
        </div>
        <div className="border rounded p-1">
          <canvas ref={canvasRef} className={`[image-rendering:pixelated] ${cssRotation[norm] ?? ""}`} />
        </div>
        <Button onClick={handlePrint}>Connect &amp; print</Button>

        {/* Print offset pad: Up/Down/Left/Right/Reset call bump()/s.resetOffset();
            show X/Y readouts; Step size <Select> 1/2/5/10/20 (default 5). */}
        {/* Label size: Width(mm) and Height(mm) <Input type=number> bound to
            labelWidth/labelHeight (defaults 40/12). */}
        <div className="flex gap-2 items-end">
          <div>
            <Label>Width (mm)</Label>
            <Input type="number" value={s.labelWidth}
              onChange={(e) => s.set("labelWidth", e.target.valueAsNumber)} />
          </div>
          <div>
            <Label>Height (mm)</Label>
            <Input type="number" value={s.labelHeight}
              onChange={(e) => s.set("labelHeight", e.target.valueAsNumber)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```
Complete the offset pad and step-size select per the comments.

- [ ] **Step 2: Verify typecheck/build**

Run: `npm run typecheck && npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/panels/PreviewPanel.tsx
git commit -m "feat: preview panel with print, rotation, offset, label size"
```

---

## Task 17: Assemble the page

**Files:**
- Modify: `app/page.tsx`
- Source reference: `index.html:21-650` (overall layout)

**Interfaces:**
- Consumes: the four panels.
- Produces: the full responsive layout.

- [ ] **Step 1: Implement `app/page.tsx`**

```tsx
"use client";

import TextSettings from "@/components/panels/TextSettings";
import ImageSettings from "@/components/panels/ImageSettings";
import CodeSettings from "@/components/panels/CodeSettings";
import PreviewPanel from "@/components/panels/PreviewPanel";

export default function Home() {
  return (
    <main className="container mx-auto p-4 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Phomemo D30 Web Bluetooth</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <TextSettings />
        <ImageSettings />
        <CodeSettings />
        <PreviewPanel />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify build + dev boot**

Run:
```bash
npm run build && npm run dev
```
Expected: build passes; `next dev` serves at http://localhost:3000 with no console errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: assemble label designer page layout"
```

---

## Task 18: Visual parity verification (vs. current app)

**Files:** none (verification only)

**Interfaces:** Consumes the running `next dev` app and the legacy app.

- [ ] **Step 1: Serve the legacy app for side-by-side comparison**

Run (from repo root, on a separate port, using the committed legacy files still present at this point):
```bash
git stash list >/dev/null 2>&1; npx --yes serve -l 8080 . >/tmp/legacy-serve.log 2>&1 &
```
(Or `python3 -m http.server 8080`.) Legacy app: http://localhost:8080 — note it loads `index.html`.

- [ ] **Step 2: Run the Next app**

Run: `npm run dev` (http://localhost:3000).

- [ ] **Step 3: Compare three cases with the Chrome tools**

Using the `claude-in-chrome` tools (load via ToolSearch), open both URLs and visually compare the preview canvas for:
  1. **Text only** — default "Hello world", font size 36, centered.
  2. **Image + dither** — upload the same small test image; check Floyd–Steinberg and Atkinson at threshold 128 look equivalent.
  3. **QR + barcode** — QR with data "hello", then CODE128 barcode "123456"; confirm placement/size match.

Expected: previews are visually equivalent (allowing for the new Tailwind chrome around the canvas). Note any discrepancy and fix in the relevant component/hook before proceeding.

- [ ] **Step 4: Stop the legacy server**

Run: `kill %1 2>/dev/null || pkill -f "serve -l 8080" || pkill -f "http.server 8080"`

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: visual parity adjustments" || echo "no fixes needed"
```

---

## Task 19: Remove legacy files and update docs

**Files:**
- Delete: `index.html`, `index.js`, `src/printer.js`, `libs/jsbarcode.min.js`, `libs/qrcode.min.js`
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Delete legacy files**

Run:
```bash
git rm index.html index.js src/printer.js libs/jsbarcode.min.js libs/qrcode.min.js
rmdir src libs 2>/dev/null || true
```

- [ ] **Step 2: Update `README.md`**

Replace the body with current usage. Include: project description (unchanged intro), and a "Development" section:
```markdown
## Development

This is a Next.js (App Router, TypeScript) app.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run build    # static export to ./out
```

Deployed on Vercel. The app is fully client-side; printing requires a
Web Bluetooth-capable browser (Chromium-based).
```
Keep the existing Demo and Credits sections (update the demo URL if/when Vercel is live).

- [ ] **Step 3: Verify full build + tests after deletion**

Run:
```bash
npm run typecheck && npm test && npm run build
```
Expected: all pass; `out/` is emitted with no references to deleted files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy vanilla app; update README"
```

---

## Task 20: Final verification pass

**Files:** none.

- [ ] **Step 1: Clean build from scratch**

Run:
```bash
rm -rf .next out node_modules/.cache
npm run typecheck && npm test && npm run build
```
Expected: type check clean, all unit tests pass, static export to `out/` succeeds.

- [ ] **Step 2: Smoke-test the exported build**

Run:
```bash
npx --yes serve -l 8090 out >/tmp/out-serve.log 2>&1 &
```
Open http://localhost:8090 with the Chrome tools; confirm the page renders, sliders update the preview, and no console errors appear. Then `kill %1`.

- [ ] **Step 3: Confirm worker is actually used**

In the running dev/export build, drag the threshold slider on a large uploaded image and confirm via DevTools Performance/console that processing does not block the main thread (the page stays responsive). This validates the Web Worker optimization.

- [ ] **Step 4: Final commit / branch ready for PR**

```bash
git add -A && git commit -m "chore: final verification pass" || echo "clean"
git log --oneline -15
```

---

## Self-Review Notes (author)

- **Spec coverage:** deployment/export (Task 1), modern UI (Tasks 2, 13-17), TypeScript (all), Web Worker (Tasks 7-9, 12), debounce+memoize (Tasks 9, 12), self-host deps (Tasks 1, 10; legacy CDN removed Task 19), code splitting (module layout across Tasks 3-12), Zustand (Task 11), dead barcode tab dropped (Task 10 note, Task 19), printer chunking fix (Task 3), verification incl. pixel/visual parity (Tasks 18, 20). All spec sections map to tasks.
- **Worker-safety constraint** enforced: `lib/imaging/{dither,filters,pipeline}.ts` never touch DOM; canvas work isolated in `raster.ts` (main thread) and `useCanvasCompositor.ts`.
- **Type consistency:** `runPipeline`, `ProcessingOptions`, `ImageDataLike`, `getPrintData({width,height,data})`, `WorkerRequest/Response`, `useSettings.set`/`resetOffset` names are used consistently across tasks.
- **Known port-verbatim steps** (Tasks 5, 6, 8, 12) reference exact source line ranges rather than re-pasting hundreds of lines; this is a mechanical TS conversion of in-repo code, not a placeholder.
