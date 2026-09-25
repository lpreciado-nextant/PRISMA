/** Resolves a `var(--token)` reference to its computed literal value; a sandboxed iframe document can't read our CSS variables. */
export function resolveColor(cssVar: string): string {
  const name = cssVar.match(/var\((--[\w-]+)\)/)?.[1];
  if (!name) return cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#7fb6d9";
}
