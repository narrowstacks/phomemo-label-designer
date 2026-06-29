import type { ImageDataLike } from "./types";

/**
 * Applies gamma correction to image data
 */
export const applyGammaCorrection = (
  imgData: ImageDataLike,
  gamma: number = 2.2
): ImageDataLike => {
  const { data } = imgData;
  const gammaLUT = new Uint8Array(256);

  // Build gamma lookup table
  for (let i = 0; i < 256; i++) {
    gammaLUT[i] = Math.round(255 * Math.pow(i / 255, gamma));
  }

  // Apply gamma correction
  for (let i = 0; i < data.length; i += 4) {
    data[i] = gammaLUT[data[i]]; // R
    data[i + 1] = gammaLUT[data[i + 1]]; // G
    data[i + 2] = gammaLUT[data[i + 2]]; // B
    // Alpha remains unchanged
  }

  return imgData;
};

/**
 * Applies Gaussian blur to image data
 */
export const applyGaussianBlur = (
  imgData: ImageDataLike,
  sigma: number = 0.5
): ImageDataLike => {
  if (sigma <= 0) return imgData;

  const { width, height, data } = imgData;
  const output = new Uint8ClampedArray(data);

  // Calculate kernel size and weights
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  const center = Math.floor(kernelSize / 2);
  let sum = 0;

  // Generate Gaussian kernel
  for (let i = 0; i < kernelSize; i++) {
    const x = i - center;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }

  // Normalize kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let i = 0; i < kernelSize; i++) {
        const px = Math.max(0, Math.min(width - 1, x + i - center));
        const idx = (y * width + px) * 4;
        const weight = kernel[i];

        r += data[idx] * weight;
        g += data[idx + 1] * weight;
        b += data[idx + 2] * weight;
      }

      const outIdx = (y * width + x) * 4;
      output[outIdx] = r;
      output[outIdx + 1] = g;
      output[outIdx + 2] = b;
      output[outIdx + 3] = data[outIdx + 3];
    }
  }

  // Copy back for vertical pass
  data.set(output);

  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let i = 0; i < kernelSize; i++) {
        const py = Math.max(0, Math.min(height - 1, y + i - center));
        const idx = (py * width + x) * 4;
        const weight = kernel[i];

        r += data[idx] * weight;
        g += data[idx + 1] * weight;
        b += data[idx + 2] * weight;
      }

      const outIdx = (y * width + x) * 4;
      output[outIdx] = r;
      output[outIdx + 1] = g;
      output[outIdx + 2] = b;
      output[outIdx + 3] = data[outIdx + 3];
    }
  }

  data.set(output);
  return imgData;
};

/**
 * Applies unsharp mask to enhance edges
 */
export const applyUnsharpMask = (
  imgData: ImageDataLike,
  radius: number = 1.0,
  amount: number = 0.8
): ImageDataLike => {
  const { width, height, data } = imgData;

  // Create a copy for the blurred version
  const blurred = new ImageData(new Uint8ClampedArray(data), width, height);
  applyGaussianBlur(blurred, radius);

  // Apply unsharp mask formula: original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      // RGB channels
      const original = data[i + c];
      const blur = blurred.data[i + c];
      const enhanced = original + amount * (original - blur);
      data[i + c] = Math.max(0, Math.min(255, enhanced));
    }
  }

  return imgData;
};

/**
 * Applies CLAHE (Contrast Limited Adaptive Histogram Equalization)
 */
export const applyCLAHE = (
  imgData: ImageDataLike,
  tileSize: number = 16,
  clipLimit: number = 2.0
): ImageDataLike => {
  const { width, height, data } = imgData;
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);

  // Convert to grayscale for processing
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Process each tile
  const processedGray = new Uint8Array(gray);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x1 = tx * tileSize;
      const y1 = ty * tileSize;
      const x2 = Math.min(x1 + tileSize, width);
      const y2 = Math.min(y1 + tileSize, height);

      // Build histogram for this tile
      const hist = new Array(256).fill(0);
      let pixelCount = 0;

      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          const val = gray[y * width + x];
          hist[val]++;
          pixelCount++;
        }
      }

      // Apply contrast limiting
      const excess = Math.max(0, Math.max(...hist) - (clipLimit * pixelCount) / 256);
      if (excess > 0) {
        const redistribution = excess / 256;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > (clipLimit * pixelCount) / 256) {
            hist[i] = (clipLimit * pixelCount) / 256;
          }
          hist[i] += redistribution;
        }
      }

      // Create CDF and mapping
      const cdf = new Array(256);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + hist[i];
      }

      // Normalize CDF to 0-255 range
      const mapping = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        mapping[i] = Math.round((cdf[i] / pixelCount) * 255);
      }

      // Apply mapping to tile
      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          const idx = y * width + x;
          processedGray[idx] = mapping[gray[idx]];
        }
      }
    }
  }

  // Apply processed grayscale back to RGB
  for (let i = 0; i < processedGray.length; i++) {
    const idx = i * 4;
    const originalGray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    const ratio = originalGray > 0 ? processedGray[i] / originalGray : 1;

    data[idx] = Math.min(255, data[idx] * ratio); // R
    data[idx + 1] = Math.min(255, data[idx + 1] * ratio); // G
    data[idx + 2] = Math.min(255, data[idx + 2] * ratio); // B
  }

  return imgData;
};

/**
 * Applies edge detection to identify important edges
 * @returns edge map (0-255)
 */
export const detectEdges = (imgData: ImageDataLike): Uint8Array => {
  const { width, height, data } = imgData;
  const edges = new Uint8Array(width * height);

  // Sobel kernels
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0,
        gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const intensity = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

          gx += intensity * sobelX[ky + 1][kx + 1];
          gy += intensity * sobelY[ky + 1][kx + 1];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }

  return edges;
};

/**
 * Applies hardware-safe cleanup to 1-bit image data
 */
export const applyHardwareCleanup = (imgData: ImageDataLike): ImageDataLike => {
  const { width, height, data } = imgData;
  const output = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // Check if this is a single black pixel with no black neighbors
      if (data[idx] === 0) {
        // Black pixel
        let blackNeighbors = 0;

        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (data[nIdx] === 0) blackNeighbors++;
          }
        }

        // Remove isolated single black pixels
        if (blackNeighbors === 0) {
          output[idx] = output[idx + 1] = output[idx + 2] = 255;
        }
      }

      // Thicken 1-pixel lines by checking for thin lines
      else if (data[idx] === 255) {
        // White pixel
        // Check for horizontal thin lines
        const leftBlack = x > 0 && data[(y * width + (x - 1)) * 4] === 0;
        const rightBlack = x < width - 1 && data[(y * width + (x + 1)) * 4] === 0;
        const topWhite = y > 0 && data[((y - 1) * width + x) * 4] === 255;
        const bottomWhite = y < height - 1 && data[((y + 1) * width + x) * 4] === 255;

        // Check for vertical thin lines
        const topBlack = y > 0 && data[((y - 1) * width + x) * 4] === 0;
        const bottomBlack = y < height - 1 && data[((y + 1) * width + x) * 4] === 0;
        const leftWhite = x > 0 && data[(y * width + (x - 1)) * 4] === 255;
        const rightWhite = x < width - 1 && data[(y * width + (x + 1)) * 4] === 255;

        // Fill gaps in thin lines (optional enhancement)
        if (
          (leftBlack && rightBlack && topWhite && bottomWhite) ||
          (topBlack && bottomBlack && leftWhite && rightWhite)
        ) {
          // This is a gap in a thin line - fill it
          output[idx] = output[idx + 1] = output[idx + 2] = 0;
        }
      }
    }
  }

  data.set(output);
  return imgData;
};
