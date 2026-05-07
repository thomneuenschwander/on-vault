import { createMDX } from 'fumadocs-mdx/next';
import { load } from 'js-yaml';
import { readFileSync, existsSync } from 'fs';

function loadOnVaultConfig() {
  if (!existsSync('on-vault.yaml')) return {};
  return load(readFileSync('on-vault.yaml', 'utf-8')) ?? {};
}

const vaultConfig = loadOnVaultConfig();
const basePath = vaultConfig?.site?.base_path ?? 'docs';
const siteTitle = vaultConfig?.site?.title ?? 'on-vault';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_TITLE: siteTitle,
  },
  async rewrites() {
    const rewrites = [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];

    // if base_path is not 'docs', rewrite /{base_path}/* → /docs/* transparently
    if (basePath !== 'docs') {
      rewrites.push({
        source: `/${basePath}/:path*`,
        destination: '/docs/:path*',
      });
    }

    return rewrites;
  },
};

export default withMDX(config);
