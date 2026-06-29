import type { ImageDataLike, ProcessingOptions } from "./types";
import {
  applyGammaCorrection,
  applyGaussianBlur,
  applyUnsharpMask,
  applyCLAHE,
  detectEdges,
  applyHardwareCleanup,
} from "./filters";
import { ditherImageData, applyTwoPhaseDiffusion } from "./dither";

/**
 * Worker-safe core pipeline: ImageData in, 1-bit ImageData out.
 * Rotation / printer-resolution scaling happen on the main thread (canvas) before this.
 */
export function runPipeline(img: ImageDataLike, options: ProcessingOptions): ImageDataLike {
  let data: ImageDataLike = img;

  if (options.useGammaCorrection) data = applyGammaCorrection(data, options.gamma);
  if (options.useCLAHE) data = applyCLAHE(data, options.claheTileSize, options.claheClipLimit);
  if (options.usePreFiltering) {
    data = applyGaussianBlur(data, options.blurSigma);
    data = applyUnsharpMask(data, options.unsharpRadius, options.unsharpAmount);
  }

  const edgeMap = options.useEdgeAware ? detectEdges(data) : null;

  let processed: ImageDataLike;
  if (options.algorithm === "two_phase") {
    processed = applyTwoPhaseDiffusion(
      data,
      options.threshold,
      options.brightness,
      options.contrast,
      options.noise,
      edgeMap
    );
  } else {
    processed = ditherImageData(
      data,
      options.algorithm,
      options.threshold,
      options.brightness,
      options.contrast,
      options.noise,
      options.serpentine,
      edgeMap
    );
  }

  if (options.useHardwareCleanup) processed = applyHardwareCleanup(processed);

  return processed;
}
