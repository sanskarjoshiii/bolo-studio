import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasUsers } from "@bolo/core";
import { AuthCard } from "./auth-card";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in — Bolo Studio" };


export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const target = safeNext((await searchParams).next);
  if (await currentUser()) redirect(target);
  return <AuthCard mode={hasUsers() ? "login" : "setup"} next={target} />;
}
