"use client";

import { RefObject, useEffect, useMemo, useRef } from "react";
import { drawText } from "canvas-txt";
import { useSettings } from "@/lib/store";
import { useImageProcessor } from "@/lib/worker/useImageProcessor";
import { rasterizeSource } from "@/lib/imaging/raster";
import { generateCode } from "@/lib/codes";
import type { ProcessingOptions } from "@/lib/imaging/types";

// Verbatim port of index.js:1025-1084 (drawVerticalText), adapted to a local TS function.
function drawVerticalText(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    align: string;
  }
) {
  const { x, y, width, height, fontFamily, fontSize, fontWeight, align } = o;

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  // Filter out whitespace characters for proper centering
  const visibleChars = text.split("").filter((char) => char.trim());

  // Calculate total text height needed for stacking
  const lineHeight = fontSize * 1.2; // Add some spacing between letters
  const totalTextHeight = visibleChars.length * lineHeight;

  // Calculate center point for rotation
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Move to center and rotate -90 degrees
  ctx.translate(centerX, centerY);
  ctx.rotate(-Math.PI / 2);

  // In the rotated coordinate system:
  // - X axis now points up (was Y axis)
  // - Y axis now points left (was -X axis)
  // We want letters stacked vertically, so we need to vary the Y coordinate (which is now horizontal)

  // Calculate starting Y position (horizontal in rotated system) for centering
  const startY = -totalTextHeight / 2 + lineHeight / 2;
  let charX = 0;

  // Adjust X position based on alignment (vertical in rotated coordinate system)
  switch (align) {
    case "left":
      charX = -width / 2 + fontSize / 2;
      break;
    case "right":
      charX = width / 2 - fontSize / 2;
      break;
    case "center":
    default:
      charX = 0;
      break;
  }

  // Draw each visible character
  let charIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char.trim()) {
      // Only draw non-whitespace characters
      ctx.textAlign = "center";
      // In rotated system: X stays same, Y changes for stacking
      ctx.fillText(char, charX, startY + charIndex * lineHeight);
      charIndex++;
    }
  }

  ctx.restore();
}

export function useCanvasCompositor(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
    [
      s.algorithm,
      s.threshold,
      s.brightness,
      s.contrast,
      s.noise,
      s.serpentine,
      s.useGammaCorrection,
      s.gamma,
      s.usePreFiltering,
      s.blurSigma,
      s.unsharpAmount,
      s.useCLAHE,
      s.claheClipLimit,
      s.useEdgeAware,
      s.useHardwareCleanup,
    ]
  );

  // Apply canvas pixel + CSS display sizing — ported from index.js:1103-1133.
  // Image sent to printer is printed top to bottom, so width/height are reversed:
  // canvas pixel width = labelHeight*8, pixel height = labelWidth*8.
  // Accepts live state explicitly so async callers (Effects 1/2) paint with current values.
  function applyCanvasSize(
    canvas: HTMLCanvasElement,
    s: { labelHeight: number; labelWidth: number; previewRotation: number }
  ) {
    const actualCanvasWidth = s.labelHeight * 8;
    const actualCanvasHeight = s.labelWidth * 8;

    // Set canvas internal dimensions (for printing accuracy)
    canvas.width = actualCanvasWidth;
    canvas.height = actualCanvasHeight;

    // Reset canvas display size so the stage can be measured cleanly.
    canvas.style.width = "";
    canvas.style.height = "";

    // previewRotation is a purely visual CSS rotation (applied to the canvas in
    // PreviewPanel). When the label is shown on its side (90/270) its on-screen
    // footprint is the canvas dimensions swapped — we must size for that so the
    // bordered frame wraps the rotated label and the layout reserves the right
    // space.
    const norm = ((s.previewRotation % 360) + 360) % 360;
    const rotated = norm === 90 || norm === 270;

    // Available space comes from a stable stage element, NOT the wrapper we
    // resize below (measuring that would feed back into the scale).
    const stage = canvas.closest("[data-preview-stage]") as HTMLElement | null;
    const availWidth = stage?.clientWidth || 300;
    const availHeight = stage?.clientHeight || 300;

    // On-screen footprint after rotation — this is what must fit the stage.
    const footprintWidth = rotated ? actualCanvasHeight : actualCanvasWidth;
    const footprintHeight = rotated ? actualCanvasWidth : actualCanvasHeight;

    // Crisp integer (nearest-neighbour) scale when there's room; shrink
    // fractionally when the rotated label is larger than the stage.
    const fitScale = Math.min(
      availWidth / footprintWidth,
      availHeight / footprintHeight
    );
    const scale = fitScale >= 1 ? Math.floor(fitScale) : fitScale;

    canvas.style.width = actualCanvasWidth * scale + "px";
    canvas.style.height = actualCanvasHeight * scale + "px";
    // Nearest-neighbour scaling so the 1-bit preview stays crisp.
    canvas.style.imageRendering = "pixelated";

    // Size the bordered wrapper to the rotated bounding box so the frame matches
    // the visible (rotated) label and reserves correct layout space.
    const wrapper = canvas.parentElement;
    if (wrapper) {
      wrapper.style.width = footprintWidth * scale + "px";
      wrapper.style.height = footprintHeight * scale + "px";
    }
  }

  // Compositing + positioning — ported from index.js:1146-1392 (updateCanvasText),
  // adapted to read from the store and use processedRef/codeRef instead of DOM globals.
  // QR/barcode *generation* happens in effect 2; here we only draw codeRef.current.
  function composite() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Read live state at call time so async resolutions (Effects 1/2) always paint
    // with the current settings rather than the stale render-closure values.
    const s = useSettings.getState();

    // Keep canvas sizing in sync (index.js:1103-1133).
    applyCanvasSize(canvas, s);

    const text = s.text;
    const fontSize = s.fontSize;
    const fontFamily = s.fontFamily;
    const fontWeight = s.fontWeight;
    const textAlign = s.textAlign;
    const verticalText = s.verticalText;
    const imagePosition = s.imagePosition;
    const imageSize = s.imageSize;
    const codePosition = s.codePosition;
    const codeSize = s.codeSize;

    const processedImage = processedRef.current;
    const generatedCode = codeRef.current;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Disable smoothing so scaled content stays pixelated in the printed preview
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);

    // Apply print offset
    ctx.translate(s.offsetX, s.offsetY);

    const rotatedWidth = canvas.height;
    const rotatedHeight = canvas.width;

    // Handle image and code positioning
    const textArea = {
      x: -rotatedWidth / 2,
      y: -rotatedHeight / 2,
      width: rotatedWidth,
      height: rotatedHeight,
    };

    // Calculate space needed for codes and images
    let codeImageHeight = 0;
    let codeImageWidth = 0;

    // Calculate code dimensions if present
    if (generatedCode) {
      const codeSizeRatio = codeSize / 100;
      const maxCodeW = rotatedWidth * codeSizeRatio;
      const maxCodeH = rotatedHeight * codeSizeRatio;
      const codeScale = Math.min(
        maxCodeW / generatedCode.width,
        maxCodeH / generatedCode.height
      );
      codeImageWidth = generatedCode.width * codeScale;
      codeImageHeight = generatedCode.height * codeScale;
    }

    if (processedImage && imagePosition !== "none") {
      const imageSizeRatio = imageSize / 100;

      if (imagePosition === "background") {
        // Draw image as background first
        const maxW = rotatedWidth;
        const maxH = rotatedHeight;
        const scale =
          Math.min(maxW / processedImage.width, maxH / processedImage.height) *
          imageSizeRatio;
        const drawW = processedImage.width * scale;
        const drawH = processedImage.height * scale;

        ctx.globalAlpha = 0.3; // Make background image semi-transparent
        ctx.drawImage(processedImage, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.globalAlpha = 1.0;
      } else {
        // Calculate image dimensions
        const maxImageW = rotatedWidth * imageSizeRatio;
        const maxImageH = rotatedHeight * imageSizeRatio;
        const scale = Math.min(
          maxImageW / processedImage.width,
          maxImageH / processedImage.height
        );
        const imageW = processedImage.width * scale;
        const imageH = processedImage.height * scale;

        let imageX = 0;
        let imageY = 0;

        switch (imagePosition) {
          case "above":
            imageX = -imageW / 2;
            imageY = -rotatedHeight / 2;
            textArea.y = imageY + imageH + 10;
            textArea.height = rotatedHeight - imageH - 10;
            break;
          case "below":
            imageX = -imageW / 2;
            imageY = rotatedHeight / 2 - imageH;
            textArea.height = rotatedHeight - imageH - 10;
            break;
          case "left":
            imageX = -rotatedWidth / 2;
            imageY = -imageH / 2;
            textArea.x = imageX + imageW + 10;
            textArea.width = rotatedWidth - imageW - 10;
            break;
          case "right":
            imageX = rotatedWidth / 2 - imageW;
            imageY = -imageH / 2;
            textArea.width = rotatedWidth - imageW - 10;
            break;
        }

        // Draw the processed image
        ctx.drawImage(processedImage, imageX, imageY, imageW, imageH);
      }
    }

    // Draw QR code or barcode
    if (generatedCode && codePosition !== "background") {
      let codeX = 0;
      let codeY = 0;

      switch (codePosition) {
        case "above":
          codeX = -codeImageWidth / 2;
          codeY = textArea.y;
          textArea.y = codeY + codeImageHeight + 10;
          textArea.height = Math.max(0, textArea.height - codeImageHeight - 10);
          break;
        case "below":
          codeX = -codeImageWidth / 2;
          codeY = textArea.y + textArea.height - codeImageHeight;
          textArea.height = Math.max(0, textArea.height - codeImageHeight - 10);
          break;
        case "left":
          codeX = textArea.x;
          codeY = -codeImageHeight / 2;
          textArea.x = codeX + codeImageWidth + 10;
          textArea.width = Math.max(0, textArea.width - codeImageWidth - 10);
          break;
        case "right":
          codeX = textArea.x + textArea.width - codeImageWidth;
          codeY = -codeImageHeight / 2;
          textArea.width = Math.max(0, textArea.width - codeImageWidth - 10);
          break;
      }

      // Draw the generated code
      ctx.drawImage(generatedCode, codeX, codeY, codeImageWidth, codeImageHeight);
    } else if (generatedCode && codePosition === "background") {
      // Draw code as background
      ctx.globalAlpha = 0.2; // Make background code semi-transparent
      ctx.drawImage(
        generatedCode,
        -codeImageWidth / 2,
        -codeImageHeight / 2,
        codeImageWidth,
        codeImageHeight
      );
      ctx.globalAlpha = 1.0;
    }

    // Draw text
    if (text.trim()) {
      ctx.fillStyle = "#000";

      if (verticalText) {
        drawVerticalText(ctx, text, {
          x: textArea.x,
          y: textArea.y,
          width: textArea.width,
          height: textArea.height,
          fontFamily,
          fontSize,
          fontWeight,
          align: textAlign,
        });
      } else {
        drawText(ctx, text, {
          x: textArea.x,
          y: textArea.y,
          width: textArea.width,
          height: textArea.height,
          font: fontFamily,
          fontSize,
          fontWeight,
          align: textAlign,
          vAlign: "middle",
        });
      }
    }

    ctx.restore();
  }

  // 1) Process the uploaded image (memoized by image-affecting deps) via the worker.
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!s.uploadedImage || s.imagePosition === "none") {
      processedRef.current = null;
      composite();
      return;
    }

    // Printer pixel dimensions derived from the label size (index.js:1103-1104).
    const printerWidth = s.labelHeight * 8;
    const printerHeight = s.labelWidth * 8;

    const source = rasterizeSource(s.uploadedImage, {
      rotation: s.imageRotation,
      usePrinterResolution: s.usePrinterResolution,
      printerWidth,
      printerHeight,
      scalingMethod: "lanczos",
    });

    process(source, procOptions).then((out) => {
      // Null => superseded/debounced call: keep the last good bitmap, do nothing.
      if (cancelled || !out) return;
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
  }, [
    s.uploadedImage,
    s.imagePosition,
    s.imageRotation,
    s.usePrinterResolution,
    procOptions,
    s.labelWidth,
    s.labelHeight,
  ]);

  // 2) Generate code (memoized by code deps).
  useEffect(() => {
    let cancelled = false;
    const codeType = s.codeType;
    if (codeType === "none" || !s.codeData.trim()) {
      codeRef.current = null;
      composite();
      return;
    }
    generateCode(s.codeData, codeType, s.barcodeFormat, s.qrErrorCorrection)
      .then((img) => {
        if (cancelled) return;
        codeRef.current = img;
        composite();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Code generation failed:", err);
        codeRef.current = null;
        composite();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.codeType, s.codeData, s.barcodeFormat, s.qrErrorCorrection]);

  // 3) Re-composite on any cheap change (text, fonts, offsets, sizes, positions).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => composite());
}
