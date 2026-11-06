import { createCompany } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

/** Create a company — the signed-in account becomes its owner. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const b = await body<{ name: string; sector?: string; short?: string; primary?: string; accent?: string }>(req);
    return createCompany(me, { name: b.name ?? "", sector: b.sector ?? "", short: b.short, primary: b.primary, accent: b.accent });
  });
}
