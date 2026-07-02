import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'bcryptjs', 'pdfjs-dist', 'pdf-parse'],
};

export default nextConfig;
