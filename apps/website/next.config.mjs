import { createMDX } from 'fumadocs-mdx/next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const withMDX = createMDX();
const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  trailingSlash: true,
  reactStrictMode: true,
  turbopack: {
    root: resolve(__dirname, '../..'),
  },
  images: {
    unoptimized: true,
  },
};

export default withMDX(config);
