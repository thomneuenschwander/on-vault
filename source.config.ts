import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from 'fumadocs-mdx/config';
import { load } from 'js-yaml';
import { readFileSync, existsSync } from 'fs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function getBasePath(): string {
  if (process.env.NEXT_PUBLIC_BASE_PATH) return process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    if (!existsSync('on-vault.yaml')) return 'docs';
    const config = load(readFileSync('on-vault.yaml', 'utf-8')) as any;
    return config?.site?.base_path ?? 'docs';
  } catch {
    return 'docs';
  }
}

const basePath = getBasePath();

export const docs = defineDocs({
  dir: `content/${basePath}`,
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath],
    rehypePlugins: (v) => [rehypeKatex, ...v],
    // Prevent remarkImage from importing images as modules: fumadocs-obsidian can
    // emit relative .mdx paths as image URLs (for excalidraw embeds) which, when
    // imported, resolve to React component functions — crashing RSC serialization.
    // onError:'ignore' silently skips files that aren't images (MDX, SVG) instead
    // of throwing; all vault images use absolute /vault/... URLs anyway.
    remarkImageOptions: { useImport: false, onError: 'ignore' },
  },
});
