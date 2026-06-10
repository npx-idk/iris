/**
 * Decorative mock-UI panels that depict product features on the landing page.
 * Pure presentational markup — swap for real product screenshots later.
 */

function MockShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none mt-8 overflow-hidden rounded-xl border border-border bg-card/50 select-none"
    >
      {children}
    </div>
  )
}

/** Plain-English steps: passed rows + one running + the instruction input. */
export function MockSteps() {
  const steps = [
    "Go to the login page",
    "Sign in as {{email}}",
    "Add the first product to the cart",
  ]
  return (
    <MockShell>
      <div className="space-y-2 p-4">
        {steps.map((step) => (
          <div
            key={step}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate text-xs text-muted-foreground">
              {step}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-background px-3 py-2">
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
          <span className="truncate text-xs text-foreground">
            Complete checkout and verify the order number…
          </span>
        </div>
      </div>
    </MockShell>
  )
}

/** Live browser: chrome bar, streaming viewport, devtools tabs. */
export function MockBrowser() {
  return (
    <MockShell>
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        <span className="size-2 rounded-full bg-primary/70" />
        <div className="ml-2 flex h-5 flex-1 items-center rounded-md bg-muted/60 px-2.5">
          <span className="font-mono text-[10px] text-muted-foreground/70">
            shop.example.com/checkout
          </span>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary">
          <span className="size-1 animate-pulse rounded-full bg-primary" />
          LIVE
        </span>
      </div>
      {/* Page skeleton */}
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-1/3 rounded bg-muted/70" />
        <div className="h-2.5 w-2/3 rounded bg-muted/50" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="h-10 rounded-md bg-muted/40" />
          <div className="h-10 rounded-md bg-muted/40" />
          <div className="h-10 rounded-md border border-primary/50 bg-primary/10" />
        </div>
      </div>
      {/* Devtools tabs */}
      <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
        <span className="text-foreground">Network</span>
        <span>Console</span>
        <span>Application</span>
        <span className="ml-auto font-mono text-primary">200 GET /cart</span>
      </div>
    </MockShell>
  )
}

/** AI generation: sparkle header + generated scenarios with checkboxes. */
export function MockGenerate() {
  const tests = [
    { name: "Add to cart from search", checked: true },
    { name: "Apply a discount code", checked: true },
    { name: "Checkout as guest", checked: false },
  ]
  return (
    <MockShell>
      <div className="border-b border-border px-4 py-2 text-[10px] text-muted-foreground">
        ✦ Explored 14 elements · 3 tests generated
      </div>
      <div className="space-y-2 p-4">
        {tests.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
          >
            <span
              className={`flex size-3 shrink-0 items-center justify-center rounded-sm border text-[8px] ${
                t.checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40"
              }`}
            >
              {t.checked ? "✓" : ""}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {t.name}
            </span>
          </div>
        ))}
      </div>
    </MockShell>
  )
}

/** Flow canvas: three connected nodes with run states. */
export function MockFlow() {
  return (
    <MockShell>
      <svg viewBox="0 0 320 120" className="block w-full">
        <line
          x1="92"
          y1="60"
          x2="128"
          y2="60"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <line
          x1="212"
          y1="60"
          x2="248"
          y2="60"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        {/* passed node */}
        <rect
          x="16"
          y="42"
          width="76"
          height="36"
          rx="8"
          fill="var(--background)"
          stroke="var(--primary)"
        />
        <circle cx="30" cy="60" r="3" fill="var(--primary)" />
        <text x="40" y="63" fontSize="9" fill="var(--muted-foreground)">
          Login
        </text>
        {/* running node */}
        <rect
          x="128"
          y="42"
          width="84"
          height="36"
          rx="8"
          fill="var(--background)"
          stroke="var(--primary)"
          strokeDasharray="4 3"
        />
        <circle cx="142" cy="60" r="3" fill="var(--primary)">
          <animate
            attributeName="opacity"
            values="1;0.2;1"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
        <text x="152" y="63" fontSize="9" fill="var(--foreground)">
          Add to cart
        </text>
        {/* queued node */}
        <rect
          x="248"
          y="42"
          width="60"
          height="36"
          rx="8"
          fill="var(--background)"
          stroke="var(--border)"
        />
        <circle cx="262" cy="60" r="3" fill="var(--muted-foreground)" />
        <text x="272" y="63" fontSize="9" fill="var(--muted-foreground)">
          Pay
        </text>
      </svg>
    </MockShell>
  )
}

/** CI terminal: CLI invocation and a green exit. */
export function MockTerminal() {
  return (
    <MockShell>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground/70">ci.yml</span>
      </div>
      <div className="space-y-1.5 p-4 font-mono text-[10px] leading-relaxed">
        <p className="text-muted-foreground">
          <span className="text-primary">$</span> npx @iris/cli run --project
          web
        </p>
        <p className="text-muted-foreground/70">⠿ running 12 tests…</p>
        <p className="text-primary">✓ 12 passed · 0 failed</p>
        <p className="text-muted-foreground/70">exit code 0</p>
      </div>
    </MockShell>
  )
}
