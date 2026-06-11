import type { Metadata } from "next"
import { Fustat, Geist_Mono } from "next/font/google"
import { RootProvider } from "fumadocs-ui/provider/next"

import "./global.css"

const fustat = Fustat({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    template: "%s | Iris Docs",
    default: "Iris Docs",
  },
  description:
    "Documentation for Iris — the open-source, AI-native end-to-end testing platform.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${fustat.variable} ${fontMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
