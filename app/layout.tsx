import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phomemo D30 Web Bluetooth",
  description: "Print labels to a Phomemo D30 over Web Bluetooth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
