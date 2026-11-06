"use client";

import { forwardRef, useEffect, useRef } from "react";
import Lenis from "lenis";
import { cn } from "@/lib/cn";

// Lenis smooth scrolling. The landing page scrolls the window; every studio page scrolls its own
// panel, so each panel gets its own Lenis instance. People who ask for reduced motion keep the
// browser's native scrolling. Nested scroll areas (drawers, dialogs, lists) opt out with
// data-lenis-prevent so they scroll on their own.

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const OPTIONS = { lerp: 0.11, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.2 } as const;

/** Window-level smooth scroll — for the landing pages. */
export function SmoothWindow() {
  useEffect(() => {
    if (reducedMotion()) return;
    const lenis = new Lenis({ ...OPTIONS, autoRaf: true, anchors: true });
    return () => lenis.destroy();
  }, []);
  return null;
}

/**
 * A scrolling studio panel: `<main>` is the Lenis wrapper, the inner div its content.
 * Use it wherever a page had `overflow-y-auto` on its main panel.
 */
export const ScrollMain = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { contentClassName?: string }>(function ScrollMain(
  { className, contentClassName, children, ...rest },
  ref,
) {
  const wrapper = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wrapper.current || !content.current || reducedMotion()) return;
    const lenis = new Lenis({ ...OPTIONS, wrapper: wrapper.current, content: content.current, autoRaf: true });
    return () => lenis.destroy();
  }, []);

  return (
    <main
      {...rest}
      ref={(el) => {
        wrapper.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      className={cn("thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]", className)}
    >
      <div ref={content} className={contentClassName}>
        {children}
      </div>
    </main>
  );
});
