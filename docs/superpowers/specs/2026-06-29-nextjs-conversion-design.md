# Next.js Conversion + Optimization — Design

**Date:** 2026-06-29
**Status:** Approved (design)

## Summary

Convert the existing vanilla-JS Phomemo D30 Web Bluetooth label designer into a
TypeScript Next.js (App Router) application deployed on Vercel, with a modernized
Tailwind + shadcn/ui interface. All current features are preserved. The port also
lands four optimizations: a Web Worker for image processing, debounced/memoized
reprocessing, self-hosted (npm-bundled) dependencies, and a modular code split.

The app is 100% client-side: Web Bluetooth and Canvas only run in the browser.
Next.js is used purely as a build / bundling / component framework — there is no
SSR, no data fetching, no API routes. The build is kept static-export compatible
(`output: 'export'` viable) even though we deploy to Vercel.

## Goals

- Faithful feature parity with the current app (text, image + dithering pipeline,
  QR/barcode, live preview, print offset, label size, preview rotation, BLE print).
- TypeScript throughout, with the image-processing options properly typed.
- Modernized UI using Tailwind CSS + shadcn/ui (Bootstrap removed entirely).
- The four agreed optimizations (below).
- Deployable to Vercel; remains export-compatible.

## Non-goals

- No backend, accounts, persistence, or analytics.
- No new printing features or new dithering algorithms.
- No redesign of the dithering math itself — it is ported faithfully.

## Decisions (resolved during brainstorming)

- **Deployment:** Vercel (kept static-export compatible).
- **UI scope:** Port + modernize styling with Tailwind/shadcn, all features kept.
- **Language:** TypeScript.
- **Optimizations:** all four — Web Worker offload, debounce + memoize,
  self-host dependencies, code splitting.
- **State management:** Zustand (single typed settings store).
- **Cleanups confirmed:** drop the dead standalone `#nav-barcode` tab; fix the
  `printer.js` final-chunk slicing bug.

## Architecture

```
app/
  layout.tsx            # root layout, Tailwind globals, toast provider
  page.tsx              # 'use client' — composes panels + preview
components/
  panels/TextSettings.tsx
  panels/ImageSettings.tsx        # includes AdvancedProcessing accordion
  panels/CodeSettings.tsx         # QR / barcode
  panels/PreviewPanel.tsx         # canvas, rotation, offset, label size, print
  ui/...                          # shadcn primitives (slider, select, input, …)
lib/
  store.ts             # Zustand settings store (typed)
  printer.ts           # Web Bluetooth GATT (typed port of src/printer.js)
  imaging/
    dither.ts          # error-diffusion + ordered (Bayer) + blue-noise + two-phase
    filters.ts         # gamma, gaussian blur, unsharp, CLAHE, edge detect, cleanup
    pipeline.ts        # processImageWithAdjustments (pure, worker-safe)
    types.ts           # ProcessingOptions, DitherAlgorithm, etc.
  codes.ts             # QR + barcode generation (qrcode, jsbarcode)
  worker/
    imaging.worker.ts  # runs pipeline.ts off the main thread
    useImageProcessor.ts  # hook: debounce -> transfer -> receive ImageData
hooks/
  useCanvasCompositor.ts  # main-thread compositing (text + image + codes)
```

### State (Zustand)

A single typed store holds all ~30 settings, grouped logically:

- **text**: `text`, `fontFamily`, `fontSize`, `fontWeight`, `textAlign`, `verticalText`
- **image**: `uploadedImage` (HTMLImageElement | null), `imagePosition`, `imageSize`,
  `imageRotation`, `ditherAlgorithm`, `threshold`, `brightness`, `contrast`, `noise`
- **advanced**: `useGammaCorrection`, `gamma`, `usePreFiltering`, `blurSigma`,
  `unsharpAmount`, `useCLAHE`, `claheClipLimit`, `useEdgeAware`, `useHardwareCleanup`,
  `usePrinterResolution`, `serpentine`
- **codes**: `codeType`, `codeData`, `codePosition`, `codeSize`, `qrErrorCorrection`,
  `barcodeFormat`
- **layout/output**: `labelWidth`, `labelHeight`, `offsetX`, `offsetY`, `offsetStep`,
  `previewRotation`

Components subscribe only to the slices they render, so a keystroke in the text
field does not re-render the image panel. Derived/computed values (canvas pixel
dimensions, processed bitmap) are produced by hooks, not stored.

### Image processing pipeline (Web Worker)

The pure pixel functions move into `lib/imaging/` and run inside
`imaging.worker.ts`. Flow:

1. Main thread loads the uploaded image into an `HTMLImageElement`.
2. Main thread rasterizes it (apply rotation + optional printer-resolution scale)
   to an `ImageData` at the target size.
3. The `ImageData` `ArrayBuffer` is transferred (zero-copy) to the worker along
   with the `ProcessingOptions`.
4. Worker runs the pipeline (gamma -> CLAHE -> pre-filter -> edge map -> dither ->
   hardware cleanup) and transfers the processed 1-bit `ImageData` back.
5. Main thread composites: white background, processed image at its position,
   QR/barcode, then text (canvas-txt or vertical-text routine), honoring the print
   offset and the 90deg print orientation.

Rationale for `ImageData` transfer over OffscreenCanvas-in-worker: the existing
functions already operate on `ImageData`, transfer is broadly supported, and the
compositing (fonts, codes) is naturally a main-thread concern.

Light work stays on the main thread: text layout, QR/barcode raster generation,
and final compositing — none are per-pixel-heavy.

### Optimizations

1. **Web Worker offload** — all per-pixel loops run off-thread; UI never freezes.
2. **Debounce + memoize** — slider input debounced (~120ms) before triggering the
   worker. The processed bitmap recomputes only when image-affecting inputs change
   (image, algorithm, threshold, brightness, contrast, rotation, advanced flags).
   Changing text, offset, or code data no longer re-runs the pixel pipeline (today
   it always does). Compositing alone re-runs for those cheap changes.
3. **Self-host dependencies** — Bootstrap removed (replaced by Tailwind/shadcn).
   `qrcode`, `jsbarcode`, `canvas-txt` installed from npm and bundled. No runtime
   CDN fetches; works offline. Unused `libs/*.min.js` deleted.
4. **Code splitting** — monolithic `index.js` becomes the focused modules above;
   the imaging worker is loaded lazily.

### Printer module

`src/printer.js` -> `lib/printer.ts`, typed with `@types/web-bluetooth`. The
packet-chunking loop is rewritten to be correct (the current final iteration
computes `data.slice(i * PACKET_SIZE_BYTES, …)`, sending an empty write). Header
construction, white-pixel threshold (384), and byte-packing are ported verbatim so
the wire format is byte-identical to today.

### UI / styling

Tailwind + shadcn/ui primitives map 1:1 to the current Bootstrap controls:

- `Slider` (threshold, brightness, contrast, noise, sizes, gamma, blur, unsharp, CLAHE)
- `Select` (font family/weight, alignment, positions, algorithm, rotation, formats)
- `Input` / `Textarea` (text, dimensions, code data, font size)
- `Checkbox` (vertical text, advanced flags)
- `Accordion` (Advanced Processing)
- `Card`, `Button`, `ButtonGroup` (preview card, rotation/offset controls)
- `Sonner` toast (replaces the Bootstrap error toast)

The cramped 4-column layout is rebuilt as a responsive grid; all controls and
their ranges/defaults are preserved.

### Removed / cleaned up

- Dead `#nav-barcode` tab + standalone `#inputBarcode` (unreachable; the integrated
  QR/Barcode section already handles barcodes).
- `libs/jsbarcode.min.js`, `libs/qrcode.min.js` (unused; CDN/npm used instead).
- All Bootstrap CSS/JS.

## Error handling

- BLE failures (no device, connection lost, write error) surface via a toast,
  preserving current behavior.
- Invalid label dimensions / font size show a toast and abort the update, as today.
- Worker errors are caught and surfaced; the preview falls back to the last good
  bitmap rather than crashing.

## Testing / verification

- `next build` succeeds; `next dev` runs clean (no console errors).
- Visual parity check via Chrome browser tools against the current app for three
  cases: (a) text only, (b) image + a couple of dither algorithms, (c) QR + barcode.
- Pixel pipeline correctness: spot-check that `getPrintData` byte output for a known
  canvas matches the current implementation (the packing/threshold logic is ported
  verbatim).
- The physical BLE print path is a faithful logic port; final hardware confirmation
  is done by the user against their D30.

## Risks

- **Web Bluetooth availability** — unchanged from today (Chromium browsers only).
  No regression; surfaced to the user if `navigator.bluetooth` is absent.
- **Worker + Next.js bundling** — `imaging.worker.ts` must be wired via the
  `new Worker(new URL(...), { type: 'module' })` pattern Next supports; verified at
  build time.
- **Pixel parity** — the dithering math is ported function-for-function to avoid
  visual drift; verification step guards against accidental changes.
