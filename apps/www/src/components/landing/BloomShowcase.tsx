"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
} from "motion/react"
import { Bug, Check, X } from "lucide-react"

const PETAL = "M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"

/* ── Starfield ────────────────────────────────────────────────────────────── */

/** Deterministic PRNG so the starfield matches between server and client. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260610)

const STARS = Array.from({ length: 110 }, (_, i) => ({
  id: i,
  top: `${(rand() * 96).toFixed(2)}%`,
  left: `${(rand() * 98).toFixed(2)}%`,
  size: 1 + rand() * 2.2,
  baseOpacity: 0.12 + rand() * 0.25,
  peakOpacity: 0.45 + rand() * 0.45,
  duration: 2.5 + rand() * 4.5,
  delay: rand() * 6,
  sparkle: i % 14 === 0, // a few four-point sparkles among the dots
}))

/** Four-point sparkle for the brightest stars. */
function SparkleShape({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: size * 4.5, height: size * 4.5 }}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0 C13 8 14 9 22 12 C14 15 13 16 12 24 C11 16 10 15 2 12 C10 9 11 8 12 0 Z" />
    </svg>
  )
}

/** Twinkling stars behind the mark. */
function Starfield() {
  return (
    <div
      className="pointer-events-none absolute inset-0 text-foreground"
      aria-hidden
    >
      {STARS.map((star) => (
        <motion.span
          key={star.id}
          className="absolute"
          style={{ top: star.top, left: star.left }}
          animate={{
            opacity: [star.baseOpacity, star.peakOpacity, star.baseOpacity],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {star.sparkle ? (
            <SparkleShape size={star.size} />
          ) : (
            <span
              className="block rounded-full bg-current"
              style={{ width: star.size, height: star.size }}
            />
          )}
        </motion.span>
      ))}
    </div>
  )
}

/* ── Radar rings ──────────────────────────────────────────────────────────── */

const RING_SCALE_START = 0.55
const RING_SCALE_END = 2.2
const RING_DURATION_MS = 7500
const RING_SPACING_MS = 3750

/** Radar-style rings pulsing outward from behind the bloom. */
function PulseRings() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {[0, 3.75].map((delay) => (
        <motion.div
          key={delay}
          className="absolute size-80 rounded-full border border-foreground/20 md:size-96"
          initial={{ scale: RING_SCALE_START, opacity: 0 }}
          animate={{
            scale: [RING_SCALE_START, RING_SCALE_END],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            scale: {
              duration: RING_DURATION_MS / 1000,
              repeat: Infinity,
              delay,
              ease: "linear",
            },
            opacity: {
              duration: RING_DURATION_MS / 1000,
              times: [0, 0.25, 1],
              repeat: Infinity,
              delay,
              ease: "linear",
            },
          }}
        />
      ))}
    </div>
  )
}

/* ── Detections (synced to ring sweep) ────────────────────────────────────── */

const DETECTION_POINTS: Array<{
  angle: number // degrees, 0 = right, clockwise
  radiusFactor: number // multiple of the ring base radius
  kind: "pass" | "fail" | "issue"
  text: string
}> = [
  {
    angle: 205,
    radiusFactor: 1.05,
    kind: "pass",
    text: "Checkout flow · passed",
  },
  {
    angle: 345,
    radiusFactor: 1.18,
    kind: "issue",
    text: "Captured: console error",
  },
  {
    angle: 25,
    radiusFactor: 1.02,
    kind: "fail",
    text: "Login redirect · failed",
  },
  {
    angle: 150,
    radiusFactor: 1.16,
    kind: "pass",
    text: "Search · 8 steps passed",
  },
  {
    angle: 290,
    radiusFactor: 1.1,
    kind: "pass",
    text: "Signup flow · passed",
  },
  {
    angle: 110,
    radiusFactor: 1.14,
    kind: "issue",
    text: "Captured: 500 on /cart",
  },
]

const DETECTION_STYLE = {
  pass: { Icon: Check, className: "text-primary" },
  fail: { Icon: X, className: "text-destructive" },
  issue: { Icon: Bug, className: "text-muted-foreground" },
} as const

type ActiveDetection = {
  id: number
  point: (typeof DETECTION_POINTS)[number]
  x: number
  y: number
}

/** Fraction of a ring cycle at which the ring crosses `radius`. */
function hitThreshold(radius: number, ringBase: number) {
  return (
    (radius / ringBase - RING_SCALE_START) / (RING_SCALE_END - RING_SCALE_START)
  )
}

/**
 * Fires a detection exactly when an expanding radar ring crosses its radius:
 * a ping blip at the point plus a notification chip pinned right next to it.
 *
 * Sync strategy: a motion-value clock runs on the same animation timeline as
 * the rings (linear, same duration), and each frame we check whether any
 * ring's expansion progress crossed the next point's radius threshold.
 */
function Detections() {
  const [active, setActive] = useState<ActiveDetection[]>([])
  // ring base radius: size-80 (160) on small screens, size-96 (192) from md up
  const geoRef = useRef({ ringBase: 192, maxRadius: 999 })
  const clock = useMotionValue(0)
  const lastAbsRef = useRef(0)
  const cyclesRef = useRef(0)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const measure = useCallback(() => {
    const md = window.matchMedia("(min-width: 768px)").matches
    geoRef.current = {
      ringBase: md ? 192 : 160,
      maxRadius: window.innerWidth / 2 - 90,
    }
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    const controls = animate(clock, RING_DURATION_MS, {
      duration: RING_DURATION_MS / 1000,
      ease: "linear",
      repeat: Infinity,
    })
    const pending = timers.current
    return () => {
      controls.stop()
      window.removeEventListener("resize", measure)
      pending.forEach(clearTimeout)
    }
  }, [clock, measure])

  useMotionValueEvent(clock, "change", (ms) => {
    // reconstruct absolute time across the looping clock
    const prevAbs = lastAbsRef.current
    const prevMs = prevAbs - cyclesRef.current * RING_DURATION_MS
    if (ms < prevMs) cyclesRef.current++
    const abs = cyclesRef.current * RING_DURATION_MS + ms
    lastAbsRef.current = abs

    const { ringBase, maxRadius } = geoRef.current

    // two rings, launched RING_SPACING_MS apart
    for (let k = 0; k < 2; k++) {
      const offset = k * RING_SPACING_MS
      if (abs < offset || prevAbs < offset) continue
      const p = ((abs - offset) % RING_DURATION_MS) / RING_DURATION_MS
      const lastP = ((prevAbs - offset) % RING_DURATION_MS) / RING_DURATION_MS

      // which launch of this ring is in flight, and which point it scans
      const launchIndex = Math.floor((abs - offset) / RING_DURATION_MS) * 2 + k
      const point = DETECTION_POINTS[launchIndex % DETECTION_POINTS.length]!
      const radius = Math.min(point.radiusFactor * ringBase, maxRadius)
      const threshold = hitThreshold(radius, ringBase)

      const crossed =
        (lastP < threshold && p >= threshold) ||
        // cycle wrapped between frames and we're already past the threshold
        (p < lastP && p >= threshold)
      if (!crossed) continue

      const rad = (point.angle * Math.PI) / 180
      const x = Math.cos(rad) * radius
      const y = Math.sin(rad) * radius
      const id = launchIndex
      setActive((prev) =>
        prev.some((d) => d.id === id) ? prev : [...prev, { id, point, x, y }]
      )
      timers.current.push(
        setTimeout(
          () => setActive((prev) => prev.filter((d) => d.id !== id)),
          2200
        )
      )
    }
  })

  return (
    <div
      className="pointer-events-none absolute top-1/2 left-1/2 z-20"
      aria-hidden
    >
      <AnimatePresence>
        {active.map(({ id, point, x, y }) => {
          const { Icon, className } = DETECTION_STYLE[point.kind]
          // chip extends outward: left of the blip on the logo's left side, right on its right
          const chipOnLeft = x < 0
          return (
            <motion.div
              key={id}
              className="absolute"
              style={{ left: x, top: y }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* echo burst exactly where the ring hit */}
              <motion.span
                className="absolute -top-6 -left-6 size-12 rounded-full border-2 border-foreground/70"
                initial={{ scale: 0.2, opacity: 0.9 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
              {/* blip at the exact hit point */}
              <span className="absolute -top-1.5 -left-1.5 flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60" />
                <span className="relative inline-flex size-3 rounded-full bg-foreground" />
              </span>
              {/* chip pinned beside the blip */}
              <div
                className={`absolute top-0 flex w-max max-w-[60vw] -translate-y-1/2 items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 backdrop-blur-sm ${
                  chipOnLeft ? "right-4" : "left-4"
                }`}
              >
                <Icon
                  className={`size-3 shrink-0 ${className}`}
                  strokeWidth={2.5}
                />
                <span className="truncate text-xs text-foreground">
                  {point.text}
                </span>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/* ── Comet ────────────────────────────────────────────────────────────────── */

type CometFlight = {
  id: number
  top: string
  left: string
  angle: number
  distance: number
  duration: number
}

/** A comet that streaks across the sky from a random place, on a random delay. */
function Comet() {
  const [flight, setFlight] = useState<CometFlight | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedule = useCallback((delayMs: number) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setFlight({
        id: Date.now(),
        top: `${5 + Math.random() * 45}%`,
        left: `${Math.random() * 60}%`,
        // heading gently downward, left-to-right or right-to-left
        angle:
          Math.random() < 0.5
            ? 12 + Math.random() * 35
            : 145 + Math.random() * 25,
        distance: 420 + Math.random() * 480,
        duration: 1.6 + Math.random() * 1.0,
      })
    }, delayMs)
  }, [])

  useEffect(() => {
    schedule(2500 + Math.random() * 4000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [schedule])

  if (!flight) return null
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* outer div sets the heading; inner motion travels along it */}
      <div
        className="absolute"
        style={{
          top: flight.top,
          left: flight.left,
          transform: `rotate(${flight.angle}deg)`,
        }}
      >
        <motion.div
          key={flight.id}
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: flight.distance, opacity: [0, 1, 1, 0] }}
          transition={{ duration: flight.duration, ease: "easeOut" }}
          onAnimationComplete={() => {
            setFlight(null)
            schedule(5000 + Math.random() * 9000)
          }}
        >
          <div className="relative h-[2px] w-40">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-foreground/40 to-foreground" />
            <span className="absolute top-1/2 -right-1 size-2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_12px_3px] shadow-foreground/60" />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Showcase ─────────────────────────────────────────────────────────────── */

/**
 * Giant animated brand mark over a night sky: stars twinkle, a comet passes,
 * radar rings sweep outward and report detections, and the petals rotate
 * slowly around a steady center.
 */
export function BloomShowcase() {
  return (
    <section className="overflow-hidden border-t border-border">
      <div className="relative flex flex-col items-center gap-12 px-6 py-28">
        <Starfield />
        <PulseRings />
        <Comet />
        <Detections />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-56 text-foreground sm:size-72 md:size-96"
            aria-hidden
          >
            <motion.g
              fill="currentColor"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 120, ease: "linear" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <path key={deg} d={PETAL} transform={`rotate(${deg} 12 12)`} />
              ))}
            </motion.g>
            <circle r={1.7} cx={12} cy={12} fill="currentColor" />
          </svg>
        </motion.div>
      </div>
    </section>
  )
}
