"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProcessingOptions } from "@/lib/imaging/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export function useImageProcessor() {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const pending = useRef<Map<number, (img: ImageData | null) => void>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./imaging.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, width, height, buffer } = e.data;
      const resolve = pending.current.get(id);
      if (resolve) {
        pending.current.delete(id);
        resolve(new ImageData(new Uint8ClampedArray(buffer), width, height));
      }
    };
    workerRef.current = worker;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      worker.terminate();
    };
  }, []);

  const process = useCallback((img: ImageData, options: ProcessingOptions) => {
    return new Promise<ImageData | null>((resolve) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const worker = workerRef.current;
        if (!worker) return;
        const id = ++idRef.current;
        // latest-wins: settle superseded resolvers with null so they don't hang
        for (const oldResolve of pending.current.values()) oldResolve(null);
        pending.current.clear();
        pending.current.set(id, resolve);
        const buffer = img.data.buffer.slice(0); // copy so caller's ImageData stays valid
        const req: WorkerRequest = {
          id,
          width: img.width,
          height: img.height,
          buffer,
          options,
        };
        worker.postMessage(req, [buffer]);
      }, 120);
    });
  }, []);

  return { process };
}
