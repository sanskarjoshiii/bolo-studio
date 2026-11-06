import { getClientStudio } from "@bolo/core";
import { isDateKey, istParts, weekStart } from "@bolo/core/shared";
import { CalendarView, type CalendarMode } from "@/components/studio/calendar-view";
import { SidePanel } from "@/components/studio/side-panel";

type Search = { view?: string; week?: string; date?: string; month?: string; post?: string };

/** The calendar of what's live: only posts that were published to social media. */
export default async function CalendarPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<Search> }) {
  const { clientId } = await params;
  const q = await searchParams;
  const { client, settings, posts } = getClientStudio(clientId);
  const live = posts.filter((p) => p.status === "live");

  const today = istParts(new Date()).dateKey;
  const mode: CalendarMode = q.view === "day" || q.view === "month" ? q.view : "week";
  const anchor =
    mode === "day"
      ? isDateKey(q.date) ? q.date : today
      : mode === "month"
        ? `${(isDateKey(q.month) ? q.month : today).slice(0, 7)}-01`
        : weekStart(`${isDateKey(q.week) ? q.week : today}T12:00:00+05:30`);

  return (
    <>
      <div className="hidden lg:flex">
        <SidePanel key={client.id} client={client} settings={settings} posts={posts} />
      </div>
      <CalendarView
        client={client}
        posts={live}
        mode={mode}
        anchor={anchor}
        today={today}
        filter="all"
        selectedId={q.post ?? null}
        pending={{ drafts: posts.filter((p) => p.status === "scheduled").length, approvals: posts.filter((p) => p.status === "awaiting" || p.status === "brand-check").length }}
      />
    </>
  );
}
