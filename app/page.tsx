"use client";

import TextSettings from "@/components/panels/TextSettings";
import ImageSettings from "@/components/panels/ImageSettings";
import CodeSettings from "@/components/panels/CodeSettings";
import PreviewPanel from "@/components/panels/PreviewPanel";

export default function Home() {
  return (
    <main className="container mx-auto p-4 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Phomemo D30 Web Bluetooth</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <TextSettings />
        <ImageSettings />
        <CodeSettings />
        <PreviewPanel />
      </div>
    </main>
  );
}
