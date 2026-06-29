import { runPipeline } from "../imaging/pipeline";
import type { WorkerRequest, WorkerResponse } from "./protocol";

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, width, height, buffer, options } = e.data;
  const img = { data: new Uint8ClampedArray(buffer), width, height };
  const out = runPipeline(img, options);
  const response: WorkerResponse = {
    id,
    width: out.width,
    height: out.height,
    buffer: out.data.buffer as ArrayBuffer,
  };
  (self as DedicatedWorkerGlobalScope).postMessage(response, [out.data.buffer]);
};
