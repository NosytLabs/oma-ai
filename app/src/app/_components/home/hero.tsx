"use client";

/**
 * Home · Hero
 *
 * Product-first landing: clear value prop, dual CTAs (try / integrate),
 * and a live code strip that shows the OpenAI-compatible surface.
 */

import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { useHasBeenInView } from "./reveal";
import { LiveRequestCard } from "./LiveRequestCard";
import { springs } from "@/lib/animation";
import InteractiveLines from "@/components/originkit/ui/reactive-lines";

// Entrance animation props. Until the page has been live a moment
// (`enabled`), render plain HTML so the hero copy paints immediately —
// LCP-safe SSR, crawlers and screenshots see real content.
function reveal(index: number, enabled: boolean) {
  if (!enabled) return {};
  return {
    initial: { opacity: 0, y: 16, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: {
      ...springs.card, // stiffness 320 / damping 24 — Kinetics-style overshoot
      delay: 0.05 + index * 0.08,
    },
  };
}

export function Hero() {
  const entrance = useHasBeenInView();
  return (
    <section className="relative overflow-hidden min-h-[calc(100dvh-3.5rem)] flex items-center">
      {/* Interactive physics reactive-lines behind everything */}
      <div className="absolute inset-0 -z-20 opacity-[0.32] pointer-events-none">
        <InteractiveLines
          backgroundColor="transparent"
          lineColor="rgba(70, 211, 154, 0.16)"
          lineWidth={1}
          minLines={12}
          maxLines={36}
          fade={true}
          fadeIntensity={35}
        />
      </div>

      {/* Atmosphere — terminal void with aperture glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-0 right-0 -mr-[25%] w-[100%] aspect-[1/1] rounded-full bg-[radial-gradient(circle_at_center,var(--color-accent)_0%,transparent_50%)] opacity-[0.12] mix-blend-screen blur-[120px]" />
        <div className="absolute bottom-0 left-0 -ml-[25%] w-[100%] aspect-[1/1] rounded-full bg-[radial-gradient(circle_at_center,var(--color-tertiary)_0%,transparent_50%)] opacity-[0.08] mix-blend-screen blur-[120px]" />
        {/* Horizon rule — gateway threshold */}
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-border-hi to-transparent z-20" />
      </div>

      <div className="container-page relative z-10 min-w-0 py-20 lg:py-32 flex-1">
        <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
          <m.div
            {...reveal(0, entrance)}
            className="mb-8 flex items-center justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 text-[13px] font-medium text-text-secondary backdrop-blur-md">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Gateway online · v2
            </span>
          </m.div>

          <m.h1
            {...reveal(1, entrance)}
            className="text-balance text-5xl font-display font-medium leading-[1.05] tracking-tight text-text-bright sm:text-6xl md:text-7xl lg:text-8xl drop-shadow-[0_0_16px_rgba(255,255,255,0.08)]"
          >
            One endpoint.
            <br />
            <span className="text-accent italic pr-2 drop-shadow-[0_0_24px_var(--color-accent-glow)]">
              Every model.
            </span>
          </m.h1>

          <m.p
            {...reveal(2, entrance)}
            className="mt-8 text-balance text-lg text-text-secondary md:text-xl max-w-2xl mx-auto leading-relaxed"
          >
            Route inference through a single OpenAI-compatible API. Fund with
            card, deposit USDC on Base, or settle agent traffic per request with
            x402.
          </m.p>

          <m.div
            {...reveal(3, entrance)}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            <Link
              href="/login"
              className="group relative overflow-hidden inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-8 font-mono text-sm font-bold text-void transition-[background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.97] hover:bg-accent-bright hover:shadow-[0_0_20px_var(--color-accent-glow)] focus-ring"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-white/20" />
              </div>
              <KeyRound className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-base tracking-wide">Get API key</span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/chat"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-hi bg-surface/50 backdrop-blur-sm px-8 font-mono text-sm font-medium text-text-primary transition-[border-color,transform,background-color] duration-200 ease-out active:scale-[0.97] hover:border-accent/50 hover:bg-surface focus-ring"
            >
              <Sparkles
                className="h-5 w-5 text-text-muted group-hover:text-accent transition-colors duration-200 ease-out"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-base tracking-wide">Try chat</span>
            </Link>
          </m.div>

          <m.div
            {...reveal(4, entrance)}
            className="mt-16 w-full max-w-4xl mx-auto flex justify-center perspective-[1200px] min-h-[420px] md:min-h-[400px]"
          >
            <div className="transform-gpu transition-transform duration-200 ease-out duration-200 ease-out hover:rotate-x-[2deg] hover:rotate-y-[-1deg] hover:scale-[1.01] w-full flex justify-center h-[420px] md:h-[400px]">
              <LiveRequestCard className="shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] ring-1 ring-border-hi/50 w-full max-w-[706px]" />
            </div>
          </m.div>
        </div>
      </div>
    </section>
  );
}
