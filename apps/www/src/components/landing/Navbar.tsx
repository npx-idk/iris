import Link from "next/link"
import { Button } from "@iris/ui/components/button"
import { DOCS_URL, GITHUB_URL } from "@/lib/site"
import { GitHubIcon } from "./GitHubIcon"
import { Logo } from "@iris/ui/components/logo"

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Docs", href: DOCS_URL },
]

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        {/* Brand */}
        <Link href="/">
          <Logo />
        </Link>

        {/* Links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GitHubIcon className="size-3.5" />
              Star on GitHub
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
