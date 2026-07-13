import type { MDXComponents } from "mdx/types";

// Required by @next/mdx. New essays written as app/writing/<slug>/page.mdx
// inherit the site typography automatically via the global stylesheets.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}
