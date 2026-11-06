import { Clapperboard, Compass, Palette, PenLine, Send, ShieldCheck, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { listAgents, loadClient } from "@bolo/core";
import { requireUserPage } from "@/lib/auth";

const ICONS: Record<string, LucideIcon> = {
  strategist: Compass,
  copywriter: PenLine,
  "visual-designer": Palette,
  "reel-producer": Clapperboard,
  "brand-guard": ShieldCheck,
  publisher: Send,
};

export default async function AgentsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const me = await requireUserPage(`/studio/${clientId}/agents`);
  if (me.role !== "admin") notFound(); // the agents are Bolo Studio's own (platform service)
  const client = loadClient(clientId)!;
  const agents = listAgents();

  return (
    <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.05] px-5 py-4">
        <h1 className="text-[17px] font-medium tracking-tight">Agents in {client.rooms.work}</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          Instructions come from <span className="font-mono">agents/*.md</span> — paste each into the agent&apos;s settings in Switch Console. Single-holder roles have
          exactly one owner at a time, so nothing is ever scheduled twice.
        </p>
      </div>

      <div className="grid gap-3 p-5 lg:grid-cols-2">
        {agents.map((a) => {
          const Icon = ICONS[a.id] ?? Compass;
          return (
            <article key={a.id} className="flex flex-col rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] ring-1 ring-white/10">
                  <Icon className="size-5 text-lime" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14.5px] font-medium">{a.name}</h2>
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-fog">{a.role}</span>
                  </div>
                  <p className="text-[11.5px] text-fog">{a.builtWith}</p>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/80">{a.summary}</p>
              <details className="group mt-3 rounded-lg bg-black/20 ring-1 ring-white/[0.05]">
                <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] text-fog hover:text-white">
                  <span className="group-open:hidden">Show instructions</span>
                  <span className="hidden group-open:inline">Hide instructions</span>
                </summary>
                <pre className="thin-scrollbar overflow-x-auto px-3 pb-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-white/75">{a.instructions}</pre>
              </details>
            </article>
          );
        })}
      </div>
    </main>
  );
}
