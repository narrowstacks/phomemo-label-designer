"use client";

import { useSettings } from "@/lib/store";
import type { CodePosition } from "@/lib/store";
import type { CodeType, BarcodeFormat, QrErrorCorrection } from "@/lib/codes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CODE_TYPES: [CodeType, string][] = [
  ["none", "None"],
  ["qr", "QR Code"],
  ["barcode", "Barcode (CODE128)"],
];

const CODE_POSITIONS: [CodePosition, string][] = [
  ["above", "Above text"],
  ["below", "Below text"],
  ["left", "Left of text"],
  ["right", "Right of text"],
  ["background", "Behind text"],
];

const QR_ERROR_CORRECTIONS: [QrErrorCorrection, string][] = [
  ["L", "Low (7%)"],
  ["M", "Medium (15%)"],
  ["Q", "Quartile (25%)"],
  ["H", "High (30%)"],
];

const BARCODE_FORMATS: [BarcodeFormat, string][] = [
  ["CODE128", "CODE128"],
  ["CODE39", "CODE39"],
  ["EAN13", "EAN13"],
  ["EAN8", "EAN8"],
  ["UPC", "UPC"],
];

/** Helper to extract a scalar value from a base-ui Slider's onValueChange payload. */
function sv(v: number | readonly number[]): number {
  return typeof v === "number" ? v : v[0];
}

export default function CodeSettings() {
  const s = useSettings();
  const showDetails = s.codeType !== "none";

  return (
    <Card>
      <CardHeader>
        <CardTitle>QR Code &amp; Barcode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Code type */}
        <div className="space-y-2">
          <Label>Code type</Label>
          <Select
            value={s.codeType}
            onValueChange={(v) => {
              if (v !== null) s.set("codeType", v as CodeType);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODE_TYPES.map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Code data — hidden when codeType is "none" */}
        {showDetails && (
          <div className="space-y-2">
            <Label htmlFor="codeData">Code data</Label>
            <Textarea
              id="codeData"
              rows={2}
              placeholder="Enter text or data to encode"
              value={s.codeData}
              onChange={(e) => s.set("codeData", e.target.value)}
            />
          </div>
        )}

        {/* Code position — hidden when codeType is "none" */}
        {showDetails && (
          <div className="space-y-2">
            <Label>Code position</Label>
            <Select
              value={s.codePosition}
              onValueChange={(v) => {
                if (v !== null) s.set("codePosition", v as CodePosition);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODE_POSITIONS.map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Code size — hidden when codeType is "none" */}
        {showDetails && (
          <div className="space-y-2">
            <Label>
              Code size (%) — <span className="font-mono">{s.codeSize}%</span>
            </Label>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[s.codeSize]}
              onValueChange={(v) => s.set("codeSize", sv(v))}
            />
          </div>
        )}

        {/* QR error correction — shown only when codeType is "qr" */}
        {s.codeType === "qr" && (
          <div className="space-y-2">
            <Label>QR Error correction</Label>
            <Select
              value={s.qrErrorCorrection}
              onValueChange={(v) => {
                if (v !== null) s.set("qrErrorCorrection", v as QrErrorCorrection);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QR_ERROR_CORRECTIONS.map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Barcode format — shown only when codeType is "barcode" */}
        {s.codeType === "barcode" && (
          <div className="space-y-2">
            <Label>Barcode format</Label>
            <Select
              value={s.barcodeFormat}
              onValueChange={(v) => {
                if (v !== null) s.set("barcodeFormat", v as BarcodeFormat);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BARCODE_FORMATS.map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
