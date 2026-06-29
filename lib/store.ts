import { create } from "zustand";
import type { DitherAlgorithm } from "@/lib/imaging/types";
import type { CodeType, BarcodeFormat, QrErrorCorrection } from "@/lib/codes";

export type ImagePosition = "above" | "below" | "left" | "right" | "background" | "none";
export type CodePosition = "above" | "below" | "left" | "right" | "background";
export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold" | "lighter";

export interface SettingsState {
  // text
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  verticalText: boolean;
  // image
  uploadedImage: HTMLImageElement | null;
  imagePosition: ImagePosition;
  imageSize: number;
  imageRotation: number;
  algorithm: DitherAlgorithm;
  threshold: number;
  brightness: number;
  contrast: number;
  noise: number;
  // advanced
  useGammaCorrection: boolean;
  gamma: number;
  usePreFiltering: boolean;
  blurSigma: number;
  unsharpAmount: number;
  useCLAHE: boolean;
  claheClipLimit: number;
  useEdgeAware: boolean;
  useHardwareCleanup: boolean;
  usePrinterResolution: boolean;
  serpentine: boolean;
  // codes
  codeType: CodeType;
  codeData: string;
  codePosition: CodePosition;
  codeSize: number;
  qrErrorCorrection: QrErrorCorrection;
  barcodeFormat: BarcodeFormat;
  // layout/output
  labelWidth: number;
  labelHeight: number;
  offsetX: number;
  offsetY: number;
  offsetStep: number;
  previewRotation: number;
  // actions
  set: <K extends SettingsKey>(key: K, value: SettingsState[K]) => void;
  resetOffset: () => void;
}

/** Keys of the data fields only — excludes the action methods. */
export type SettingsKey = Exclude<keyof SettingsState, "set" | "resetOffset">;

const initial = {
  text: "Hello world",
  fontFamily: "Arial, sans-serif",
  fontSize: 36,
  fontWeight: "normal" as FontWeight,
  textAlign: "center" as TextAlign,
  verticalText: false,
  uploadedImage: null,
  imagePosition: "none" as ImagePosition,
  imageSize: 50,
  imageRotation: 0,
  algorithm: "floyd" as DitherAlgorithm,
  threshold: 128,
  brightness: 0,
  contrast: 0,
  noise: 0,
  useGammaCorrection: false,
  gamma: 2.2,
  usePreFiltering: false,
  blurSigma: 0.5,
  unsharpAmount: 0.8,
  useCLAHE: false,
  claheClipLimit: 2.0,
  useEdgeAware: false,
  useHardwareCleanup: false,
  usePrinterResolution: false,
  serpentine: true,
  codeType: "none" as CodeType,
  codeData: "",
  codePosition: "above" as CodePosition,
  codeSize: 30,
  qrErrorCorrection: "M" as QrErrorCorrection,
  barcodeFormat: "CODE128" as BarcodeFormat,
  labelWidth: 40,
  labelHeight: 12,
  offsetX: 0,
  offsetY: 0,
  offsetStep: 5,
  previewRotation: -90,
};

export const useSettings = create<SettingsState>((set) => ({
  ...initial,
  set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
  resetOffset: () => set({ offsetX: 0, offsetY: 0 }),
}));
