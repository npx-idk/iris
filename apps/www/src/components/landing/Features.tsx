import {
  MessageSquareText,
  MonitorPlay,
  Sparkles,
  Workflow,
  FolderTree,
  TerminalSquare,
  KeyRound,
  FileBarChart,
  ServerCog,
  type LucideIcon,
} from "lucide-react"
import {
  MockSteps,
  MockBrowser,
  MockGenerate,
  MockFlow,
  MockTerminal,
} from "./FeatureMocks"

function FeatureIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
      <Icon className="size-5" strokeWidth={1.5} />
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  mock,
}: {
  icon: LucideIcon
  title: string
  description: string
  mock?: React.ReactNode
}) {
  return (
    <div className="group flex flex-col bg-background p-8 transition-colors hover:bg-card">
      <FeatureIcon icon={icon} />
      <h3 className="mt-5 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {mock && <div className="mt-auto">{mock}</div>}
    </div>
  )
}

const COMPACT_FEATURES = [
  {
    icon: FolderTree,
    title: "Organized test suites",
    description:
      "Nested folders, drag-and-drop, and bulk actions keep hundreds of tests manageable. Export suites as JSON and import them anywhere.",
  },
  {
    icon: KeyRound,
    title: "Variables & secrets",
    description:
      "Store credentials once per workspace and reference them as {{variables}} in any step — secrets stay masked everywhere.",
  },
  {
    icon: FileBarChart,
    title: "Rich run reports",
    description:
      "Per-step screenshots, frame-by-frame recordings, and browser logs on every run. Edit the report and export it as Markdown.",
  },
  {
    icon: ServerCog,
    title: "Self-host in minutes",
    description:
      "MIT-licensed and built for your infrastructure: one docker-compose for Postgres, Redis, and MinIO, plus local or cloud browsers.",
  },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-14 border-t border-border">
      {/* Section header */}
      <div className="px-6 py-20 text-center">
        <p className="text-sm font-medium text-primary">Features</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-foreground md:text-5xl">
          Everything you need to ship with confidence
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-pretty text-muted-foreground md:text-lg">
          From writing your first test to gating production deploys — Iris
          covers the whole testing loop.
        </p>
      </div>

      {/* Marquee features with product depictions */}
      <div className="grid grid-cols-1 gap-px border-t border-border bg-border lg:grid-cols-2">
        <FeatureCard
          icon={MessageSquareText}
          title="Tests in plain English"
          description="Describe each step the way you'd explain it to a teammate. The AI agent finds the elements and performs the actions — no selectors to write or maintain."
          mock={<MockSteps />}
        />
        <FeatureCard
          icon={MonitorPlay}
          title="Live browser authoring"
          description="Build tests against a real browser you can see and control. Every frame streams live, with network, console, and storage panels right beside your steps."
          mock={<MockBrowser />}
        />
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={Sparkles}
          title="AI test generation"
          description="Point Iris at a page and it explores the UI, identifies the key journeys, and drafts ready-to-run scenarios to review and save."
          mock={<MockGenerate />}
        />
        <FeatureCard
          icon={Workflow}
          title="Flows & prerequisites"
          description="Chain tests visually on a canvas and reuse setup steps like login — state carries over in one browser session."
          mock={<MockFlow />}
        />
        <FeatureCard
          icon={TerminalSquare}
          title="CI/CD ready"
          description="Trigger runs from any pipeline with the CLI or REST API. Exit codes reflect results, so failing tests fail the build."
          mock={<MockTerminal />}
        />
      </div>

      {/* Compact features */}
      <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {COMPACT_FEATURES.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  )
}
