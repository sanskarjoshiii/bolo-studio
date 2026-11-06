"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api, useAction } from "./hooks";
import { ErrorNote } from "./controls";

const field =
  "w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50";

/**
 * Admin only: the Switch rooms this company uses — names exactly as they appear in Switch
 * (e.g. "Telegram: Kurta Co Approvals"). The Publisher joins them and relays approvals.
 */
export function PlatformRooms({ companyId, companyName, rooms }: { companyId: string; companyName: string; rooms: { work: string; approvals: string } }) {
  const { run, pending, error, clearError } = useAction();
  const [work, setWork] = useState(rooms.work);
  const [approvals, setApprovals] = useState(rooms.approvals);
  const [saved, setSaved] = useState(false);
  const dirty = work !== rooms.work || approvals !== rooms.approvals;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        if (await run(() => api(`/api/companies/${companyId}/kit`, "PATCH", { meta: { rooms: { work, approvals } } }))) setSaved(true);
      }}
      className="space-y-2.5"
    >
      <p className="text-[12px] text-fog">{companyName}&apos;s rooms in Switch — the name of the room exactly as Switch shows it.</p>
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-fog">Approvals room (the client&apos;s Telegram group, bridged in Switch)</span>
        <input value={approvals} onChange={(e) => (setApprovals(e.target.value), setSaved(false))} placeholder={`${companyName} Approvals`} className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-fog">Work room (your team + the content agents)</span>
        <input value={work} onChange={(e) => (setWork(e.target.value), setSaved(false))} placeholder="#company-work" className={field} />
      </label>
      <ErrorNote error={error} onClose={clearError} />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-[12px] text-emerald-300">Saved — restart the Publisher (or wait for it) to join</span>}
        <button disabled={pending || !dirty} className="flex items-center gap-2 rounded-lg bg-lime px-3 py-1.5 text-[12.5px] font-medium text-night disabled:opacity-40">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save rooms
        </button>
      </div>
    </form>
  );
}
