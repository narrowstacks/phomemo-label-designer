"use client";

import { useRef, useEffect } from "react";
import { useSettings } from "@/lib/store";
import type { ImagePosition } from "@/lib/store";
import type { DitherAlgorithm } from "@/lib/imaging/types";
import { rasterizeSource } from "@/lib/imaging/raster";
import { runPipeline } from "@/lib/imaging/pipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const IMAGE_POSITIONS: [ImagePosition, string][] = [
  ["above", "Above text"],
  ["below", "Below text"],
  ["left", "Left of text"],
  ["right", "Right of text"],
  ["background", "Behind text"],
  ["none", "None (text only)"],
];

const DITHER_ALGORITHMS: [DitherAlgorithm, string][] = [
  ["floyd", "Floyd–Steinberg"],
  ["atkinson", "Atkinson"],
  ["stucki", "Stucki"],
  ["jarvis", "Jarvis-Judice-Ninke"],
  ["sierra", "Sierra"],
  ["burkes", "Burkes"],
  ["threshold", "Threshold"],
  ["ordered2", "Ordered Bayer 2x2"],
  ["ordered4", "Ordered Bayer 4x4"],
  ["ordered8", "Ordered Bayer 8x8"],
  ["blue_noise", "Blue Noise"],
  ["two_phase", "Two-Phase Diffusion"],
];

const IMAGE_ROTATIONS: [string, string][] = [
  ["0", "0°"],
  ["90", "90°"],
  ["180", "180°"],
  ["270", "270°"],
];

const MAX_PREVIEW_DIM = 120;

/** Helper to extract a scalar value from a base-ui Slider's onValueChange payload. */
function sv(v: number | readonly number[]): number {
  return typeof v === "number" ? v : v[0];
}

export default function ImageSettings() {
  const s = useSettings();
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      s.set("uploadedImage", null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      s.set("uploadedImage", img);
    };
    img.src = url;
  }

  // Preview canvas effect — re-runs when uploadedImage or processing settings change
  useEffect(() => {
    const origCanvas = originalCanvasRef.current;
    const procCanvas = processedCanvasRef.current;
    if (!origCanvas || !procCanvas) return;

    if (!s.uploadedImage) {
      // Clear both canvases when no image
      const oc = origCanvas.getContext("2d");
      const pc = procCanvas.getContext("2d");
      if (oc) oc.clearRect(0, 0, origCanvas.width, origCanvas.height);
      if (pc) pc.clearRect(0, 0, procCanvas.width, procCanvas.height);
      return;
    }

    const img = s.uploadedImage;

    // --- Original (un-rotated) preview ---
    const origScale = Math.min(
      1,
      MAX_PREVIEW_DIM / Math.max(img.width, img.height)
    );
    const origW = Math.round(img.width * origScale);
    const origH = Math.round(img.height * origScale);

    origCanvas.width = origW;
    origCanvas.height = origH;
    origCanvas.style.width = origW + "px";
    origCanvas.style.height = origH + "px";
    origCanvas.style.imageRendering = "pixelated";

    const origCtx = origCanvas.getContext("2d");
    if (origCtx) {
      origCtx.imageSmoothingEnabled = false;
      origCtx.clearRect(0, 0, origW, origH);
      origCtx.drawImage(img, 0, 0, origW, origH);
    }

    // --- Processed (may be rotated) preview ---
    const imageData = rasterizeSource(img, {
      rotation: s.imageRotation,
      usePrinterResolution: false, // don't scale to printer resolution for tiny preview
      printerWidth: 384,
      printerHeight: 96,
    });

    const processed = runPipeline(imageData, {
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
    });

    // Draw processed result to a temp canvas then scale into procCanvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = processed.width;
    tempCanvas.height = processed.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    const tempImgData = new ImageData(
      new Uint8ClampedArray(processed.data),
      processed.width,
      processed.height
    );
    tempCtx.putImageData(tempImgData, 0, 0);

    const procScale = Math.min(
      1,
      MAX_PREVIEW_DIM / Math.max(processed.width, processed.height)
    );
    const procW = Math.round(processed.width * procScale);
    const procH = Math.round(processed.height * procScale);

    procCanvas.width = procW;
    procCanvas.height = procH;
    procCanvas.style.width = procW + "px";
    procCanvas.style.height = procH + "px";
    procCanvas.style.imageRendering = "pixelated";

    const procCtx = procCanvas.getContext("2d");
    if (procCtx) {
      procCtx.imageSmoothingEnabled = false;
      procCtx.clearRect(0, 0, procW, procH);
      procCtx.drawImage(tempCanvas, 0, 0, procW, procH);
    }
  }, [
    s.uploadedImage,
    s.imageRotation,
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
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview canvases — shown only when an image is loaded */}
        {s.uploadedImage && (
          <div className="space-y-1">
            <Label>Image preview</Label>
            <div className="flex gap-2">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Original</p>
                <canvas
                  ref={originalCanvasRef}
                  className="border rounded max-w-[120px]"
                />
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Processed</p>
                <canvas
                  ref={processedCanvasRef}
                  className="border rounded max-w-[120px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* File upload */}
        <div className="space-y-2">
          <Label htmlFor="inputImage">Upload image</Label>
          <Input
            id="inputImage"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        {/* Image position */}
        <div className="space-y-2">
          <Label>Image position</Label>
          <Select
            value={s.imagePosition}
            onValueChange={(v) => {
              if (v !== null) s.set("imagePosition", v as ImagePosition);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_POSITIONS.map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Image size */}
        <div className="space-y-2">
          <Label>
            Image size (%) — <span className="font-mono">{s.imageSize}%</span>
          </Label>
          <Slider
            min={10}
            max={100}
            step={5}
            value={[s.imageSize]}
            onValueChange={(v) => s.set("imageSize", sv(v))}
          />
        </div>

        {/* Dithering algorithm */}
        <div className="space-y-2">
          <Label>Dithering algorithm</Label>
          <Select
            value={s.algorithm}
            onValueChange={(v) => {
              if (v !== null) s.set("algorithm", v as DitherAlgorithm);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DITHER_ALGORITHMS.map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Threshold */}
        <div className="space-y-2">
          <Label>
            Threshold — <span className="font-mono">{s.threshold}</span>
          </Label>
          <Slider
            min={0}
            max={255}
            step={1}
            value={[s.threshold]}
            onValueChange={(v) => s.set("threshold", sv(v))}
          />
        </div>

        {/* Brightness */}
        <div className="space-y-2">
          <Label>
            Brightness — <span className="font-mono">{s.brightness}</span>
          </Label>
          <Slider
            min={-100}
            max={100}
            step={1}
            value={[s.brightness]}
            onValueChange={(v) => s.set("brightness", sv(v))}
          />
        </div>

        {/* Contrast */}
        <div className="space-y-2">
          <Label>
            Contrast — <span className="font-mono">{s.contrast}</span>
          </Label>
          <Slider
            min={-100}
            max={100}
            step={1}
            value={[s.contrast]}
            onValueChange={(v) => s.set("contrast", sv(v))}
          />
        </div>

        {/* Dither noise */}
        <div className="space-y-2">
          <Label>
            Dither noise — <span className="font-mono">{s.noise}</span>{" "}
            <span className="text-muted-foreground text-xs">(adds randomness)</span>
          </Label>
          <Slider
            min={0}
            max={50}
            step={1}
            value={[s.noise]}
            onValueChange={(v) => s.set("noise", sv(v))}
          />
        </div>

        {/* Image rotation */}
        <div className="space-y-2">
          <Label>Image rotation</Label>
          <Select
            value={String(s.imageRotation)}
            onValueChange={(v) => {
              if (v !== null) s.set("imageRotation", Number(v));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_ROTATIONS.map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Processing accordion */}
        <Accordion className="mt-4">
          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced Processing</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">

                {/* Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="usePrinterResolution"
                      checked={s.usePrinterResolution}
                      onCheckedChange={(c) => s.set("usePrinterResolution", c === true)}
                    />
                    <div>
                      <Label htmlFor="usePrinterResolution">Scale to printer resolution</Label>
                      <p className="text-xs text-muted-foreground">Scales image to exact printer DPI for optimal quality</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="useGammaCorrection"
                      checked={s.useGammaCorrection}
                      onCheckedChange={(c) => s.set("useGammaCorrection", c === true)}
                    />
                    <div>
                      <Label htmlFor="useGammaCorrection">Gamma correction</Label>
                      <p className="text-xs text-muted-foreground">Converts screen gamma to printer linear response</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="usePreFiltering"
                      checked={s.usePreFiltering}
                      onCheckedChange={(c) => s.set("usePreFiltering", c === true)}
                    />
                    <div>
                      <Label htmlFor="usePreFiltering">Pre-filtering (blur + sharpen)</Label>
                      <p className="text-xs text-muted-foreground">Reduces noise and enhances edges before dithering</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="useCLAHE"
                      checked={s.useCLAHE}
                      onCheckedChange={(c) => s.set("useCLAHE", c === true)}
                    />
                    <div>
                      <Label htmlFor="useCLAHE">CLAHE contrast enhancement</Label>
                      <p className="text-xs text-muted-foreground">Adaptive histogram equalization for better details</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="useEdgeAware"
                      checked={s.useEdgeAware}
                      onCheckedChange={(c) => s.set("useEdgeAware", c === true)}
                    />
                    <div>
                      <Label htmlFor="useEdgeAware">Edge-aware dithering</Label>
                      <p className="text-xs text-muted-foreground">Preserves thin lines and important edges</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="useHardwareCleanup"
                      checked={s.useHardwareCleanup}
                      onCheckedChange={(c) => s.set("useHardwareCleanup", c === true)}
                    />
                    <div>
                      <Label htmlFor="useHardwareCleanup">Hardware-safe cleanup</Label>
                      <p className="text-xs text-muted-foreground">Removes isolated pixels and thickens thin lines</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="serpentine"
                      checked={s.serpentine}
                      onCheckedChange={(c) => s.set("serpentine", c === true)}
                    />
                    <div>
                      <Label htmlFor="serpentine">Serpentine scanning</Label>
                      <p className="text-xs text-muted-foreground">Alternates scan direction to reduce banding</p>
                    </div>
                  </div>
                </div>

                {/* Gamma slider */}
                <div className="space-y-2">
                  <Label>
                    Gamma value —{" "}
                    <span className="font-mono">{s.gamma.toFixed(1)}</span>{" "}
                    <span className="text-muted-foreground text-xs">(2.2 = standard screen gamma)</span>
                  </Label>
                  <Slider
                    min={1.0}
                    max={3.0}
                    step={0.1}
                    value={[s.gamma]}
                    onValueChange={(v) => s.set("gamma", sv(v))}
                  />
                </div>

                {/* Pre-blur sigma */}
                <div className="space-y-2">
                  <Label>
                    Pre-blur strength —{" "}
                    <span className="font-mono">{s.blurSigma.toFixed(1)}</span>{" "}
                    <span className="text-muted-foreground text-xs">(reduces noise before dithering)</span>
                  </Label>
                  <Slider
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    value={[s.blurSigma]}
                    onValueChange={(v) => s.set("blurSigma", sv(v))}
                  />
                </div>

                {/* Edge enhancement (unsharpAmount) */}
                <div className="space-y-2">
                  <Label>
                    Edge enhancement —{" "}
                    <span className="font-mono">{s.unsharpAmount.toFixed(1)}</span>{" "}
                    <span className="text-muted-foreground text-xs">(restores edge sharpness)</span>
                  </Label>
                  <Slider
                    min={0.0}
                    max={2.0}
                    step={0.1}
                    value={[s.unsharpAmount]}
                    onValueChange={(v) => s.set("unsharpAmount", sv(v))}
                  />
                </div>

                {/* CLAHE clip limit */}
                <div className="space-y-2">
                  <Label>
                    CLAHE clip limit —{" "}
                    <span className="font-mono">{s.claheClipLimit.toFixed(1)}</span>{" "}
                    <span className="text-muted-foreground text-xs">(prevents over-enhancement)</span>
                  </Label>
                  <Slider
                    min={1.0}
                    max={4.0}
                    step={0.1}
                    value={[s.claheClipLimit]}
                    onValueChange={(v) => s.set("claheClipLimit", sv(v))}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
