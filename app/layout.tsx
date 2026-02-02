import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenClaw LiveAvatar",
  description: "Talk to your OpenClaw agent face-to-face with a real-time AI avatar",
};

// Gateway configuration from environment variables
const gatewayConfig = {
  url: process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789",
  token: process.env.OPENCLAW_GATEWAY_TOKEN || "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__OPENCLAW_GATEWAY_URL = ${JSON.stringify(gatewayConfig.url)};
              window.__OPENCLAW_GATEWAY_TOKEN = ${JSON.stringify(gatewayConfig.token)};
            `,
          }}
        />
      </head>
      <body className="bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
