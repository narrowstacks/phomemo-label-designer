import { describe, it, expect, beforeEach } from "vitest";
import { useSettings } from "@/lib/store";

describe("useSettings store", () => {
  beforeEach(() => {
    useSettings.setState(useSettings.getInitialState());
  });

  it("has the documented defaults", () => {
    const s = useSettings.getState();
    expect(s.text).toBe("Hello world");
    expect(s.fontSize).toBe(36);
    expect(s.labelWidth).toBe(40);
    expect(s.labelHeight).toBe(12);
    expect(s.algorithm).toBe("floyd");
    expect(s.threshold).toBe(128);
    expect(s.previewRotation).toBe(-90);
    expect(s.serpentine).toBe(true);
  });

  it("set() updates a single field", () => {
    useSettings.getState().set("fontSize", 48);
    expect(useSettings.getState().fontSize).toBe(48);
  });

  it("resetOffset() zeroes both offsets", () => {
    useSettings.getState().set("offsetX", 10);
    useSettings.getState().set("offsetY", -5);
    useSettings.getState().resetOffset();
    expect(useSettings.getState().offsetX).toBe(0);
    expect(useSettings.getState().offsetY).toBe(0);
  });
});
