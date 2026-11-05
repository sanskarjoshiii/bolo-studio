import Link from "next/link";
import { Clock, FileJson, FileText, ShieldCheck, UserCheck } from "lucide-react";
import { loadClient, type BrandChecks } from "@bolo/core";
import { Markdown } from "@/components/studio/markdown";
import { cn } from "@/lib/cn";

function describeChecks(c: BrandChecks): string[] {
  const out: string[] = [];
  if (c.banned?.length) out.push(`Blocks: ${c.banned.map((b) => `“${b}”`).join(", ")}`);
  if (c.competitors?.length) out.push(`Blocks competitor names: ${c.competitors.join(", ")}`);
  if (c.replace) out.push(`Softens: ${Object.entries(c.replace).map(([a, b]) => `“${a}” → “${b}”`).join(", ")}`);
  if (c.price) out.push(`Prices need “${c.price.requireWord}”${c.price.footnote ? ` and “${c.price.footnote}”` : ""}`);
  if (c.requireRera) out.push("RERA number on every project creative");
  if (c.requireCta?.length) out.push(`“${c.requireCta.join("” / “")}” CTA in every project caption`);
  for (const r of c.requireText ?? []) out.push(r.label);
  if (c.maxHashtags) out.push(`Hashtag limits: ${Object.entries(c.maxHashtags).map(([p, n]) => `${p} ${n}`).join(", ")}`);
  return out;
}

export default async function BrandKitPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ file?: string }> }) {
  const { clientId } = await params;
  const { file } = await searchParams;
  const client = loadClient(clientId)!;
  const current = client.files.find((f) => f.name === file) ?? client.files[0];
  const tokens = (() => {
    const t = client.files.find((f) => f.name === "tokens.json");
    try {
      return t ? (JSON.parse(t.content) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  })();
  const colours = Object.entries(tokens).filter(([, v]) => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) as [string, string][];
  const rules = describeChecks(client.checks);

  return (
    <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.05] px-5 py-4">
        <h1 className="text-[17px] font-medium tracking-tight">Brand Kit · {client.name}</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          <span className="font-mono">brand-kits/{client.id}/</span> — every agent in {client.rooms.work} reads these files. Edit them in the repo; this page always shows what&apos;s on disk.
        </p>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 2xl:grid-cols-4">
        <Card icon={UserCheck} title="Approvers" source="protocol.md">
          {client.approvers.length ? (
            client.approvers.map((a) => (
              <p key={a.handle} className="text-[12.5px] text-white/85">
                {a.name} <span className="text-fog">{a.handle}</span>
                {a.backup && <span className="ml-1 text-[10px] text-fog">(backup)</span>}
              </p>
            ))
          ) : (
            <p className="text-[12px] text-amber-200">No approver found — add “- Approver: Name (Telegram @handle)”.</p>
          )}
        </Card>
        <Card icon={Clock} title="Best times (IST)" source="protocol.md">
          {client.bestTimes.map((b) => (
            <p key={b.label} className="flex justify-between gap-2 text-[12.5px]">
              <span className="text-fog">{b.label}</span>
              <span className="text-white/85">{b.time}</span>
            </p>
          ))}
        </Card>
        <Card icon={ShieldCheck} title="Automated checks" source="rules.md">
          {rules.length ? (
            <ul className="space-y-1">
              {rules.map((r) => (
                <li key={r} className="text-[12px] leading-snug text-white/80">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-fog">No bolo-checks block yet.</p>
          )}
        </Card>
        <Card icon={FileJson} title="Design tokens" source="tokens.json">
          <div className="flex flex-wrap gap-2">
            {colours.map(([k, v]) => (
              <div key={k} className="text-center">
                <span className="block size-9 rounded-lg ring-1 ring-white/15" style={{ background: v }} />
                <p className="mt-1 text-[9.5px] text-fog">{k}</p>
              </div>
            ))}
          </div>
          {typeof tokens.fontHead === "string" && (
            <p className="mt-2 text-[11.5px] text-fog">
              {tokens.fontHead} / {String(tokens.fontBody ?? "")}
            </p>
          )}
          {client.reraNumbers.length > 0 && <p className="mt-1 text-[11.5px] text-fog">RERA {client.reraNumbers.join(", ")}</p>}
        </Card>
      </div>

      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Brand Kit files">
          {client.files.map((f) => (
            <Link
              key={f.name}
              href={`?file=${encodeURIComponent(f.name)}`}
              scroll={false}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-mono text-[12px] transition-colors",
                f.name === current.name ? "bg-white/[0.09] text-white" : "text-fog hover:bg-white/[0.05] hover:text-white",
              )}
            >
              {f.name.endsWith(".json") ? <FileJson className="size-3.5" /> : <FileText className="size-3.5" />}
              {f.name}
            </Link>
          ))}
        </nav>
        <article className="min-w-0 rounded-xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
          {current.name.endsWith(".json") ? (
            <pre className="thin-scrollbar overflow-x-auto font-mono text-[12px] leading-relaxed text-white/85">{current.content}</pre>
          ) : (
            <Markdown source={current.content} />
          )}
        </article>
      </div>

      <section id="add-client" className="mx-5 mb-5 rounded-xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
        <h2 className="text-[14px] font-medium">Add a client</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-white/75">
          <li>
            Copy <span className="font-mono text-lime/90">brand-kits/{client.id}/</span> to <span className="font-mono text-lime/90">brand-kits/&lt;new-client&gt;/</span>{" "}
            and edit every file — at minimum <span className="font-mono">client.json</span>, <span className="font-mono">protocol.md</span> and{" "}
            <span className="font-mono">rules.md</span>.
          </li>
          <li>Upload the files to a new Switch package and attach it to the client&apos;s rooms (see switch/README.md).</li>
          <li>Reload this page — the new client appears as a tab.</li>
        </ol>
      </section>
    </main>
  );
}

function Card({ icon: Icon, title, source, children }: { icon: typeof Clock; title: string; source: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-white">
          <Icon className="size-4 text-lime" strokeWidth={1.75} /> {title}
        </p>
        <span className="font-mono text-[10px] text-fog">{source}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
