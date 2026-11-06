import { NextResponse } from "next/server";
import { refreshStore, WorkflowError, type User } from "@bolo/core";
import { requireUser } from "./auth";

function toResponse(e: unknown) {
  if (e instanceof WorkflowError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Public route handler (login, setup): WorkflowErrors become clean JSON errors. */
export async function handlePublic<T>(fn: () => Promise<T>) {
  try {
    await refreshStore();
    return NextResponse.json(await fn());
  } catch (e) {
    return toResponse(e);
  }
}

/** Signed-in route handler. Pass { admin: true } for admin-only actions. */
export async function handle<T>(fn: (user: User) => Promise<T>, opts: { admin?: boolean } = {}) {
  try {
    const user = await requireUser(opts);
    return NextResponse.json(await fn(user));
  } catch (e) {
    return toResponse(e);
  }
}

export async function body<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
