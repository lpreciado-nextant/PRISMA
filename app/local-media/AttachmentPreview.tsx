import { useEffect, useRef, useState } from "react";
import { Icon } from "../src/components/Icon";
import { attachmentType } from "../src/lib/mediaContract";
import { fullAttachment, readRange, type Actor, type Mode, type Upload } from "./client";

export function AttachmentPreview({ actor, id, upload, mode }: { actor: Actor; id: string; upload: Upload; mode: Mode }) {
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const downloadAction = useRef<(() => Promise<void>) | null>(null);
  const mime = attachmentType(upload.name).mime;
  useEffect(() => {
    const controller = new AbortController();
    const urls = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let version: string | undefined;
    let checking = false;
    const clearDownloads = () => { timers.forEach(clearTimeout); urls.forEach(url => URL.revokeObjectURL(url)); timers.clear(); urls.clear(); };
    const fail = (reason: unknown) => {
      if (controller.signal.aborted) return;
      controller.abort(); clearDownloads(); setHtml(null); setReady(false); setDownloading(false);
      setError(reason instanceof Error ? reason.message : "Attachment unavailable.");
    };
    const authorize = async () => {
      const result = await readRange(actor, id, upload, mode, 0, controller.signal, version);
      version = result.version;
    };
    const timer = setInterval(() => {
      if (checking || !version || controller.signal.aborted) return;
      checking = true;
      void authorize().catch(fail).finally(() => { checking = false; });
    }, 30_000);
    void (async () => {
      await authorize();
      if (mime === "text/html") {
        const blob = await fullAttachment(actor, id, upload, mode, controller.signal);
        const text = await blob.text();
        await authorize();
        controller.signal.throwIfAborted();
        const document = new DOMParser().parseFromString(text, "text/html");
        const policy = document.createElement("meta");
        policy.httpEquiv = "Content-Security-Policy";
        policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
        document.head.prepend(policy);
        setHtml(`<!doctype html>${document.documentElement.outerHTML}`);
      }
      controller.signal.throwIfAborted(); setReady(true);
    })().catch(fail);
    downloadAction.current = async () => {
      if (controller.signal.aborted) return;
      setDownloading(true);
      try {
        await authorize();
        const blob = await fullAttachment(actor, id, upload, mode, controller.signal);
        await authorize();
        controller.signal.throwIfAborted();
        const url = URL.createObjectURL(blob); urls.add(url);
        const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = upload.name;
        window.document.body.append(anchor); anchor.click(); anchor.remove();
        const timer = setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); timers.delete(timer); }, 30_000);
        timers.add(timer);
      } catch (reason) { fail(reason); }
      finally { if (!controller.signal.aborted) setDownloading(false); }
    };
    return () => { controller.abort(); clearInterval(timer); clearDownloads(); downloadAction.current = null; };
  }, [actor, id, upload, mode, mime]);
  return <section className="player attachment-preview" aria-label="Protected attachment">
    <div className="player-heading"><h2>{mime === "text/html" ? "HTML preview" : "Document"}</h2><Icon name="file" /></div>
    {html !== null && !error && <iframe title={upload.name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={html} />}
    {mime !== "text/html" && !error && <div className="document-file"><Icon name="file" size={32} /><strong>{upload.name}</strong></div>}
    <div className="player-footer"><span role="status">{error ? "Access / attachment failed" : ready ? "Ready" : "Loading attachment"}</span>
      <button disabled={!ready || downloading || !!error} onClick={() => void downloadAction.current?.()} title="Download original attachment"><Icon name="download" />{downloading ? "Downloading" : "Download"}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}