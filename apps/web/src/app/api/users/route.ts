import { createUser, listUsers, type Role } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

export async function GET() {
  return handle(async () => listUsers());
}

/** Admins add teammates with a starting password they share privately. */
export async function POST(req: Request) {
  return handle(
    async () => {
      const b = await body<{ email: string; name: string; password: string; role?: Role; telegram?: string }>(req);
      return createUser({ ...b, role: b.role === "admin" ? "admin" : "member" });
    },
    { admin: true },
  );
}
