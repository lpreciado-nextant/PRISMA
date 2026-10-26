import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const plugins = [remarkGfm, remarkBreaks];
const elements = ["p", "br", "strong", "em", "del", "a", "ul", "ol", "li", "input", "blockquote", "pre", "code", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table", "thead", "tbody", "tr", "th", "td"];

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return <div className={`markdown-content ${className}`}><ReactMarkdown remarkPlugins={plugins} skipHtml allowedElements={elements}
    urlTransform={url => /^(https?:\/\/|mailto:)/i.test(url) ? url : ""}
    components={{ a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>,
      input: ({ checked }) => <input type="checkbox" checked={checked ?? false} disabled readOnly aria-label={checked ? "Completed item" : "Incomplete item"} />,
      table: ({ children }) => <div className="markdown-table"><table>{children}</table></div> }}>
    {children}
  </ReactMarkdown></div>;
}