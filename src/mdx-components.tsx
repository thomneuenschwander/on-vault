import defaultMdxComponents from 'fumadocs-ui/mdx';
import {
  ObsidianCallout,
  ObsidianCalloutTitle,
  ObsidianCalloutBody,
} from 'fumadocs-obsidian/ui';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Use a plain <img> instead of fumadocs-ui's next/image wrapper.
    // next/image is a Client Component and requires width+height or fill;
    // vault images served from /vault/... don't need Next.js image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    img: ({ src, alt, ...props }) => (
      <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} {...props} />
    ),
    callout: ObsidianCallout,
    'callout-title': ObsidianCalloutTitle,
    'callout-body': ObsidianCalloutBody,
    ...components,
  };
}
