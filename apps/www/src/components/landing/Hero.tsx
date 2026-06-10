import Link from "next/link"
import { Button } from "@iris/ui/components/button"
import { Tiles } from "@iris/ui/components/tiles"
import { APP_URL, GITHUB_URL } from "@/lib/site"

export function Hero() {
  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background">
      {/* Grid background */}
      <div className="absolute inset-0">
        <Tiles rows={60} cols={48} tileSize="sm" className="h-full w-full" />
        {/* Center vignette: solid background behind the copy so the text reads
            cleanly, fading out so the grid stays visible toward the edges */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_50%,var(--background)_35%,transparent_100%)]" />
        {/* Gradual fade of the grid at the top and bottom edges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Content — pointer-events disabled on the wrapper so tile hover works
          everywhere except the interactive elements themselves */}
      <div className="pointer-events-none relative z-10 flex max-w-4xl flex-col items-center gap-6 px-6 text-center">
        <Link
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          Open Source · MIT
        </Link>

        <h1 className="text-5xl font-semibold tracking-tight text-balance md:text-7xl">
          <span className="text-primary">The AI-Native</span>
          <br />
          <span className="text-foreground">End-to-End Testing Platform</span>
        </h1>

        <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
          Write test steps in plain English. Iris runs them in a real browser,
          streams every frame live, and plugs straight into your CI — no
          selectors, no flaky scripts.
        </p>

        <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild className="min-w-44">
            <Link href={APP_URL}>Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="min-w-44">
            <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
