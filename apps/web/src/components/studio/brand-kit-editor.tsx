"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, FileJson, FileText, Loader2, Palette, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import type { BrandChecks, Client } from "@bolo/core";
import { api, useAction } from "./hooks";
import { ErrorNote } from "./controls";
import { Markdown } from "./markdown";
import { ScrollMain } from "@/components/ui/smooth-scroll";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50 disabled:opacity-60";

const TABS = [
  { id: "basics", label: "Company & look", icon: Palette },
  { id: "rules", label: "Brand rules", icon: ShieldCheck },
  { id: "times", label: "Posting times", icon: Clock },
  { id: "files", label: "All files", icon: FileText },
] as const;
type Tab = (typeof TABS)[number]["id"];

const FONTS = ["Inter", "Playfair Display", "Poppins", "Montserrat", "Lora", "DM Serif Display", "Noto Sans Devanagari", "Mukta"];

// ---------- helpers: the structured parts of the kit files ----------

function readTokens(client: Client): Record<string, unknown> {
  try {
    return JSON.parse(client.files.find((f) => f.name === "tokens.json")?.content ?? "{}");
  } catch {
    return {};
  }
}

const CHECKS_BLOCK = /```bolo-checks\s*[\s\S]*?```/;

/** rules.md with its bolo-checks block replaced (or added at the end). */
function withChecks(rules: string, checks: BrandChecks) {
  const block = "```bolo-checks\n" + JSON.stringify(checks, null, 2) + "\n```";
  return CHECKS_BLOCK.test(rules) ? rules.replace(CHECKS_BLOCK, block) : `${rules.trimEnd()}\n\n${block}\n`;
}

/** protocol.md with its "Best posting times" section rewritten. */
function withBestTimes(protocol: string, times: { label: string; time: string }[]) {
  const body = times.filter((t) => t.label.trim() && t.time.trim()).map((t) => `- ${t.label.trim()}: ${t.time.trim()}`).join("\n");
  const lines = protocol.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s/.test(l) && /best posting times/i.test(l));
  if (start < 0) return `${protocol.trimEnd()}\n\n## Best posting times (IST)\n${body}\n`;
  let end = start + 1;
  while (end < lines.length && !/^##\s/.test(lines[end])) end++;
  return [...lines.slice(0, start + 1), body, "", ...lines.slice(end)].join("\n").replace(/\n{3,}/g, "\n\n");
}

const list = (v: string) =>
  v
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

// ---------- the editor ----------

export function BrandKitEditor({ client, editable, initialTab, initialFile }: { client: Client; editable: boolean; initialTab?: string; initialFile?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.id === initialTab)?.id as Tab) ?? "basics");
  const go = (t: Tab) => {
    setTab(t);
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
  };

  return (
    <ScrollMain>
      <div className="border-b border-white/[0.05] px-5 py-4">
        <h1 className="text-[17px] font-medium tracking-tight">Brand Kit · {client.name}</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          Everything the AI and the designs follow — tone, rules, products, colours and fonts. {editable ? "Changes apply to the next post you generate." : "Only the owner or admins can edit it."}
        </p>
        <nav className="no-scrollbar mt-3 -mb-px flex gap-1 overflow-x-auto" aria-label="Brand Kit sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors", tab === id ? "bg-white/[0.09] text-white" : "text-fog hover:text-white")}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-5">
        {tab === "basics" && <Basics client={client} editable={editable} />}
        {tab === "rules" && <Rules client={client} editable={editable} />}
        {tab === "times" && <Times client={client} editable={editable} />}
        {tab === "files" && <Files client={client} editable={editable} initialFile={initialFile} />}
      </div>
    </ScrollMain>
  );
}

function SaveBar({ pending, error, clearError, saved, disabled, onSave }: { pending: boolean; error: string | null; clearError: () => void; saved: boolean; disabled?: boolean; onSave: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
      <div className="min-w-0 flex-1">
        <ErrorNote error={error} onClose={clearError} />
      </div>
      {saved && <span className="text-[12px] text-emerald-300">Saved</span>}
      <button onClick={onSave} disabled={pending || disabled} className="flex items-center gap-2 rounded-lg bg-lime px-4 py-2 text-[13px] font-medium text-night disabled:opacity-40">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
      </button>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.035] p-5 ring-1 ring-white/[0.06]">
      <h2 className="text-[14px] font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-[12px] text-fog">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] text-fog">{text}</span>
      {children}
    </label>
  );
}

function useSave(client: Client) {
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const save = async (patch: unknown) => {
    setSaved(false);
    if (await action.run(() => api(`/api/companies/${client.id}/kit`, "PATCH", patch))) setSaved(true);
  };
  return { ...action, saved, save };
}

function Basics({ client, editable }: { client: Client; editable: boolean }) {
  const tokens = readTokens(client);
  const str = (k: string, d: string) => (typeof tokens[k] === "string" ? String(tokens[k]) : d);
  const [name, setName] = useState(client.name);
  const [short, setShort] = useState(client.short);
  const [sector, setSector] = useState(client.sector);
  const [colors, setColors] = useState({ primary: str("primary", client.mark.bg), accent: str("accent", client.mark.fg), bg: str("bg", "#F7F5F0"), text: str("text", "#1A1A1A") });
  const [fontHead, setFontHead] = useState(str("fontHead", "Inter"));
  const [fontBody, setFontBody] = useState(str("fontBody", "Inter"));
  const [handles, setHandles] = useState(Object.fromEntries(client.channels.map((c) => [c.platform, c.handle])) as Record<string, string>);
  const s = useSave(client);

  const save = () =>
    s.save({
      meta: { name, short, sector, mark: { bg: colors.primary, fg: colors.accent }, channels: client.channels.map((c) => ({ ...c, handle: handles[c.platform] ?? c.handle })) },
      files: [{ name: "tokens.json", content: `${JSON.stringify({ ...tokens, ...colors, fontHead, fontBody }, null, 2)}\n` }],
    });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Panel title="Company">
          <div className="grid gap-3 sm:grid-cols-2">
            <Label text="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} className={field} />
            </Label>
            <Label text="Short name (on small designs)">
              <input value={short} onChange={(e) => setShort(e.target.value)} disabled={!editable} className={field} />
            </Label>
          </div>
          <Label text="What you do, and where">
            <input value={sector} onChange={(e) => setSector(e.target.value)} disabled={!editable} className={field} />
          </Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {client.channels.map((c) => (
              <Label key={c.platform} text={`${c.platform[0].toUpperCase()}${c.platform.slice(1)} handle`}>
                <input value={handles[c.platform] ?? ""} onChange={(e) => setHandles((h) => ({ ...h, [c.platform]: e.target.value }))} disabled={!editable} placeholder="@yourbrand" className={field} />
              </Label>
            ))}
          </div>
        </Panel>
        <Panel title="Colours" hint="Every design and reel is built from these.">
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ["primary", "Main colour"],
                ["accent", "Accent"],
                ["bg", "Light background"],
                ["text", "Text"],
              ] as const
            ).map(([k, label]) => (
              <Label key={k} text={label}>
                <span className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2 py-1.5 ring-1 ring-white/[0.08]">
                  <input type="color" value={colors[k]} disabled={!editable} onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value.toUpperCase() }))} className="size-7 cursor-pointer rounded border-0 bg-transparent" aria-label={label} />
                  <span className="font-mono text-[12px] text-white/80">{colors[k]}</span>
                </span>
              </Label>
            ))}
          </div>
        </Panel>
        <Panel title="Fonts">
          <div className="grid gap-3 sm:grid-cols-2">
            <Label text="Headlines">
              <select value={fontHead} onChange={(e) => setFontHead(e.target.value)} disabled={!editable} className={cn(field, "[color-scheme:dark]")}>
                {[...new Set([fontHead, ...FONTS])].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Label>
            <Label text="Body text">
              <select value={fontBody} onChange={(e) => setFontBody(e.target.value)} disabled={!editable} className={cn(field, "[color-scheme:dark]")}>
                {[...new Set([fontBody, ...FONTS])].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Label>
          </div>
        </Panel>
        {editable && <SaveBar pending={s.pending} error={s.error} clearError={s.clearError} saved={s.saved} onSave={save} />}
      </div>
      <aside className="xl:sticky xl:top-4 xl:self-start">
        <p className="mb-2 text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Preview</p>
        <div className="overflow-hidden rounded-xl ring-1 ring-white/10" style={{ background: colors.primary }}>
          <div className="aspect-[4/5] p-6" style={{ fontFamily: fontBody === "Inter" ? "var(--font-inter)" : fontBody }}>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: colors.accent }}>
              {short || "Brand"}
            </p>
            <p className="mt-4 text-[30px] leading-[1.05] font-semibold text-white" style={{ fontFamily: fontHead === "Playfair Display" ? "var(--font-playfair)" : fontHead === "Inter" ? "var(--font-inter)" : fontHead }}>
              Your headline, in your <span style={{ color: colors.accent }}>colours</span>
            </p>
            <p className="mt-3 text-[13px] text-white/80">Supporting line · offer · details</p>
            <span className="mt-6 inline-block rounded-full px-4 py-2 text-[12px] font-semibold" style={{ background: colors.accent, color: colors.primary }}>
              Call to action →
            </span>
          </div>
          <div className="p-4" style={{ background: colors.bg, color: colors.text }}>
            <p className="text-[12px]">Light background and text colour</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Rules({ client, editable }: { client: Client; editable: boolean }) {
  const c = client.checks;
  const [banned, setBanned] = useState((c.banned ?? []).join("\n"));
  const [competitors, setCompetitors] = useState((c.competitors ?? []).join("\n"));
  const [replace, setReplace] = useState(Object.entries(c.replace ?? {}).map(([a, b]) => `${a} → ${b}`).join("\n"));
  const [cta, setCta] = useState((c.requireCta ?? []).join("\n"));
  const [priceWord, setPriceWord] = useState(c.price?.requireWord ?? "");
  const [footnote, setFootnote] = useState(c.price?.footnote ?? "");
  const [igTags, setIgTags] = useState(String(c.maxHashtags?.instagram ?? 8));
  const [liTags, setLiTags] = useState(String(c.maxHashtags?.linkedin ?? 3));
  const [rera, setRera] = useState(Boolean(c.requireRera));
  const s = useSave(client);
  const rules = client.files.find((f) => f.name === "rules.md")?.content ?? "# Rules\n";

  const save = () => {
    const checks: BrandChecks = {
      ...c,
      banned: list(banned),
      competitors: list(competitors),
      replace: Object.fromEntries(
        replace
          .split("\n")
          .map((l) => l.split(/\s*(?:→|->|=>)\s*/))
          .filter((x) => x.length === 2 && x[0].trim() && x[1].trim())
          .map(([a, b]) => [a.trim(), b.trim()]),
      ),
      requireCta: list(cta),
      maxHashtags: { ...(c.maxHashtags ?? {}), instagram: Number(igTags) || 8, linkedin: Number(liTags) || 3 },
      requireRera: rera || undefined,
    };
    if (priceWord.trim()) checks.price = { ...(c.price ?? {}), requireWord: priceWord.trim(), footnote: footnote.trim() || undefined };
    else delete checks.price;
    if (!checks.requireCta?.length) delete checks.requireCta;
    s.save({ files: [{ name: "rules.md", content: withChecks(rules, checks) }] });
  };

  return (
    <div className="max-w-[900px] space-y-4">
      <Panel title="Never say" hint="Brand Guard blocks a post that uses any of these. One per line.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Banned words or claims">
            <textarea rows={5} value={banned} onChange={(e) => setBanned(e.target.value)} disabled={!editable} placeholder={"guaranteed returns\nbest in Pune"} className={cn(field, "resize-y")} />
          </Label>
          <Label text="Competitor names">
            <textarea rows={5} value={competitors} onChange={(e) => setCompetitors(e.target.value)} disabled={!editable} placeholder="Other Builders Ltd" className={cn(field, "resize-y")} />
          </Label>
        </div>
      </Panel>
      <Panel title="Say it better" hint="Brand Guard fixes these automatically. One per line: word → replacement.">
        <textarea rows={4} value={replace} onChange={(e) => setReplace(e.target.value)} disabled={!editable} placeholder={"cheap → affordable\ncure → care"} className={cn(field, "resize-y font-mono text-[12.5px]")} />
      </Panel>
      <Panel title="Always include">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Call to action words (one must appear in every caption)">
            <textarea rows={3} value={cta} onChange={(e) => setCta(e.target.value)} disabled={!editable} placeholder={"site visit\nbook"} className={cn(field, "resize-y")} />
          </Label>
          <div className="space-y-3">
            <Label text="Word after every price (e.g. onwards)">
              <input value={priceWord} onChange={(e) => setPriceWord(e.target.value)} disabled={!editable} placeholder="onwards" className={field} />
            </Label>
            <Label text="Line when a price appears">
              <input value={footnote} onChange={(e) => setFootnote(e.target.value)} disabled={!editable} placeholder="*T&C apply" className={field} />
            </Label>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-white/85">
          <input type="checkbox" checked={rera} onChange={(e) => setRera(e.target.checked)} disabled={!editable} className="size-4 accent-lime" />
          Real estate: a RERA number on every project design (from products.md)
        </label>
      </Panel>
      <Panel title="Hashtags">
        <div className="grid max-w-[360px] grid-cols-2 gap-3">
          <Label text="Instagram, at most">
            <input type="number" min={0} max={30} value={igTags} onChange={(e) => setIgTags(e.target.value)} disabled={!editable} className={field} />
          </Label>
          <Label text="LinkedIn, at most">
            <input type="number" min={0} max={30} value={liTags} onChange={(e) => setLiTags(e.target.value)} disabled={!editable} className={field} />
          </Label>
        </div>
      </Panel>
      <p className="text-[12px] text-fog">The tone of voice, audience, products and examples are in “All files” — brand.md, audience.md, products.md, examples.md.</p>
      {editable && <SaveBar pending={s.pending} error={s.error} clearError={s.clearError} saved={s.saved} onSave={save} />}
    </div>
  );
}

function Times({ client, editable }: { client: Client; editable: boolean }) {
  const [times, setTimes] = useState(client.bestTimes.length ? client.bestTimes : [{ label: "Instagram / Facebook", time: "7:30 PM" }]);
  const s = useSave(client);
  const protocol = client.files.find((f) => f.name === "protocol.md")?.content ?? "# Protocol\n";
  const bad = times.some((t) => t.time.trim() && !/\d{1,2}(:\d{2})?\s*(AM|PM)/i.test(t.time));
  return (
    <div className="max-w-[680px] space-y-4">
      <Panel title="Best posting times (IST)" hint="New posts are scheduled at the next of these. Write times like 7:30 PM.">
        <ul className="space-y-2">
          {times.map((t, i) => (
            <li key={i} className="flex gap-2">
              <input value={t.label} onChange={(e) => setTimes((cur) => cur.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} disabled={!editable} placeholder="Instagram" className={field} aria-label="Where" />
              <input value={t.time} onChange={(e) => setTimes((cur) => cur.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)))} disabled={!editable} placeholder="7:30 PM" className={cn(field, "w-40")} aria-label="Time" />
              {editable && (
                <button onClick={() => setTimes((cur) => cur.filter((_, k) => k !== i))} aria-label="Remove time" className="grid size-9 shrink-0 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-red-300">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <button onClick={() => setTimes((cur) => [...cur, { label: "", time: "" }])} className="flex items-center gap-1 text-[12px] text-lime hover:underline">
            <Plus className="size-3.5" /> Add a time
          </button>
        )}
        {bad && <p className="text-[12px] text-amber-200">Write times like 10:00 AM or 7:30 PM.</p>}
      </Panel>
      {editable && <SaveBar pending={s.pending} error={s.error} clearError={s.clearError} saved={s.saved} disabled={bad} onSave={() => s.save({ files: [{ name: "protocol.md", content: withBestTimes(protocol, times) }] })} />}
    </div>
  );
}

const REQUIRED = new Set(["brand.md", "rules.md", "protocol.md", "tokens.json"]);

function Files({ client, editable, initialFile }: { client: Client; editable: boolean; initialFile?: string }) {
  const [name, setName] = useState(client.files.find((f) => f.name === initialFile)?.name ?? client.files[0]?.name ?? "brand.md");
  const current = useMemo(() => client.files.find((f) => f.name === name), [client.files, name]);
  const [draft, setDraft] = useState(current?.content ?? "");
  const [mode, setMode] = useState<"edit" | "preview">(editable ? "edit" : "preview");
  const [newName, setNewName] = useState("");
  const s = useSave(client);
  const dirty = draft !== (current?.content ?? "");

  const open = (n: string) => {
    if (dirty && !confirm("Discard unsaved changes to this file?")) return;
    setName(n);
    setDraft(client.files.find((f) => f.name === n)?.content ?? "");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav className="space-y-1" aria-label="Brand Kit files">
        {client.files.map((f) => (
          <button
            key={f.name}
            onClick={() => open(f.name)}
            className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-mono text-[12px] transition-colors", f.name === name ? "bg-white/[0.09] text-white" : "text-fog hover:bg-white/[0.05] hover:text-white")}
          >
            {f.name.endsWith(".json") ? <FileJson className="size-3.5" /> : <FileText className="size-3.5" />}
            {f.name}
          </button>
        ))}
        {editable && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/(\.md)?$/, ".md");
              if (client.files.some((f) => f.name === n)) return open(n);
              s.save({ files: [{ name: n, content: `# ${n.replace(/\.md$/, "")}\n\n` }] }).then(() => setNewName(""));
            }}
            className="flex gap-1 pt-2"
          >
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="new-file.md" className={cn(field, "py-1.5 font-mono text-[12px]")} aria-label="New file name" />
            <button disabled={!newName.trim()} className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-lime disabled:opacity-40" aria-label="Add file">
              <Plus className="size-4" />
            </button>
          </form>
        )}
      </nav>
      <article className="min-w-0 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2">
          <p className="flex-1 font-mono text-[12.5px] text-white/85">{name}</p>
          {name.endsWith(".md") && (
            <div className="flex rounded-lg bg-white/[0.05] p-0.5">
              {(editable ? (["edit", "preview"] as const) : (["preview"] as const)).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-2.5 py-1 text-[11.5px] capitalize", mode === m ? "bg-white/[0.1] text-white" : "text-fog")}>
                  {m}
                </button>
              ))}
            </div>
          )}
          {editable && !REQUIRED.has(name) && (
            <button
              onClick={() => confirm(`Delete ${name}?`) && s.save({ removeFiles: [name] }).then(() => setName("brand.md"))}
              className="grid size-7 place-items-center rounded-md text-fog hover:bg-white/[0.06] hover:text-red-300"
              aria-label={`Delete ${name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <div className="p-4">
          {mode === "edit" && editable ? (
            <textarea
              data-lenis-prevent
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={name.endsWith(".md")}
              className={cn(field, "thin-scrollbar min-h-[460px] resize-y font-mono text-[12.5px] leading-relaxed")}
            />
          ) : name.endsWith(".json") ? (
            <pre className="thin-scrollbar overflow-x-auto font-mono text-[12px] leading-relaxed text-white/85">{draft}</pre>
          ) : (
            <Markdown source={draft} />
          )}
          {editable && <SaveBar pending={s.pending} error={s.error} clearError={s.clearError} saved={s.saved && !dirty} disabled={!dirty} onSave={() => s.save({ files: [{ name, content: draft }] })} />}
        </div>
      </article>
    </div>
  );
}
