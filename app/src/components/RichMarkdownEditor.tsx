import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Icon } from "./Icon";

/** Same rule as the renderer (`Markdown.tsx`): only web and mail links are kept. */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export default function RichMarkdownEditor({ id, label, value, onChange, maxLength, placeholder }: {
  id: string; label: string; value: string; onChange: (value: string) => void; maxLength: number; placeholder?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const emitted = useRef(value);
  const latest = useRef({ onChange, maxLength });
  const openLinkRef = useRef<() => void>(() => undefined);
  const addressInput = useRef<HTMLInputElement>(null);
  const [locked, setLocked] = useState(false);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("https://");
  const [urlError, setUrlError] = useState(false);
  useEffect(() => { latest.current = { onChange, maxLength }; });
  const editor = useEditor({
    immediatelyRender: false,
    // Underline has no Markdown form, so it is left out; the other nodes keep whatever was already stored round-tripping.
    extensions: [StarterKit.configure({ underline: false, link: { openOnClick: false, autolink: false, protocols: ["http", "https", "mailto"] } }), Markdown, Placeholder.configure({ placeholder: placeholder ?? "" }), Table, TableRow, TableHeader, TableCell],
    content: value, contentType: "markdown",
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") { event.preventDefault(); openLinkRef.current(); return true; }
        return false;
      },
      attributes: { id, role: "textbox", "aria-multiline": "true", "aria-label": label, class: "markdown-content rich-editor-body" },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.isEmpty ? "" : current.getMarkdown().trimEnd();
      // Over the limit: step back so the stored text never exceeds what the field allows.
      if (markdown.length > latest.current.maxLength) { current.commands.undo(); return; }
      emitted.current = markdown;
      latest.current.onChange(markdown);
    },
  });
  // A value changed from outside (a restored draft, a reset) replaces the content; typing's own echo does not.
  useEffect(() => {
    if (editor && value !== emitted.current) { emitted.current = value; editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false }); }
  }, [editor, value]);
  // Inside a disabled fieldset (a save is running) the field is read-only, as the textarea was. Checked after every render, since
  // the fieldset belongs to the parent; it only sets state when the answer changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs every render.
  useEffect(() => {
    const disabled = !!frame.current?.closest("fieldset[disabled]");
    if (disabled !== locked) setLocked(disabled);
    if (editor && editor.isEditable === disabled) editor.setEditable(!disabled);
  });
  useEffect(() => { if (linking) addressInput.current?.focus(); }, [linking]);
  const openLink = () => {
    if (locked || !editor) return;
    setUrl(editor.getAttributes("link").href ?? "https://");
    setUrlError(false);
    setLinking(true);
  };
  useEffect(() => { openLinkRef.current = openLink; });
  if (!editor) return <div ref={frame} className="markdown-editor"><div className="min-h-32" /></div>;

  const tool = (text: string, active: boolean, run: () => void, content: ReactNode) =>
    <button type="button" disabled={locked} aria-label={text} aria-pressed={active} title={text} className="markdown-tool" onClick={run}>{content}</button>;
  const applyLink = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const href = url.trim();
    if (href === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinking(false); return; }
    if (!SAFE_URL.test(href)) { setUrlError(true); return; }
    if (editor.state.selection.empty && !editor.isActive("link")) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinking(false);
  };
  return <div ref={frame} className="markdown-editor" aria-disabled={locked || undefined}>
    <div role="group" aria-label={`${label} formatting`} className="flex flex-wrap items-center gap-1 border-b border-(--glass-edge) p-1">
      {tool("Bold (Ctrl+B)", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <strong aria-hidden="true">B</strong>)}
      {tool("Italic (Ctrl+I)", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <em aria-hidden="true">I</em>)}
      {tool("Bulleted list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <Icon name="list" />)}
      {tool("Link (Ctrl+K)", editor.isActive("link"), openLink, <Icon name="link" />)}
    </div>
    {linking && <form onSubmit={applyLink} className="flex flex-wrap items-center gap-2 border-b border-(--glass-edge) p-2">
      <input ref={addressInput} type="url" inputMode="url" aria-label="Link address" aria-invalid={urlError || undefined} value={url} onChange={event => { setUrl(event.target.value); setUrlError(false); }}
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setLinking(false); editor.commands.focus(); } }}
        className="min-w-0 flex-1 rounded-lg border border-(--glass-edge) bg-transparent px-2.5 py-1.5 text-[14px] text-(--ink) outline-none focus:border-(--accent)" />
      <button type="submit" className="markdown-tool w-auto px-3 text-[13px] font-semibold">Apply</button>
      {urlError && <span role="alert" className="basis-full text-[12px] text-(--ink-2)">Use an address that starts with https:// or mailto:</span>}
    </form>}
    <EditorContent editor={editor} />
  </div>;
}
