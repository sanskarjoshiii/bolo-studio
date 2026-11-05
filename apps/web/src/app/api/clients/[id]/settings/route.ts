import { updateSettings, type ClientSettings } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => updateSettings(id, await body<Partial<ClientSettings>>(req)));
}
