# Phomemo D30 Web Bluetooth

Proof of concept and demo of printing to a [Phomemo D30](https://www.amazon.com/dp/B08HV3MPFD) Bluetooth label maker via the browser using Web Bluetooth.

## Demo

[A demo is available here.](https://odensc.github.io/phomemo-d30-web-bluetooth/) Please use a Web Bluetooth-compatible browser (e.g. Chromium-based).

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

## Credits

Inspiration for the data structure / image conversion was taken from some other great open-source projects. Thanks to:

- https://github.com/WebBluetoothCG/demos
- https://github.com/Knightro63/phomemo
