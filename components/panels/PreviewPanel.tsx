"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useSettings } from "@/lib/store";
import { useCanvasCompositor } from "@/hooks/useCanvasCompositor";
import { printCanvas, PRINTER_GATT } from "@/lib/printer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const cssRotation: Record<number, string> = {
  0: "",
  90: "rotate-90",
  180: "rotate-180",
  270: "-rotate-90",
};

const STEP_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1px" },
  { value: 2, label: "2px" },
  { value: 5, label: "5px" },
  { value: 10, label: "10px" },
  { value: 20, label: "20px" },
];

export default function PreviewPanel() {
  const s = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasCompositor(canvasRef);

  const norm = ((s.previewRotation % 360) + 360) % 360;

  async function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!("bluetooth" in navigator)) {
      toast.error("Web Bluetooth is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [PRINTER_GATT.service],
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(PRINTER_GATT.service);
      const char = await service.getCharacteristic(PRINTER_GATT.characteristic);
      await printCanvas(char, canvas);
      toast.success("Sent to printer.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function bump(axis: "offsetX" | "offsetY", dir: number) {
    s.set(axis, s[axis] + dir * s.offsetStep);
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-4">
        {/* Preview rotation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => s.set("previewRotation", s.previewRotation - 90)}
          >
            ↺ 90° CCW
          </Button>
          <Button
            variant="outline"
            onClick={() => s.set("previewRotation", (s.previewRotation + 90) % 360)}
          >
            ↻ 90° CW
          </Button>
        </div>

        {/* Canvas preview */}
        <div className="border rounded p-1">
          <canvas
            ref={canvasRef}
            className={`[image-rendering:pixelated] ${cssRotation[norm] ?? ""}`}
          />
        </div>

        {/* Connect & print */}
        <Button onClick={handlePrint}>Connect &amp; print</Button>

        {/* Print offset pad */}
        <div className="w-full space-y-2">
          <p className="text-sm font-medium">Print offset</p>
          <p className="text-xs text-muted-foreground">
            Adjust position to compensate for printer alignment
          </p>
          <div className="flex gap-4 items-center">
            {/* D-pad */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bump("offsetY", -1)}
                aria-label="Offset up"
              >
                ↑
              </Button>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bump("offsetX", -1)}
                  aria-label="Offset left"
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => s.resetOffset()}
                  aria-label="Reset offset"
                >
                  ⌂
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bump("offsetX", 1)}
                  aria-label="Offset right"
                >
                  →
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bump("offsetY", 1)}
                aria-label="Offset down"
              >
                ↓
              </Button>
            </div>
            {/* X/Y readouts */}
            <div className="text-center text-sm space-y-1">
              <div>X: <span className="font-mono">{s.offsetX}</span>px</div>
              <div>Y: <span className="font-mono">{s.offsetY}</span>px</div>
            </div>
          </div>

          {/* Step size select */}
          <div className="w-32 space-y-1">
            <Label htmlFor="offsetStep">Step size</Label>
            <Select
              value={String(s.offsetStep)}
              onValueChange={(v) => {
                if (v !== null) s.set("offsetStep", Number(v));
              }}
            >
              <SelectTrigger id="offsetStep">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={String(value)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Label size */}
        <div className="w-full space-y-2">
          <p className="text-sm font-medium">Label size</p>
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="labelWidth">Width (mm)</Label>
              <Input
                id="labelWidth"
                type="number"
                step={1}
                value={s.labelWidth}
                onChange={(e) => s.set("labelWidth", e.target.valueAsNumber)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="labelHeight">Height (mm)</Label>
              <Input
                id="labelHeight"
                type="number"
                step={1}
                value={s.labelHeight}
                onChange={(e) => s.set("labelHeight", e.target.valueAsNumber)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
