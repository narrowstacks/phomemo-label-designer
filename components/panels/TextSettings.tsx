"use client";

import { useSettings } from "@/lib/store";
import type { FontWeight, TextAlign } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FONTS = [
  ["Arial, sans-serif", "Arial"],
  ["Helvetica, sans-serif", "Helvetica"],
  ["'Times New Roman', serif", "Times New Roman"],
  ["'Courier New', monospace", "Courier New"],
  ["Georgia, serif", "Georgia"],
  ["Verdana, sans-serif", "Verdana"],
  ["'Comic Sans MS', cursive", "Comic Sans MS"],
  ["Impact, sans-serif", "Impact"],
] as const;

const FONT_WEIGHTS: [FontWeight, string][] = [
  ["normal", "Normal"],
  ["bold", "Bold"],
  ["lighter", "Light"],
];

const TEXT_ALIGNMENTS: [TextAlign, string][] = [
  ["center", "Center"],
  ["left", "Left"],
  ["right", "Right"],
];

export default function TextSettings() {
  const s = useSettings();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Text Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="text">Text to print</Label>
          <Textarea
            id="text"
            rows={3}
            value={s.text}
            onChange={(e) => s.set("text", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Font family</Label>
          <Select
            value={s.fontFamily}
            onValueChange={(v) => { if (v !== null) s.set("fontFamily", v); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fontSize">Font size (px)</Label>
          <Input
            id="fontSize"
            type="number"
            min={8}
            max={200}
            value={s.fontSize}
            onChange={(e) => s.set("fontSize", e.target.valueAsNumber)}
          />
        </div>
        <div className="space-y-2">
          <Label>Font weight</Label>
          <Select
            value={s.fontWeight}
            onValueChange={(v) => { if (v !== null) s.set("fontWeight", v as FontWeight); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Text alignment</Label>
          <Select
            value={s.textAlign}
            onValueChange={(v) => { if (v !== null) s.set("textAlign", v as TextAlign); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_ALIGNMENTS.map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="verticalText"
            checked={s.verticalText}
            onCheckedChange={(c) => s.set("verticalText", c === true)}
          />
          <Label htmlFor="verticalText">Vertical text (stack letters)</Label>
        </div>
      </CardContent>
    </Card>
  );
}
