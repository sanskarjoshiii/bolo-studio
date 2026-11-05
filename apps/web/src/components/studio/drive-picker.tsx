"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, ExternalLink, Film, Loader2, RefreshCw, Upload, X } from "lucide-react";
import type { DriveFile } from "@bolo/core";
import { ErrorNote } from "./controls";
import { cn } from "@/lib/cn";

/**
 * Pick reference images/videos from the client's Drive folder (Bolo Studio/<Client>/References).
 * Files added here are uploaded to that folder, so the whole team sees them in Drive too.
 */
export function DrivePicker({
  clientId,
  folderUrl,
  initial = [],
  onClose,
  onPick,
  confirmLabel = "Attach selected",
}: {
  clientId: string;
  folderUrl?: string | null;
  initial?: string[];
  onClose: () => void;
  onPick: (files: DriveFile[]) => Promise<void> | void;
  confirmLabel?: string;
}) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState<"load" | "upload" | "pick" | null>("load");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy("load");
    setError(null);
    try {
      const res = await fetch(`/api/drive/references?client=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load Drive");
      setFiles(data as DriveFile[]);
    } catch (e) {
      setError((e as Error).message);
      setFiles([]);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per client
  }, [clientId]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy("upload");
    setError(null);
    try {
      for (const f of Array.from(list)) {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch(`/api/drive/references?client=${encodeURIComponent(clientId)}`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Upload of ${f.name} failed`);
        setPicked((p) => [...p, (data as DriveFile).id]);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-10)));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-[760px] flex-col rounded-2xl bg-[#0f2219] text-white ring-1 ring-white/10"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">References from Google Drive</p>
            <p className="text-[12px] text-fog">Bolo Studio / client / References — logos, site photos, renders, clips</p>
          </div>
          {folderUrl && (
            <a href={folderUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-lime hover:underline">
              Open in Drive <ExternalLink className="size-3" />
            </a>
          )}
          <button onClick={() => void load()} aria-label="Refresh" className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white">
            <RefreshCw className={cn("size-4", busy === "load" && "animate-spin")} />
          </button>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="thin-scrollbar min-h-[220px] flex-1 overflow-y-auto p-5">
          <ErrorNote error={error} onClose={() => setError(null)} />
          {files === null ? (
            <p className="flex items-center gap-2 text-[13px] text-fog">
              <Loader2 className="size-4 animate-spin" /> Loading Drive…
            </p>
          ) : files.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[13px] text-fog">
              No references yet. Upload here, or drop files into the References folder in Drive.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {files.map((f) => {
                const on = picked.includes(f.id);
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => toggle(f.id)}
                      className={cn("group relative block aspect-square w-full overflow-hidden rounded-xl bg-black/30 ring-2 transition", on ? "ring-lime" : "ring-transparent hover:ring-white/20")}
                    >
                      {f.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Drive thumbnail proxied with the connected account
                        <img src={`/api/drive/thumb/${f.id}`} alt={f.name} className="size-full object-cover" loading="lazy" />
                      ) : (
                        <span className="grid size-full place-items-center text-fog">
                          <Film className="size-6" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pt-4 pb-1.5 text-left text-[10.5px] text-white/90">{f.name}</span>
                      {on && (
                        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-lime text-night">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-4">
          <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[12.5px] hover:bg-white/[0.1]", busy && "pointer-events-none opacity-50")}>
            {busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload to Drive
            <input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" className="sr-only" onChange={(e) => void upload(e.target.files)} />
          </label>
          <span className="flex-1 text-[12px] text-fog">{picked.length ? `${picked.length} selected` : "Select up to 10"}</span>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] text-fog hover:text-white">
            Cancel
          </button>
          <button
            disabled={!picked.length || busy !== null}
            onClick={async () => {
              setBusy("pick");
              try {
                await onPick((files ?? []).filter((f) => picked.includes(f.id)));
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(null);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-[13px] font-medium text-night disabled:opacity-40"
          >
            {busy === "pick" && <Loader2 className="size-3.5 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
