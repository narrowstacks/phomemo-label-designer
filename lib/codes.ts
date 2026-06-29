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
