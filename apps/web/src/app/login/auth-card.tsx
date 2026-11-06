import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { LoginForm } from "./login-form";

/** The sign-in / sign-up / first-run card. */
export function AuthCard({ mode, next }: { mode: "login" | "setup" | "signup"; next: string }) {
  const title = mode === "setup" ? "Create the admin account" : mode === "signup" ? "Create your account" : "Sign in to the studio";
  const sub =
    mode === "setup"
      ? "First run — this account runs Bolo Studio: it sees every company and manages Switch, Postiz and Wispr Flow."
      : mode === "signup"
        ? "Then create your company, or accept an invite from a team that added you."
        : "Welcome back.";
  const q = next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : "";
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
          <h1 className="text-[20px] font-medium tracking-tight">{title}</h1>
          <p className="mt-1 text-[13px] text-fog">{sub}</p>
          <LoginForm mode={mode} next={mode === "signup" ? "/onboarding" : next} />
        </div>
        {mode === "login" && (
          <p className="mt-4 text-center text-[13px] text-fog">
            New here?{" "}
            <Link href={`/signup${q}`} className="text-lime hover:underline">
              Create an account
            </Link>
          </p>
        )}
        {mode === "signup" && (
          <p className="mt-4 text-center text-[13px] text-fog">
            Already have an account?{" "}
            <Link href={`/login${q}`} className="text-lime hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
