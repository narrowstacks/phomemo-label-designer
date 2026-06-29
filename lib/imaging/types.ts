export type DitherAlgorithm =
  | "floyd"
  | "atkinson"
  | "stucki"
  | "jarvis"
  | "sierra"
  | "burkes"
  | "threshold"
  | "ordered2"
  | "ordered4"
  | "ordered8"
  | "blue_noise"
  | "two_phase";

export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** Options consumed by the pure pixel pipeline (worker-safe). */
export interface ProcessingOptions {
  algorithm: DitherAlgorithm;
  threshold: number; // 0-255
  brightness: number; // -100..100
  contrast: number; // -100..100
  noise: number; // 0..50
  serpentine: boolean;
  // advanced
  useGammaCorrection: boolean;
  gamma: number;
  usePreFiltering: boolean;
  blurSigma: number;
  unsharpRadius: number;
  unsharpAmount: number;
  useCLAHE: boolean;
  claheClipLimit: number;
  claheTileSize: number;
  useEdgeAware: boolean;
  useHardwareCleanup: boolean;
}

export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  algorithm: "floyd",
  threshold: 128,
  brightness: 0,
  contrast: 0,
  noise: 0,
  serpentine: true,
  useGammaCorrection: false,
  gamma: 2.2,
  usePreFiltering: false,
  blurSigma: 0.5,
  unsharpRadius: 1.0,
  unsharpAmount: 0.8,
  useCLAHE: false,
  claheClipLimit: 2.0,
  claheTileSize: 16,
  useEdgeAware: false,
  useHardwareCleanup: false,
};
