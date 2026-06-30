# Phomemo D30 Label Designer

A browser-based label designer for the [Phomemo D30](https://www.amazon.com/dp/B08HV3MPFD)
Bluetooth label maker. Design labels with text, images, QR codes, and barcodes,
preview them live, and print directly from the browser over [Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) — no app or driver required.

**[Try it live → phomemo-label-designer.vercel.app](https://phomemo-label-designer.vercel.app/)**
(use a Chromium-based browser to print).

> This project began as a fork of [**odensc/phomemo-d30-web-bluetooth**](https://github.com/odensc/phomemo-d30-web-bluetooth),
> a proof of concept for talking to the D30 from the browser. It has since been
> rebuilt as a full Next.js label designer with a real-time editor, image
> processing pipeline, and code generation. See [Credits](#credits) below.

## Features

- **Text labels** — compose and lay out text with adjustable typography.
- **Images** — drop in an image and run it through a tunable processing
  pipeline (brightness/contrast filters, threshold, and dithering) so it prints
  cleanly on a 1-bit thermal printer.
- **QR codes & barcodes** — generate QR codes (with selectable error
  correction) and barcodes (`CODE128`, `CODE39`, `EAN13`, `EAN8`, `UPC`).
- **Live preview** — see the rendered label, oriented to match how it actually
  prints, before sending it to the device.
- **Direct printing** — connects to the D30 over Web Bluetooth and rasterizes
  the canvas into the printer's native packet format.
- **Off-main-thread imaging** — image processing runs in a Web Worker to keep
  the UI responsive.

## Requirements

Printing requires a **Web Bluetooth–capable browser** — a Chromium-based browser
(Chrome, Edge, Brave, etc.) on a platform that supports Web Bluetooth. The
designer and preview work in any modern browser; only the connect-and-print step
needs Web Bluetooth.

## Development

This is a [Next.js](https://nextjs.org/) (App Router, TypeScript) app, styled
with Tailwind CSS and using Zustand for state.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run build      # static export to ./out
npm run typecheck  # tsc --noEmit
```

The imaging Web Worker is precompiled to `public/imaging.worker.js` via esbuild
on `predev`/`prebuild`, so it works correctly in the static export.

The app is fully client-side and deploys cleanly to static hosts (Vercel, GitHub
Pages, etc.).

### Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router entry (`page.tsx`, `layout.tsx`) |
| `components/panels/` | Editor panels: text, image, codes, preview |
| `lib/imaging/` | Filters, threshold, dithering, and rasterization |
| `lib/worker/` | Web Worker that runs the imaging pipeline |
| `lib/printer.ts` | Web Bluetooth + D30 packet protocol |
| `lib/codes.ts` | QR code and barcode generation |
| `__tests__/` | Vitest unit tests |

## Credits

This project is built on the work of others — many thanks to:

- **[odensc/phomemo-d30-web-bluetooth](https://github.com/odensc/phomemo-d30-web-bluetooth)**
  — the original proof of concept this project was forked from, which worked out
  printing to the D30 from the browser via Web Bluetooth.
- [WebBluetoothCG/demos](https://github.com/WebBluetoothCG/demos) — Web Bluetooth
  reference demos.
- [Knightro63/phomemo](https://github.com/Knightro63/phomemo) — reference for the
  printer data structure and image conversion.
