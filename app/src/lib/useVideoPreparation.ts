import { useEffect, useRef, useState } from "react";
import { prepareVideo, shouldCompressVideo, type CompressionProgress } from "./videoCompression";

export function useVideoPreparation(onReady: (file: File) => void, onBusy?: (busy: boolean) => void) {
  const operation = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<CompressionProgress | null>(null);
  const [failure, setFailure] = useState<File | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const busy = !!progress || !!failure;
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => { onBusy?.(busy); return () => onBusy?.(false); }, [busy, onBusy]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const cancel = () => {
    operation.current?.abort(); operation.current = null;
    setProgress(null); setFailure(null); setPreview(null); setNote("");
  };
  const select = async (file: File) => {
    if (operation.current || failure) return;
    setNote("");
    if (!shouldCompressVideo(file)) { onReady(file); return; }
    const controller = new AbortController(); operation.current = controller;
    setPreview(file); setProgress({ phase: "loading" });
    try {
      const result = await prepareVideo(file, controller.signal, setProgress);
      if (controller.signal.aborted) return;
      setNote(result.outcome === "compressed"
        ? `Video prepared: ${(file.size / 1048576).toFixed(1)} MB to ${(result.file.size / 1048576).toFixed(2)} MB.`
        : "Compression did not reduce the file size. Using the original.");
      setProgress(null); setPreview(null); operation.current = null;
      onReady(result.file);
    } catch {
      if (!controller.signal.aborted) { setProgress(null); setFailure(file); }
    } finally { if (operation.current === controller) operation.current = null; }
  };
  const useOriginal = () => {
    if (!failure) return;
    const file = failure;
    setFailure(null); setPreview(null); setNote("Using the original video.");
    onReady(file);
  };
  return { progress, failure, preview, note, busy, select, cancel, useOriginal, closePreview: () => setPreview(null) };
}