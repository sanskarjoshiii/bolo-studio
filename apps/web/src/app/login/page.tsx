import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasUsers } from "@bolo/core";
import { LogoMark } from "@/components/ui/logo";
import { LoginForm } from "./login-form";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in — Bolo Studio" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only same-site paths, never an absolute URL (open-redirect guard)
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await currentUser()) redirect(target);
  const setup = !hasUsers();

  return (
    <main
      className="grid min-h-dvh place-items-center bg-night p-4 text-white"
      style={{
        backgroundImage:
          "radial-gradient(900px 500px at 20% -10%, rgba(38,92,68,0.55), transparent 60%), radial-gradient(700px 600px at 110% 110%, rgba(30,84,60,0.45), transparent 60%)",
      }}
    >
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-[16px] font-semibold text-lime">
          <LogoMark className="size-6" /> <span className="text-white">Bolo Studio</span>
        </Link>
        <div className="mt-8 rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/[0.08] backdrop-blur">
          <h1 className="text-[20px] font-medium tracking-tight">{setup ? "Create the admin account" : "Sign in to the studio"}</h1>
          <p className="mt-1 text-[13px] text-fog">
            {setup
              ? "First run — this account manages the team. Add your Telegram username to approve posts from the dashboard."
              : "Use the account your admin created for you."}
          </p>
          <LoginForm setup={setup} next={target} />
        </div>
      </div>
    </main>
  );
}
