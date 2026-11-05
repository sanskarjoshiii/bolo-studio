import { getClientStudio, type PostStatus } from "@bolo/core";
import { isDateKey, istParts, weekStart } from "@bolo/core/shared";
import { CalendarView, type CalendarMode } from "@/components/studio/calendar-view";
import { SidePanel } from "@/components/studio/side-panel";
import { STATUS_ORDER } from "@/lib/status";

type Search = { view?: string; week?: string; date?: string; month?: string; status?: string; post?: string };

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<Search> }) {
  const { clientId } = await params;
  const q = await searchParams;
  const { client, settings, posts } = getClientStudio(clientId);

  const today = istParts(new Date()).dateKey;
  const mode: CalendarMode = q.view === "day" || q.view === "month" ? q.view : "week";
  const anchor =
    mode === "day"
      ? isDateKey(q.date) ? q.date : today
      : mode === "month"
        ? `${(isDateKey(q.month) ? q.month : today).slice(0, 7)}-01`
        : weekStart(`${isDateKey(q.week) ? q.week : today}T12:00:00+05:30`);
  const filter = (STATUS_ORDER as string[]).includes(q.status ?? "") ? (q.status as PostStatus) : "all";

  return (
    <>
      <div className="hidden lg:flex">
        <SidePanel key={client.id} client={client} settings={settings} posts={posts} />
      </div>
      <CalendarView client={client} posts={posts} mode={mode} anchor={anchor} today={today} filter={filter} selectedId={q.post ?? null} />
    </>
  );
}
