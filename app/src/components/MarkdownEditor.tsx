import { lazy, Suspense } from "react";

const RichMarkdownEditor = lazy(() => import("./RichMarkdownEditor"));

/**
 * The rich-text field: write and see the formatting in the same place, with a small toolbar (bold, italic, bullets, link).
 * The value is still Markdown, so what is stored and how the solution page renders it (`Markdown.tsx`) do not change.
 * The editor itself loads on demand; until then, and in server rendering, an empty frame holds its place.
 */
export function MarkdownEditor(props: { id: string; label: string; value: string; onChange: (value: string) => void; maxLength: number; placeholder?: string }) {
  return <Suspense fallback={<div className="markdown-editor"><div className="min-h-32" /></div>}><RichMarkdownEditor {...props} /></Suspense>;
}
