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
  // Faithful to the original: strictly greater-than 384 (128*3). A pixel at
  // exactly mid-gray (sum 384) prints black, matching src/printer.js.
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
