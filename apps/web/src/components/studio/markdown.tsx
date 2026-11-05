import { Fragment } from "react";

// Small renderer for Brand Kit files: headings, lists, code fences, paragraphs,
// `code` and **bold**. Builds React nodes — never injects raw HTML.

function inline(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.92em] text-lime/90">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      out.push(
        <div key={out.length} className="my-3 overflow-hidden rounded-lg bg-black/30 ring-1 ring-white/[0.06]">
          {lang && <p className="border-b border-white/[0.06] px-3 py-1.5 font-mono text-[10.5px] text-fog">{lang}</p>}
          <pre className="thin-scrollbar overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-white/85">{body.join("\n")}</pre>
        </div>,
      );
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const cls = h[1].length === 1 ? "mt-1 mb-3 text-[20px] font-medium tracking-tight text-white" : "mt-5 mb-2 text-[14px] font-medium text-white";
      out.push(
        <p key={out.length} className={cls}>
          {inline(h[2])}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*(-|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*(-|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*(-|\d+\.)\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(-|\d+\.)\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(item);
      }
      const List = ordered ? "ol" : "ul";
      out.push(
        <List key={out.length} className={`my-2 space-y-1 pl-5 text-[13px] leading-relaxed text-white/80 ${ordered ? "list-decimal" : "list-disc marker:text-fog"}`}>
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|```|\s*(-|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(
      <p key={out.length} className="my-2 text-[13px] leading-relaxed text-white/80">
        {inline(para.join(" "))}
      </p>,
    );
  }

  return <div>{out}</div>;
}
