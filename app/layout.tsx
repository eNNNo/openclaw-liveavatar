import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenClaw LiveAvatar",
  description: "Talk to your OpenClaw agent face-to-face with a real-time AI avatar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
