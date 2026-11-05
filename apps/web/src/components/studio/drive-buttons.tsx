"use client";

import { HardDrive, Unplug } from "lucide-react";
import { api, useAction } from "./hooks";
import { ErrorNote } from "./controls";

export function DriveButtons({ connected, configured }: { connected: boolean; configured: boolean }) {
  const { run, pending, error, clearError } = useAction();
  if (!configured) return null;
  return (
    <div className="space-y-2">
      <ErrorNote error={error} onClose={clearError} />
      {connected ? (
        <button
          onClick={() => confirm("Disconnect Google Drive? Files in Drive stay where they are.") && run(() => api("/api/drive/disconnect", "POST"))}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/[0.1]"
        >
          <Unplug className="size-3.5" /> Disconnect
        </button>
      ) : (
        <a href="/api/drive/connect" className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-[12.5px] font-medium text-night hover:brightness-95">
          <HardDrive className="size-3.5" /> Connect Google Drive
        </a>
      )}
    </div>
  );
}
