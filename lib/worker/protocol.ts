import type { ProcessingOptions } from "@/lib/imaging/types";

export interface WorkerRequest {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer; // RGBA pixel buffer
  options: ProcessingOptions;
}

export interface WorkerResponse {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}
