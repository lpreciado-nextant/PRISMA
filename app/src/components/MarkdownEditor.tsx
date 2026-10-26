import { useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";

export function MarkdownEditor({ id, label, value, onChange, maxLength, placeholder }: {
  id: string; label: string; value: string; onChange: (value: string) => void; maxLength: number; placeholder?: string;
}) {
  const [preview, setPreview] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const writeTab = useRef<HTMLButtonElement>(null);
  const previewTab = useRef<HTMLButtonElement>(null);
  function format(before: string, after = "", block = false) {
    const textarea = input.current;
    if (!textarea || textarea.matches(":disabled") || preview) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = block ? value.slice(start, end).replaceAll("\n", `\n${before}`) : value.slice(start, end);
    const prefix = block && start > 0 && value[start - 1] !== "\n" ? `\n${before}` : before;
    const next = value.slice(0, start) + prefix + selected + after + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }
  function tabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? false : event.key === "End" ? true : !preview;
    setPreview(next);
    (next ? previewTab : writeTab).current?.focus();
  }
  const toolClass = "markdown-tool";
  return <div className="markdown-editor">
    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-(--glass-edge) p-1.5">
      <div role="tablist" tabIndex={-1} aria-label={`${label} mode`} onKeyDown={tabs} className="flex gap-1">
        <button ref={writeTab} id={`${id}-write`} type="button" role="tab" aria-selected={!preview} aria-controls={`${id}-write-panel`} tabIndex={preview ? -1 : 0} onClick={() => setPreview(false)} className="markdown-tab">Write</button>
        <button ref={previewTab} id={`${id}-preview`} type="button" role="tab" aria-selected={preview} aria-controls={`${id}-preview-panel`} tabIndex={preview ? 0 : -1} onClick={() => setPreview(true)} className="markdown-tab">Preview</button>
      </div>
      <div role="group" aria-label={`${label} formatting`} className="flex gap-1">
        <button type="button" disabled={preview} aria-label="Bold" title="Bold" className={toolClass} onClick={() => format("**", "**")}><strong aria-hidden="true">B</strong></button>
        <button type="button" disabled={preview} aria-label="Italic" title="Italic" className={toolClass} onClick={() => format("*", "*")}><em aria-hidden="true">I</em></button>
        <button type="button" disabled={preview} aria-label="Bulleted list" title="Bulleted list" className={toolClass} onClick={() => format("- ", "", true)}><Icon name="list" /></button>
        <button type="button" disabled={preview} aria-label="Link" title="Link" className={toolClass} onClick={() => format("[", "](https://)")}><Icon name="link" /></button>
      </div>
    </div>
    <div id={`${id}-write-panel`} role="tabpanel" aria-labelledby={`${id}-write`} hidden={preview}>
      <textarea ref={input} id={id} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} placeholder={placeholder}
        className="block min-h-32 w-full resize-y rounded-b-lg bg-transparent px-3.5 py-2.5 text-[15px] text-(--ink) outline-none placeholder:text-(--ink-3)"
        onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && !event.altKey && ["b", "i"].includes(event.key.toLowerCase())) { event.preventDefault(); format(event.key.toLowerCase() === "b" ? "**" : "*", event.key.toLowerCase() === "b" ? "**" : "*"); } }} />
    </div>
    <div id={`${id}-preview-panel`} role="tabpanel" aria-labelledby={`${id}-preview`} hidden={!preview} tabIndex={preview ? 0 : -1} className="min-h-32 px-3.5 py-2.5 text-[15px]">
      {preview && <Markdown>{value}</Markdown>}
    </div>
  </div>;
}