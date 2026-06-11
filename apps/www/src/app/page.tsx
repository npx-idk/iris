import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { BloomShowcase } from "@/components/landing/BloomShowcase"
import { Footer } from "@/components/landing/Footer"

export default function LandingPage() {
  return (
    <>
      <Navbar />
      {/* Page content lives in a bounded 1280px column, like the reference */}
      <main className="mx-auto max-w-7xl border-x border-border">
        <Hero />
        <Features />
        <BloomShowcase />
      </main>
      <Footer />
    </>
  )
}
