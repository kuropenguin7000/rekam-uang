import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev-tools indicator (the circular badge that
  // appeared at the bottom-left in development).
  devIndicators: false,
  // Allow cross-origin dev requests from public tunnels. The wildcard matches
  // any Cloudflare quick-tunnel URL, so it keeps working when the tunnel changes
  // (add another, e.g. "*.ngrok-free.app", if you switch tunnels).
  allowedDevOrigins: [
    '*.trycloudflare.com' // Using a wildcard allows you to change tunnels seamlessly later
  ]
};

export default nextConfig;
