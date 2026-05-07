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
    callout: ObsidianCallout,
    'callout-title': ObsidianCalloutTitle,
    'callout-body': ObsidianCalloutBody,
    ...components,
  };
}
