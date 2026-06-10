"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"

import { LiquidMetal } from "@paper-design/shaders-react"

const PETAL = "M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"

/** Degrees of 3D tilt at full cursor distance, and that distance in px. */
const MAX_TILT = 16
const FULL_TILT_RADIUS = 500
/** Subtle pupil glance, in SVG units — stays well inside the open center. */
const MAX_GLANCE = 0.55

/** Soft twinkling dots scattered around the mark. */
const SPARKS: Array<{
  top: string
  left: string
  size: number
  duration: number
  delay: number
}> = [
  { top: "18%", left: "20%", size: 4, duration: 4.5, delay: 0 },
  { top: "30%", left: "76%", size: 3, duration: 3.8, delay: 1.2 },
  { top: "62%", left: "12%", size: 3, duration: 5.2, delay: 0.6 },
  { top: "76%", left: "34%", size: 4, duration: 4.1, delay: 2.0 },
  { top: "68%", left: "84%", size: 5, duration: 4.8, delay: 0.3 },
  { top: "14%", left: "56%", size: 3, duration: 3.5, delay: 1.7 },
  { top: "46%", left: "90%", size: 3, duration: 5.6, delay: 2.4 },
  { top: "84%", left: "64%", size: 4, duration: 4.3, delay: 1.0 },
]

/** Radar-style rings pulsing outward from behind the bloom. */
function PulseRings() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {[0, 2.5, 5].map((delay) => (
        <motion.div
          key={delay}
          className="absolute size-80 rounded-full border border-foreground/20 md:size-96"
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: [0.55, 2.2], opacity: [0, 0.5, 0] }}
          transition={{
            duration: 7.5,
            times: [0, 0.25, 1],
            repeat: Infinity,
            delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

/** Faint dots that twinkle on their own rhythms. */
function Sparks() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {SPARKS.map((spark) => (
        <motion.span
          key={`${spark.top}-${spark.left}`}
          className="absolute rounded-full bg-foreground"
          style={{
            top: spark.top,
            left: spark.left,
            width: spark.size,
            height: spark.size,
          }}
          animate={{ opacity: [0.08, 0.45, 0.08], scale: [1, 1.4, 1] }}
          transition={{
            duration: spark.duration,
            delay: spark.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

/**
 * Giant animated brand mark: radar rings pulse out from the bloom while it
 * tilts in 3D toward the visitor's cursor and the pupil glances along.
 */
export function BloomShowcase() {
  const markRef = useRef<HTMLDivElement>(null)
  const nx = useMotionValue(0) // normalized -1..1
  const ny = useMotionValue(0)
  const sx = useSpring(nx, { stiffness: 100, damping: 18 })
  const sy = useSpring(ny, { stiffness: 100, damping: 18 })

  const rotateY = useTransform(sx, (v) => v * MAX_TILT)
  const rotateX = useTransform(sy, (v) => -v * MAX_TILT)
  const cx = useTransform(sx, (v) => 12 + v * MAX_GLANCE)
  const cy = useTransform(sy, (v) => 12 + v * MAX_GLANCE)

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const el = markRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const mx = e.clientX - (r.left + r.width / 2)
      const my = e.clientY - (r.top + r.height / 2)
      nx.set(Math.max(-1, Math.min(1, mx / FULL_TILT_RADIUS)))
      ny.set(Math.max(-1, Math.min(1, my / FULL_TILT_RADIUS)))
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [nx, ny])

  return (
    <section className="overflow-hidden border-t border-border">
      <div className="relative flex flex-col items-center gap-12 px-6 py-28 [perspective:900px]">
        <PulseRings />
        <Sparks />
        <LiquidMetal
          width={1280}
          height={720}
          image=""
          colorBack="#aaaaac"
          colorTint="#ffffff"
          shape="diamond"
          repetition={2}
          softness={0.1}
          shiftRed={0.3}
          shiftBlue={0.3}
          distortion={0.07}
          contour={0.4}
          angle={70}
          speed={1}
          scale={0.6}
          fit="contain"
        />

        <motion.div
          ref={markRef}
          className="relative"
          style={{ rotateX, rotateY }}
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-72 text-foreground md:size-96"
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
            {/* The pupil glances toward the cursor */}
            <motion.circle r={1.7} cx={cx} cy={cy} fill="currentColor" />
          </svg>
        </motion.div>

        {/*<p className="relative text-sm text-muted-foreground">
          Always watching your tests — so you don&apos;t have to.
        </p>*/}
      </div>
    </section>
  )
}
