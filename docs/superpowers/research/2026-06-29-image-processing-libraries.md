# Image Processing Library Research
**Date:** 2026-06-29  
**Context:** Evaluating npm packages that could replace or strengthen the hand-rolled ~1000-line image processing pipeline in `index.js`, for the Next.js + TypeScript conversion (`output: 'export'`, static Vercel deploy, Web Worker target).

---

## Pipeline Inventory (What We Have Today)

| Category | Items |
|---|---|
| **Dithering** | Floyd-Steinberg, Atkinson, Stucki, Jarvis-Judice-Ninke, Sierra, Burkes, Ordered/Bayer (2×2, 4×4, 8×8), Blue-noise, Threshold, Two-phase diffusion |
| **Pre-filters** | Gamma correction, Gaussian blur, Unsharp mask, CLAHE |
| **Edge detection** | Sobel (used for edge-aware thresholding) |
| **Post-processing** | Hardware cleanup (despeckle + thin-line repair on 1-bit output) |
| **Tonal adjustment** | Brightness, contrast (with adjustable range), noise injection |
| **Scanning** | Serpentine error diffusion |
| **Geometry** | Image rotation, Lanczos scaling to exact printer resolution |

---

## Candidate Packages

---

### 1. `floyd-steinberg`
**npm:** https://www.npmjs.com/package/floyd-steinberg  
**Repo:** https://github.com/noopkat/floyd-steinberg

| Field | Value |
|---|---|
| Version | 1.0.6 |
| Last published | 2022-06-18 (4+ years stale) |
| Weekly downloads | ~6,700 |
| License | MIT |
| TypeScript types | None |
| Unpacked size | ~3 MB (inflated by bundled test PNG images; the actual JS is trivial) |
| Browser compat | Yes — operates on an ImageData-shaped plain object |
| Web Worker compat | Yes — pure typed-array math, no DOM |
| Next.js static export | No issues |

**What it covers:**  
Floyd-Steinberg error diffusion only. Uses luminance weights (R×0.299, G×0.587, B×0.110) and diffuses error with the classic 7/5/3/1 kernel. Hardcodes a threshold of 150.

**What it can't cover:**  
Every other algorithm in our pipeline. No configurable threshold, no brightness/contrast, no serpentine mode. The hardcoded threshold of 150 (vs our configurable 0–255) is a non-starter.

**Quality/maintenance risk:**  
No commits since 2022, no TypeScript, sub-7k downloads. The GitHub repo (noopkat/floyd-steinberg) looks abandoned.

**Verdict: Avoid.** Adds zero algorithms we don't already have, no types, stale, and less featureful than our own implementation.

---

### 2. `image-q`
**npm:** https://www.npmjs.com/package/image-q  
**Repo:** https://github.com/ibezkrovnyi/image-quantization

| Field | Value |
|---|---|
| Version | 4.0.0 |
| Last published | 2022-06-19 (4+ years stale) |
| Weekly downloads | ~3.5 million |
| License | MIT |
| TypeScript types | Yes (TypeScript-native) |
| Unpacked size | ~845 KB |
| Browser compat | Yes |
| Web Worker compat | Yes (pure typed arrays) |
| Next.js static export | No issues |

**What it covers:**  
Color quantization (NeuQuant, Wu, Xiaolin-Wu algorithms) and palette-reduction dithering including Floyd-Steinberg. High weekly downloads come from being an indirect dependency of GIF encoding libraries (`gifshot`, `gif.js`), not from direct use.

**What it can't cover:**  
Atkinson, Stucki, Jarvis, Sierra, Burkes, ordered/Bayer, blue-noise, serpentine, CLAHE, edge detection, gamma, unsharp mask. The library is fundamentally about reducing to a multi-color palette, not about 1-bit halftoning — those are different problem domains.

**Quality/maintenance risk:**  
No commits since 2022. High downloads are misleading (transitive dependency). The package itself is stable but unmaintained.

**Verdict: Avoid.** Different problem domain (palette quantization) vs. what we need (binary halftoning). We would adopt it only if we needed multi-color palette output.

---

### 3. `ditherjs`
**npm:** https://www.npmjs.com/package/ditherjs  
**Repo:** https://github.com/dpiccone/ditherjs

| Field | Value |
|---|---|
| Version | 0.10.0 |
| Last published | 2018-10-26 (8 years stale) |
| Weekly downloads | ~2,200 |
| License | **CC-BY-SA-4.0 — copyleft ShareAlike, NOT MIT** |
| TypeScript types | None |
| Unpacked size | ~371 KB |
| Browser compat | Yes (`"browser": {"canvas": false}` in package.json) |
| Web Worker compat | Yes |
| Next.js static export | No issues (but see license) |

**What it covers:**  
Floyd-Steinberg and ordered dithering. Has a demo/playground UI.

**What it can't cover:**  
Atkinson, Stucki, Jarvis, Sierra, Burkes, blue-noise, two-phase, serpentine, CLAHE, edge detection, configurable threshold.

**Quality/maintenance risk:**  
No commits since 2018 (not 2022 as indicated elsewhere — the npm modified date refers to registry metadata, not code). The CC-BY-SA-4.0 license is copyleft and requires derivative works to be shared under the same terms — atypical for a code library and potentially incompatible with the project's MIT dependency stack. The GitHub Pages demo site returns 404.

**Verdict: Avoid.** License is a hard blocker (CC-BY-SA-4.0 is copyleft). Also subset of what we have, no types, unmaintained.

---

### 4. `@opendisplay/epaper-dithering`
**npm:** https://www.npmjs.com/package/@opendisplay/epaper-dithering  
**Repo:** https://github.com/OpenDisplay/epaper-dithering

| Field | Value |
|---|---|
| Version | 5.0.7 |
| Last published | 2026-06-29 (published TODAY — actively maintained) |
| Weekly downloads | ~195 (niche e-paper community; not a vanity metric) |
| License | MIT |
| TypeScript types | Yes (full types bundled) |
| Unpacked size | Small — WASM binary is inlined, no external `.wasm` file to fetch |
| Browser compat | Yes — designed for browser use |
| Web Worker compat | Yes — WASM binary works in workers |
| Next.js static export | No issues — inlined WASM requires no special config |

**What it covers from our pipeline:**
- `FLOYD_STEINBERG`, `ATKINSON`, `BURKES`, `STUCKI`, `SIERRA`, `SIERRA_LITE`, `JARVIS_JUDICE_NINKE`, `ORDERED` (Bayer), `NONE` (threshold) — 9 algorithms total
- `ColorScheme.MONO` palette produces 1-bit (pure black/white) output directly
- Rust/WASM core — fast and accurate math

**What it can't cover:**
- `SIERRA` (only `SIERRA_LITE` + presumably Sierra-2 via `SIERRA`) — need to verify if full Sierra-3 is included
- Two-phase diffusion (our custom algorithm)
- Blue-noise ordered dithering
- Serpentine scanning (not exposed as an option)
- Edge-aware thresholding
- Brightness/contrast/noise injection pre-processing
- CLAHE, Gaussian blur, unsharp mask, hardware cleanup

**Quality/maintenance risk:**  
Published today. Active development. MIT. The low weekly download count reflects the niche (e-paper hardware hobbyists and professional display vendors), not poor quality. The inline WASM (no external binary fetch) is an architectural strength for static-export apps.

**Key compatibility note on WASM:**  
Unlike `@silvia-odwyer/photon` or OpenCV.js which require a separate `.wasm` file to be served/fetched, this package inlines the binary — meaning it loads synchronously from the npm bundle without any `asyncWebAssembly: true` Next.js config or CORS concerns.

**Verdict: Adopt (strongly recommended for the dithering layer).** This package covers 7 of our 10 dithering algorithms, is MIT, TypeScript-native, purpose-built for exactly our use case (e-paper and thermal printing), published today, and requires zero special bundler configuration. We would still hand-roll blue-noise, two-phase diffusion, and serpentine scanning, but the core error-diffusion algorithms can be offloaded here, eliminating ~200 lines of hand-maintained kernel math. Use this alongside our own serpentine/blue-noise/two-phase code for full coverage.

---

### 5. `canvas-dither`
**npm:** https://www.npmjs.com/package/canvas-dither  
**Repo:** https://github.com/NielsLeenheer/CanvasDither

| Field | Value |
|---|---|
| Version | 1.0.1 |
| Last published | 2020-08-17 |
| Weekly downloads | ~21,400 |
| License | MIT |
| TypeScript types | Not bundled (no `@types` package found) |
| Unpacked size | Very small (pure JS) |
| Browser compat | Yes — designed for canvas `ImageData` |
| Web Worker compat | Yes — pure typed-array math |
| Next.js static export | No issues |

**What it covers from our pipeline:**
- `Dither.threshold(imageData, threshold)` — threshold with configurable value
- `Dither.bayer(imageData, threshold)` — Bayer ordered dithering
- `Dither.floydSteinberg(imageData)` — Floyd-Steinberg
- `Dither.atkinson(imageData)` — Atkinson

**What it can't cover:**  
Stucki, Jarvis, Sierra, Burkes, blue-noise, two-phase, serpentine, brightness/contrast, CLAHE, edge detection.

**Quality/maintenance risk:**  
No updates since 2020 but the code is extremely simple (4 algorithms, pure JS). The 21K downloads/week is notable for a small dithering library, suggesting real-world usage in receipt printer and label printer projects.

**Verdict: Partial-adopt, lower priority than `@opendisplay/epaper-dithering`.** Has fewer algorithms and no TypeScript. Useful as a lightweight pure-JS fallback if WASM is not acceptable. Since `@opendisplay/epaper-dithering` is strictly better (more algorithms, TS, MIT, actively maintained), choose it instead.

---

### 6. `@thi.ng/pixel-dither`
**npm:** https://www.npmjs.com/package/@thi.ng/pixel-dither  
**Repo:** https://github.com/thi-ng/umbrella/tree/develop/packages/pixel-dither

| Field | Value |
|---|---|
| Version | 1.1.203 (auto-versioned in monorepo) |
| Last published | Active (continuous monorepo releases by @postspectacular) |
| Weekly downloads | ~31 (niche TypeScript ecosystem users) |
| License | Apache-2.0 |
| TypeScript types | Yes (TypeScript-native) |
| Unpacked size | Small (pure ESM TypeScript) |
| Browser compat | Yes (ESM) |
| Web Worker compat | Yes (pure JS, no DOM) |
| Next.js static export | No issues |

**What it covers from our pipeline:**
- `ATKINSON`, `BAYES` (Bayer ordered, configurable matrix size 2–16+ and configurable gray levels), `BURKES`, `DIFFUSION_1D`, `DIFFUSION_2D`, `FLOYD_STEINBERG`, `JARVIS_JUDICE_NINKE`, `SIERRA_2`, `STUCKI`, `THRESHOLD`, custom kernel support — 10+ algorithms
- The Bayer implementation is the most configurable in any npm package: matrix size and number of quantization levels are both tunable

**What it can't cover:**  
Two-phase diffusion, blue-noise, serpentine scanning, brightness/contrast, CLAHE, edge detection. Requires images be loaded through `@thi.ng/pixel`'s own `IntBuffer` type (not native `ImageData` directly), adding a conversion step.

**Quality/maintenance risk:**  
Part of the actively-maintained `@thi.ng/umbrella` monorepo (Karsten Schmidt / @postspectacular). Well-typed, well-tested. The Apache-2.0 license (not MIT) is permissive but differs from the rest of the project's MIT stack — worth noting.

**Verdict: Partial-adopt for Bayer/ordered dithering research.** If the project needs tunable Bayer matrices at sizes beyond 8×8, this is the only npm option. The `@thi.ng/pixel` wrapper requirement and Apache-2.0 license add complexity. Given that `@opendisplay/epaper-dithering` covers `ORDERED` and all error-diffusion algorithms, `@thi.ng/pixel-dither` is redundant for the core use case. Consider only if advanced Bayer research is needed.

---

### 7. `glur`
**npm:** https://www.npmjs.com/package/glur  
**Repo:** https://github.com/nodeca/glur

| Field | Value |
|---|---|
| Version | 2.0.0 |
| Last published | Active (nodeca organization maintains) |
| Weekly downloads | ~1,350,000 |
| License | MIT |
| TypeScript types | Yes (included in v2.0.0) |
| Unpacked size | **~12.5 KB** (extremely small) |
| Browser compat | Yes — pure typed-array math |
| Web Worker compat | Yes |
| Next.js static export | No issues |

**What it covers from our pipeline:**
- `blurRGBA(src: Uint8ClampedArray, width, height, radius)` — Fast IIR Gaussian blur that operates directly on `ImageData.data`
- `blurMono16(src: Uint16Array, width, height, radius)` — Grayscale 16-bit version
- Speed is **radius-independent** (IIR filter, O(n) regardless of sigma) — fundamentally faster than our hand-rolled Gaussian kernel for large sigma values

**What it can't cover:**  
Dithering, CLAHE, Sobel, unsharp mask (but we can implement unsharp mask on top of `glur` easily).

**Quality/maintenance risk:**  
1.35 million weekly downloads. Used as a transitive dependency in dozens of graphics libraries. 12.5 KB unpacked. Zero dependencies. Active maintenance by nodeca (same team as `pica` and `markdown-it`).

**API fit:**  
The `blurRGBA(src, width, height, radius)` signature maps perfectly to our `applyGaussianBlur(imgData, sigma)` — `src` is `imgData.data`, and radius maps to our `Math.ceil(sigma * 3)` kernel half-width. Wrapping it is 3 lines of code.

**Verdict: Adopt.** This is a direct, superior replacement for our hand-rolled `applyGaussianBlur`. 12.5 KB, MIT, TypeScript, 1.35M downloads, radius-independent speed, zero dependencies. Pull it in during the Next.js port as part of `lib/imaging/filters.ts`.

---

### 8. `jimp`
**npm:** https://www.npmjs.com/package/jimp  
**Repo:** https://github.com/jimp-dev/jimp

| Field | Value |
|---|---|
| Version | 1.6.1 |
| Last published | 2026-04-07 (actively maintained) |
| Weekly downloads | ~3.3 million |
| License | MIT |
| TypeScript types | Yes (bundled) |
| Unpacked size | ~3.3 MB |
| Browser compat | Yes — v1 added browser support; requires `buffer` polyfill (`vite-plugin-node-polyfills`) |
| Web Worker compat | Yes — v1 docs show a Web Worker example with `postMessage` |
| Next.js static export | Needs webpack/Next config for `buffer` polyfill |

**What it covers from our pipeline:**
- `dither()` — ordered dithering only (Bayer-style)
- `gaussian(r)` — Gaussian blur
- `blur(r)` — fast box blur
- `convolute(kernel)` — arbitrary 2D convolution (could implement unsharp mask, Sobel)
- `greyscale()` — luminance conversion (ITU Rec 709)
- `brightness(val)` — brightness adjustment
- `contrast(val)` — contrast adjustment

**What it can't cover:**
- Floyd-Steinberg or any error-diffusion dithering (only ordered/Bayer is built in)
- CLAHE
- Blue-noise dithering
- Serpentine scanning
- Hardware cleanup (despeckle / thin-line repair)
- Edge-aware thresholding
- Serpentine mode

**Quality/maintenance risk:**  
Actively maintained, 3.3M weekly downloads. Well-tested. v1 was a significant rewrite; ecosystem is stable.

**Key concern for this project:**  
Jimp's pixel loop is JavaScript, not WASM, so speed should be comparable to our hand-rolled code. The `buffer` polyfill requirement adds bundler complexity for Next.js `output: 'export'`. Most importantly, we would still need to hand-roll all error-diffusion dithering (our primary value-add).

**Verdict: Partial-adopt, low priority.** Jimp's `convolute()` and `blur()` could replace our Gaussian blur and unsharp mask implementations. However, the bundler polyfill requirement and the fact that we already have working, tested filter functions make this a "nice to have" rather than a clear win. Not recommended for the initial conversion.

---

### 9. `image-js`
**npm:** https://www.npmjs.com/package/image-js  
**Repo:** https://github.com/image-js/image-js

| Field | Value |
|---|---|
| Version | 1.6.2 |
| Last published | 2026-06-29 (TODAY — actively maintained by Zakodium) |
| Weekly downloads | ~39,700 |
| License | MIT |
| TypeScript types | Yes (TypeScript-native) |
| Unpacked size | ~12.4 MB (tree-shakeable; most of the bulk is image codec decoders) |
| Browser compat | Yes — has `src/index_browser.ts` export, ES module, no `browser` shim needed |
| Web Worker compat | Yes — filter functions operate on typed arrays with no DOM/canvas references |
| Next.js static export | No issues with tree-shaking |

**What it covers from our pipeline:**
- `gaussianBlur({ sigma })` — separable Gaussian with configurable sigma (matches our `applyGaussianBlur`)
- `blur()` — box blur
- `convolution(kernel)` — arbitrary 2D convolution (can implement unsharp mask, Sobel)
- `gradientFilter()` / `derivativeFilter()` — gradient computation (Sobel equivalent)
- `cannyEdgeDetector({ lowThreshold, highThreshold, gaussianBlurOptions })` — Canny edge detection (stronger than our Sobel)
- `threshold(options)` — multi-algorithm thresholding (Otsu, Huang, Yen, Li, etc.)
- `increaseContrast()` — histogram stretching
- `histogram()` — pixel value histogram
- Morphology: `erode()`, `dilate()`, `open()`, `close()`, `medianFilter()` (useful for hardware cleanup)

**What it can't cover:**
- CLAHE (no adaptive histogram equalization)
- Any dithering algorithm (not in scope for this library)
- Brightness/contrast adjustment in the style our pipeline uses (it has `level()` and `increaseContrast()` but different API)
- Blue-noise map generation
- Serpentine scanning
- Hardware cleanup (but morphological ops could replace it)

**Quality/maintenance risk:**  
Active commercial maintenance by Zakodium (scientific imaging company). Published today (v1.6.2). Well-typed, well-tested. Benchmark score 95.5 on Context7.

**Key concern for this project:**  
The 12.4 MB unpacked size is intimidating, but with tree-shaking only the imported functions bundle into the output. Importing just `gaussianBlur`, `cannyEdgeDetector`, and `threshold` should result in a modest bundle contribution. The library works on its own `Image` class (not raw `Uint8ClampedArray`), so there is a conversion cost: you need to wrap/unwrap our `ImageDataLike` objects. The conversion is trivial (`Image.fromCanvas()` / `.toImageData()` equivalents exist) but does add one extra typed-array allocation per pipeline run.

**Verdict: Partial-adopt, medium priority.** The Canny edge detector, Gaussian blur, and convolution APIs are higher quality than our hand-rolled versions and the library is clearly maintained. Worth considering as a replacement for `applyGaussianBlur`, `applyUnsharpMask`, and `detectEdges` during a future quality improvement pass. Not required for the initial Next.js port.

---

### 10. `@silvia-odwyer/photon`
**npm:** https://www.npmjs.com/package/@silvia-odwyer/photon  
**Repo:** https://github.com/silvia-odwyer/photon

| Field | Value |
|---|---|
| Version | 0.3.3 |
| Last published | 2025-05-10 |
| Weekly downloads | ~22,800 |
| License | Apache-2.0 |
| TypeScript types | Yes (`photon_rs.d.ts`) |
| Unpacked size | ~2.15 MB (includes `.wasm` binary) |
| Browser compat | Yes — primary use case; requires WASM init before use |
| Web Worker compat | Yes — WASM runs fine in workers |
| Next.js static export | Requires `next.config` WASM asset configuration; `asyncWebAssembly: true` or copy-plugin needed |

**What it covers from our pipeline:**
- `gaussian_blur(img, sigma)` — Gaussian blur with configurable sigma
- `sobel_horizontal(img)` / `sobel_vertical(img)` / `sobel_global(img)` — Sobel edge detection
- `sharpen(img)` — sharpening (replaces unsharp mask conceptually)
- `grayscale(img)` — greyscale conversion
- `adjust_contrast(img, level)` / `brightness(img, level)` — brightness and contrast

**What it can't cover:**
- Any dithering algorithm (not in the library)
- CLAHE
- Blue-noise generation
- Hardware cleanup / morphological ops
- Serpentine scanning
- Threshold / ordered dithering

**Quality/maintenance risk:**  
Moderate. The photon library is a well-known WASM showcase, but the npm package has been slow to update (0.3.3 since 2025-05-10, prior version was from much earlier). GitHub activity is sporadic. The Apache-2.0 license is generally permissive but different from our MIT dependency stack.

**Static export config concern:**  
Next.js `output: 'export'` with WASM requires special bundler config. The `.wasm` file must be served as a static asset and fetched asynchronously at runtime. This adds non-trivial plumbing: `next.config.mjs` must add `{ experiments: { asyncWebAssembly: true } }` plus Vercel needs to be configured to allow `.wasm` files. This is solvable but adds maintenance surface.

**Verdict: Partial-adopt, low-medium priority.** The WASM acceleration would only matter if profiling shows the pipeline is a bottleneck at real printer resolution (typically 320×96 pixels — tiny). At that scale, the pure-JS pipeline in a Web Worker is already fast enough. The static export WASM config overhead and Apache-2.0 license shift make adoption complexity outweigh the benefit. Revisit only if benchmarks reveal a problem.

---

### 11. `@techstark/opencv-js`
**npm:** https://www.npmjs.com/package/@techstark/opencv-js  
**Repo:** https://github.com/TechStark/opencv-js

| Field | Value |
|---|---|
| Version | 5.0.0-release.1 |
| Last published | 2026-06-24 (recent, tracks OpenCV releases) |
| Weekly downloads | ~109,900 |
| License | Apache-2.0 |
| TypeScript types | Yes |
| Unpacked size | **~14.7 MB** (enormous WASM binary) |
| Browser compat | Yes |
| Web Worker compat | Yes |
| Next.js static export | Same WASM concerns as Photon, amplified tenfold |

**What it covers from our pipeline:**
- `cv.createCLAHE(clipLimit, tileGridSize)` — native CLAHE implementation (the only package here with real CLAHE)
- `cv.GaussianBlur()` — Gaussian blur
- `cv.Sobel()` / `cv.Canny()` — edge detection
- `cv.threshold()` + `cv.adaptiveThreshold()` — thresholding
- Morphology: erode, dilate, open, close, etc.

**What it can't cover:**
- Dithering algorithms (not in OpenCV scope)

**Quality/maintenance risk:**  
Well-maintained fork of the official OpenCV WASM build. High download counts reflect real usage. However, the maintenance burden is on keeping up with OpenCV releases.

**Key disqualifier:**  
14.7 MB is too large for a static label-printing app. The initial WASM download alone would dwarf the rest of the application. Even with lazy loading, this is poor UX for a utility that should feel instant.

**Verdict: Avoid.** Bundle size is a hard blocker. The only compelling feature CLAHE provides over alternatives is not worth 14.7 MB. Our hand-rolled CLAHE works correctly and covers the use case.

---

### 12. `pica`
**npm:** https://www.npmjs.com/package/pica  
**Repo:** https://github.com/nodeca/pica

| Field | Value |
|---|---|
| Version | 10.0.2 |
| Last published | 2026-06-26 (very recent) |
| Weekly downloads | ~442,400 |
| License | MIT |
| TypeScript types | Yes (`dist/pica.cjs.d.ts`) |
| Unpacked size | ~1.2 MB |
| Browser compat | Yes — primary use case |
| Web Worker compat | Yes — internally uses workers; also works without them |
| Next.js static export | No issues |

**What it covers from our pipeline:**
- High-quality image resizing: Lanczos 2/3, MBox — directly replaces our `scaleToExactResolution` function
- The resize happens in a Web Worker internally (can accept an external worker pool)
- Alpha channel handling, sharpen post-resize option

**What it can't cover:**
- Dithering
- Filters (blur, CLAHE, etc.)
- It does one thing: resize.

**Quality/maintenance risk:**  
Well-maintained, 442K downloads/week, published three days ago. Widely used in file upload UIs across the ecosystem. Stable, lean, no concerns.

**Key value proposition for our project:**  
Our current `scaleToExactResolution` uses `canvas.imageSmoothingQuality = "high"` as a proxy for "Lanczos" — but browsers implement this internally with varying quality and it is NOT guaranteed to be true Lanczos. Pica delivers true Lanczos-3 resampling, which could meaningfully improve print quality when an image needs to be downscaled to the 320×96 printer canvas.

**Verdict: Adopt (optional enhancement).** Clean replacement for `scaleToExactResolution`. Minimal size, MIT, actively maintained. Worth pulling in during the Next.js port as part of the `lib/imaging/raster.ts` implementation. It runs on the main thread before the worker receives the `ImageData`, so it fits the existing architecture without changes.

---

### 13. `sharp` (for completeness)
**npm:** https://www.npmjs.com/package/sharp

| Field | Value |
|---|---|
| Weekly downloads | ~64.8 million |
| Browser compat | **No** — Node.js native bindings (libvips) only |

**Verdict: Avoid.** Node.js only; incompatible with browser/Web Worker/static export.

---

### 14. `gpu.js`
**npm:** https://www.npmjs.com/package/gpu.js

| Field | Value |
|---|---|
| Version | 2.16.0 |
| Last published | 2022-11-16 (~3.5 years stale) |
| Weekly downloads | ~15,400 |
| License | MIT |
| Unpacked size | ~2.4 MB |

**What it would cover:**  
GPU-accelerated parallel computation for filter loops. Useful for large-image blur or dithering in theory.

**Quality/maintenance risk:**  
No releases since November 2022. WebGPU has largely superseded the WebCL approach gpu.js pioneered. The library is in maintenance/abandoned status.

**Verdict: Avoid.** Abandoned, superseded by WebGPU (which is also not needed at 320×96 px printer resolution).

---

### 15. `marvinj`
**npm:** https://www.npmjs.com/package/marvinj

| Field | Value |
|---|---|
| License | UNLICENSED |
| Weekly downloads | ~372 |
| Last published | 2022-05-08 |

**Verdict: Avoid immediately.** UNLICENSED with 372 weekly downloads. Cannot be legally used.

---

## Summary Comparison Table

| Package | Dithering | Blur | CLAHE | Edge Detect | Scaling | Browser | Worker | Maintained | Size | License |
|---|---|---|---|---|---|---|---|---|---|---|
| `@opendisplay/epaper-dithering` | **9 algorithms** | No | No | No | No | Yes | Yes | **Yes (today)** | Small (inline WASM) | **MIT** |
| `canvas-dither` | 4 algorithms | No | No | No | No | Yes | Yes | No | Tiny | MIT |
| `@thi.ng/pixel-dither` | 10+ algorithms | No | No | No | No | Yes | Yes | Yes | Small | Apache-2.0 |
| `glur` | No | **Yes (IIR, fast)** | No | No | No | Yes | Yes | Yes | **12 KB** | MIT |
| `pica` | No | No | No | No | **Lanczos-3** | Yes | Yes | Yes | ~1.2 MB | MIT |
| `image-js` | None | Yes | No | Canny | No | Yes | Yes | **Yes (today)** | ~12 MB | MIT |
| `jimp` | Ordered only | Yes | No | No | No | Yes* | Yes* | Yes | ~3.3 MB | MIT |
| `@silvia-odwyer/photon` | None | Yes | No | Sobel | No | Yes | Yes | Partial | ~2.1 MB WASM | Apache-2.0 |
| `@techstark/opencv-js` | None | Yes | **Yes** | Yes | No | Yes | Yes | Yes | **14.7 MB WASM** | Apache-2.0 |
| `floyd-steinberg` | FS only | No | No | No | No | Yes | Yes | No | ~3 MB | MIT |
| `image-q` | FS only | No | No | No | No | Yes | Yes | No | ~845 KB | MIT |
| `ditherjs` | FS + Ordered | No | No | No | No | Yes | Yes | No | ~371 KB | **CC-BY-SA-4.0** |
| `sharp` | None | Yes | No | No | Yes | **No** | No | Yes | N/A | Apache-2.0 |

*Requires `buffer` polyfill in Next.js webpack config.

---

## Gap Analysis: What No Package Covers (After All Research)

The following pipeline features appear in no npm package with acceptable quality/maintenance/size:

1. **Serpentine scanning** — no library exposes this as a standalone feature. `@opendisplay/epaper-dithering` and `@thi.ng/pixel-dither` both omit it. Must remain hand-rolled.
2. **Two-phase diffusion** (ordered Bayer pass + Floyd-Steinberg refinement) — our custom algorithm; no library.
3. **Blue-noise ordered dithering** — no usable npm package for runtime blue noise. The correct approach (confirmed by the broader community) is to **embed a pre-generated 64×64 blue noise texture** as a hardcoded `Uint8Array` in the codebase. Free, CC0-licensed textures are available at momentsingraphics.de/BlueNoise.html. Our current "Mitchell's best-candidate approximation" in `generateBlueNoiseMap()` is algorithmically inferior to a properly void-and-cluster generated texture; this should be replaced with a bundled texture at conversion time (not a npm package).
4. **Edge-aware thresholding** (using Sobel/Canny output to modulate the per-pixel dither threshold) — no library; this is our custom combination of edge detection + dither.
5. **Hardware cleanup** (despeckle + thin-line repair on 1-bit output) — morphological `erode`/`dilate` in image-js could approximate it, but our domain-specific version (fill gaps in 1-px lines, remove isolated dots) is more precise for printer output.
6. **CLAHE** without an unacceptable WASM payload — `@techstark/opencv-js` (14.7 MB) and `wasm-vips` (requires COOP/COEP headers) both have hard disqualifiers. Our hand-rolled tile-based CLAHE is ~80 lines and correct for the use case. Keep it.

---

## Recommended Direction for a Future Improvement Plan

The following bullets describe what to actually pull in versus keep hand-rolled, given that this is a 1-bit thermal-printer use case where exact dithering control is the primary differentiator:

- **Adopt `@opendisplay/epaper-dithering` for the standard error-diffusion and ordered dithering algorithms.** It covers Floyd-Steinberg, Atkinson, Stucki, Jarvis-Judice-Ninke, Sierra, Burkes, and Bayer — 7 of our 10 dithering modes — with a MIT license, inline WASM (no async config), TypeScript types, and active maintenance as of today. This eliminates ~200 lines of kernel math from `lib/imaging/dither.ts`. We keep hand-rolled code only for: serpentine scanning (not exposed), two-phase diffusion (our custom algorithm), blue-noise (use pre-generated texture instead), and edge-aware thresholding (our custom combination).

- **Adopt `glur` for Gaussian blur** in `lib/imaging/filters.ts`. At 12.5 KB, MIT, TypeScript, 1.35M weekly downloads, and IIR speed (radius-independent), it is the obvious replacement for our hand-rolled `applyGaussianBlur`. Wrapping it is 3 lines: `blurRGBA(imgData.data, imgData.width, imgData.height, Math.ceil(sigma * 3))`. The unsharp mask (`applyUnsharpMask`) can be reimplemented on top of `glur` as: original + amount × (original − blurred).

- **Adopt `pica` for Lanczos scaling** in `lib/imaging/raster.ts`. It replaces `scaleToExactResolution` with provably better Lanczos-3 resampling (browser `imageSmoothingQuality: "high"` is not guaranteed to be Lanczos). MIT, 1.2 MB, 442K downloads/week, runs on the main thread before the worker receives the buffer — zero architecture changes required.

- **Replace `generateBlueNoiseMap` with a bundled pre-generated texture.** The current Mitchell's best-candidate approximation is slow and produces lower-quality blue noise than a proper void-and-cluster texture. Embed a 64×64 `Uint8Array` exported from `lib/imaging/blueNoise.ts`. Free CC0 textures are available at momentsingraphics.de/BlueNoise.html. This is not a package install — just a data file.

- **Keep CLAHE, serpentine scanning, two-phase diffusion, edge-aware thresholding, and hardware cleanup hand-rolled.** No library replaces CLAHE at an acceptable size; the others are custom algorithms with no library equivalent. These together are only ~300 lines of well-tested TypeScript and represent this app's actual differentiating behavior for thermal print quality.
