import type { ImageDataLike, DitherAlgorithm } from "./types";

/**
 * Generates a blue noise threshold map
 * @param size - size of the threshold map (power of 2)
 */
export const generateBlueNoiseMap = (size = 64): Uint8Array => {
  // Simple blue noise approximation using Mitchell's best-candidate algorithm
  const map = new Uint8Array(size * size);
  const used = new Array(size * size).fill(false);

  for (let i = 0; i < size * size; i++) {
    let bestDist = -1;
    let bestIdx = 0;

    // Try random candidates and pick the one with maximum distance to existing points
    for (let attempt = 0; attempt < Math.min(100, size * size - i); attempt++) {
      const candidate = Math.floor(Math.random() * size * size);
      if (used[candidate]) continue;

      let minDist = Infinity;
      for (let j = 0; j < size * size; j++) {
        if (!used[j]) continue;

        const x1 = candidate % size;
        const y1 = Math.floor(candidate / size);
        const x2 = j % size;
        const y2 = Math.floor(j / size);

        const dist = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
        minDist = Math.min(minDist, dist);
      }

      if (minDist > bestDist) {
        bestDist = minDist;
        bestIdx = candidate;
      }
    }

    used[bestIdx] = true;
    map[bestIdx] = Math.floor((i / (size * size)) * 256);
  }

  return map;
};

/**
 * Applies dithering to image data and returns a 1-bit black/white ImageData.
 */
export const ditherImageData = (
  imgData: ImageDataLike,
  algorithm: DitherAlgorithm = "floyd",
  threshold = 128,
  brightness = 0,
  contrast = 0,
  noise = 0,
  serpentine = true,
  edgeMap: Uint8Array | null = null
): ImageDataLike => {
  const { width, height, data } = imgData;
  const gray = new Float32Array(width * height);

  // Convert brightness and contrast from -100/100 range to usable values
  const brightnessAdjust = brightness * 2.55; // Convert to -255 to 255 range
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast)); // Standard contrast formula
  const noiseAmount = noise * 2.55; // Convert noise from 0-50 to 0-127.5 range

  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    // Apply brightness and contrast adjustments to each channel
    let adjustedR = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128 + brightnessAdjust));
    let adjustedG = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128 + brightnessAdjust));
    let adjustedB = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128 + brightnessAdjust));

    // Luminance formula with adjusted values
    let luminance = 0.299 * adjustedR + 0.587 * adjustedG + 0.114 * adjustedB;

    // Add random noise if specified
    if (noise > 0) {
      const randomNoise = (Math.random() - 0.5) * noiseAmount;
      luminance = Math.max(0, Math.min(255, luminance + randomNoise));
    }

    gray[i] = luminance;
  }

  const setBWPixel = (idx: number, val: number) => {
    data[idx * 4] = data[idx * 4 + 1] = data[idx * 4 + 2] = val;
    data[idx * 4 + 3] = 255;
  };

  // ----- Threshold dithering with edge-aware enhancement -----
  if (algorithm === "threshold") {
    for (let i = 0; i < gray.length; i++) {
      let adjustedThreshold = threshold;

      // Apply edge-aware threshold adjustment if edge map is provided
      if (edgeMap) {
        const edgeStrength = edgeMap[i] / 255;
        // Lower threshold for edges to preserve thin lines
        adjustedThreshold = threshold - edgeStrength * 30;
      }

      setBWPixel(i, gray[i] < adjustedThreshold ? 0 : 255);
    }
    return imgData;
  }

  // ----- Blue noise dithering -----
  if (algorithm === "blue_noise") {
    const noiseMap = generateBlueNoiseMap(64);
    const mapSize = 64;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const noiseIdx = (y % mapSize) * mapSize + (x % mapSize);
        const noiseThreshold = noiseMap[noiseIdx];

        let adjustedThreshold = noiseThreshold;
        if (edgeMap) {
          const edgeStrength = edgeMap[idx] / 255;
          adjustedThreshold = noiseThreshold - edgeStrength * 40;
        }

        setBWPixel(idx, gray[idx] < adjustedThreshold ? 0 : 255);
      }
    }
    return imgData;
  }

  // ----- Ordered dithering (Bayer matrices) -----
  if (algorithm.startsWith("ordered")) {
    let matrix: number[][];
    if (algorithm === "ordered2") {
      matrix = [
        [0, 2],
        [3, 1],
      ];
    } else if (algorithm === "ordered4") {
      matrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
      ];
    } else if (algorithm === "ordered8") {
      matrix = [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
      ];
    } else {
      // Default to 4x4 if unknown ordered size specified
      matrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
      ];
    }

    const n = matrix.length;
    const scale = 255 / (n * n);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let thresholdVal = (matrix[y % n][x % n] + 0.5) * scale;

        if (edgeMap) {
          const edgeStrength = edgeMap[idx] / 255;
          thresholdVal -= edgeStrength * 40;
        }

        setBWPixel(idx, gray[idx] < thresholdVal ? 0 : 255);
      }
    }

    return imgData;
  }

  // ----- Error diffusion algorithms -----
  // Define error diffusion kernels
  const errorKernels: Record<string, Array<{ x: number; y: number; weight: number }>> = {
    floyd: [
      { x: 1, y: 0, weight: 7 / 16 },
      { x: -1, y: 1, weight: 3 / 16 },
      { x: 0, y: 1, weight: 5 / 16 },
      { x: 1, y: 1, weight: 1 / 16 },
    ],
    atkinson: [
      { x: 1, y: 0, weight: 1 / 8 },
      { x: 2, y: 0, weight: 1 / 8 },
      { x: -1, y: 1, weight: 1 / 8 },
      { x: 0, y: 1, weight: 1 / 8 },
      { x: 1, y: 1, weight: 1 / 8 },
      { x: 0, y: 2, weight: 1 / 8 },
    ],
    stucki: [
      { x: 1, y: 0, weight: 8 / 42 },
      { x: 2, y: 0, weight: 4 / 42 },
      { x: -2, y: 1, weight: 2 / 42 },
      { x: -1, y: 1, weight: 4 / 42 },
      { x: 0, y: 1, weight: 8 / 42 },
      { x: 1, y: 1, weight: 4 / 42 },
      { x: 2, y: 1, weight: 2 / 42 },
      { x: -2, y: 2, weight: 1 / 42 },
      { x: -1, y: 2, weight: 2 / 42 },
      { x: 0, y: 2, weight: 4 / 42 },
      { x: 1, y: 2, weight: 2 / 42 },
      { x: 2, y: 2, weight: 1 / 42 },
    ],
    jarvis: [
      { x: 1, y: 0, weight: 7 / 48 },
      { x: 2, y: 0, weight: 5 / 48 },
      { x: -2, y: 1, weight: 3 / 48 },
      { x: -1, y: 1, weight: 5 / 48 },
      { x: 0, y: 1, weight: 7 / 48 },
      { x: 1, y: 1, weight: 5 / 48 },
      { x: 2, y: 1, weight: 3 / 48 },
      { x: -2, y: 2, weight: 1 / 48 },
      { x: -1, y: 2, weight: 3 / 48 },
      { x: 0, y: 2, weight: 5 / 48 },
      { x: 1, y: 2, weight: 3 / 48 },
      { x: 2, y: 2, weight: 1 / 48 },
    ],
    sierra: [
      { x: 1, y: 0, weight: 5 / 32 },
      { x: 2, y: 0, weight: 3 / 32 },
      { x: -2, y: 1, weight: 2 / 32 },
      { x: -1, y: 1, weight: 4 / 32 },
      { x: 0, y: 1, weight: 5 / 32 },
      { x: 1, y: 1, weight: 4 / 32 },
      { x: 2, y: 1, weight: 2 / 32 },
      { x: -1, y: 2, weight: 2 / 32 },
      { x: 0, y: 2, weight: 3 / 32 },
      { x: 1, y: 2, weight: 2 / 32 },
    ],
    burkes: [
      { x: 1, y: 0, weight: 8 / 32 },
      { x: 2, y: 0, weight: 4 / 32 },
      { x: -2, y: 1, weight: 2 / 32 },
      { x: -1, y: 1, weight: 4 / 32 },
      { x: 0, y: 1, weight: 8 / 32 },
      { x: 1, y: 1, weight: 4 / 32 },
      { x: 2, y: 1, weight: 2 / 32 },
    ],
  };

  const kernel = errorKernels[algorithm] || errorKernels.floyd;

  for (let y = 0; y < height; y++) {
    // Serpentine scanning: alternate left-to-right and right-to-left
    const direction = serpentine && y % 2 === 1 ? -1 : 1;
    const startX = direction === 1 ? 0 : width - 1;
    const endX = direction === 1 ? width : -1;

    for (let x = startX; x !== endX; x += direction) {
      const idx = y * width + x;
      const oldVal = gray[idx];

      let adjustedThreshold = threshold;
      if (edgeMap) {
        const edgeStrength = edgeMap[idx] / 255;
        // Lower threshold for edges to preserve detail
        adjustedThreshold = threshold - edgeStrength * 20;
      }

      const newVal = oldVal < adjustedThreshold ? 0 : 255;
      const err = oldVal - newVal;
      gray[idx] = newVal;
      setBWPixel(idx, newVal);

      // Distribute error to neighboring pixels
      for (const { x: dx, y: dy, weight } of kernel) {
        const nx = x + dx * direction; // Account for serpentine direction
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          gray[nIdx] += err * weight;
        }
      }
    }
  }

  return imgData;
};

/**
 * Applies two-phase diffusion (ordered dither + error diffusion)
 */
export const applyTwoPhaseDiffusion = (
  imgData: ImageDataLike,
  threshold: number,
  brightness: number,
  contrast: number,
  noise: number,
  edgeMap: Uint8Array | null
): ImageDataLike => {
  // Phase 1: Light ordered dithering (4x4 Bayer)
  const phase1 = ditherImageData(
    new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height),
    "ordered4",
    threshold,
    brightness,
    contrast,
    noise,
    false, // No serpentine for ordered
    null
  );

  // Phase 2: Light Floyd-Steinberg on the result
  return ditherImageData(
    phase1,
    "floyd",
    threshold + 10, // Slightly higher threshold for refinement
    0, // No additional brightness/contrast adjustment
    0,
    0,
    true, // Use serpentine
    edgeMap
  );
};
