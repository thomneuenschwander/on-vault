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
  },
});
