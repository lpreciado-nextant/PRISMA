import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import type { Nodes } from "mdast";

const parser = unified().use(remarkParse).use(remarkGfm);
const separated = new Set(["root", "list", "listItem", "blockquote", "table", "tableRow"]);

function plain(node: Nodes): string {
  if (["html", "image", "imageReference", "definition", "footnoteDefinition", "footnoteReference"].includes(node.type)) return "";
  if (node.type === "break") return "\n";
  if ("children" in node) return node.children.map(plain).join(separated.has(node.type) ? "\n" : "");
  return toString(node, { includeImageAlt: false, includeHtml: false });
}

export function markdownText(value: string): string {
  return plain(parser.parse(value)).trim();
}