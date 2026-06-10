import type { Metadata } from "next"
import { Fustat, Geist_Mono } from "next/font/google"

import "@iris/ui/globals.css"
import { cn } from "@iris/ui/lib/utils"

const fustat = Fustat({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Iris — AI-native end-to-end testing",
  description:
    "Write test steps in plain English. Iris runs them in a real browser, streams every frame live, and plugs straight into your CI — no selectors, no flaky scripts.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Landing page is dark-only by design
    <html
      lang="en"
      className={cn(
        "dark font-sans antialiased",
        fustat.variable,
        fontMono.variable
      )}
    >
      <body className="bg-background text-foreground">{children}</body>
    </html>
  )
}
