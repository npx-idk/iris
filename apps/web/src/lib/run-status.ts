// Semantic token mappings for run/execution status colors.
// Use these instead of hardcoded Tailwind color utilities.

// Uppercase RunStatus (PASSED / FAILED / RUNNING / QUEUED / CANCELLED)
export const runStatusDot: Record<string, string> = {
  PASSED: "bg-primary",
  FAILED: "bg-destructive",
  RUNNING: "bg-primary animate-pulse",
  QUEUED: "bg-muted-foreground",
  CANCELLED: "bg-muted",
}

export const runStatusText: Record<string, string> = {
  PASSED: "text-primary",
  FAILED: "text-destructive",
  RUNNING: "text-primary",
  QUEUED: "text-muted-foreground",
  CANCELLED: "text-muted-foreground",
}

export const runStatusSurface: Record<string, string> = {
  PASSED: "border-primary/30 bg-primary/5",
  FAILED: "border-destructive/30 bg-destructive/5",
}

// Lowercase NodeRunStatus (idle / waiting / running / passed / failed) — flow canvas
export const nodeRunStatusRing: Record<string, string> = {
  idle: "border-border",
  waiting: "border-border opacity-50",
  running:
    "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)] animate-pulse",
  passed: "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
  failed: "border-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.15)]",
}

export const nodeRunStatusDot: Record<string, string> = {
  idle: "bg-muted-foreground/30",
  waiting: "bg-muted-foreground/30",
  running: "bg-primary animate-pulse",
  passed: "bg-primary",
  failed: "bg-destructive",
}

export const nodeRunStatusText: Record<string, string> = {
  idle: "",
  waiting: "",
  running: "text-primary",
  passed: "text-primary",
  failed: "text-destructive",
}
