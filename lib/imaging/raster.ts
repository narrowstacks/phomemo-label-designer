// Main-thread only — uses document.createElement("canvas") and must NOT be imported by the worker.

type Source = CanvasImageSource & { width: number; height: number };

export function rotateImage(image: Source, angle: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Normalize angle to handle negative values
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Calculate new dimensions based on rotation
  if (normalizedAngle === 90 || normalizedAngle === 270) {
    canvas.width = image.height;
    canvas.height = image.width;
  } else {
    canvas.width = image.width;
    canvas.height = image.height;
  }

  // Fill with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Apply rotation (use original angle to preserve direction)
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  return canvas;
}

export function scaleToExactResolution(
  image: Source,
  targetWidth: number,
  targetHeight: number,
  method: "nearest" | "bilinear" | "lanczos" = "lanczos"
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Fill with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (method === "nearest") {
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = method === "lanczos" ? "high" : "medium";
  }

  // Scale to fit within target dimensions while maintaining aspect ratio
  const scaleX = targetWidth / image.width;
  const scaleY = targetHeight / image.height;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const offsetX = (targetWidth - scaledWidth) / 2;
  const offsetY = (targetHeight - scaledHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);

  return canvas;
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
