import Link from "next/link"
import { DOCS_URL, GETTING_STARTED_URL, GITHUB_URL } from "@/lib/site"
import { GitHubIcon } from "./GitHubIcon"
import { Logo } from "@iris/ui/components/logo"

const LINK_GROUPS: Array<{
  heading: string
  links: Array<{ label: string; href: string; external?: boolean }>
}> = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Get started", href: GETTING_STARTED_URL, external: true },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: DOCS_URL, external: true },
      {
        label: "Contributing",
        href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`,
        external: true,
      },
      {
        label: "Security",
        href: `${GITHUB_URL}/blob/main/SECURITY.md`,
        external: true,
      },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "Issues", href: `${GITHUB_URL}/issues`, external: true },
      {
        label: "MIT License",
        href: `${GITHUB_URL}/blob/main/LICENSE`,
        external: true,
      },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-8 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <Link href="/">
            <Logo />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The open-source, AI-native end-to-end testing platform. Write tests
            in plain English, run them anywhere.
          </p>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="mt-5 inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <GitHubIcon />
          </Link>
        </div>

        {/* Link columns */}
        {LINK_GROUPS.map((group) => (
          <div key={group.heading}>
            <h3 className="text-sm font-semibold text-foreground">
              {group.heading}
            </h3>
            <ul className="mt-4 space-y-3">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-8 py-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Iris. Open source under the MIT
            license.
          </p>
          <p className="text-xs text-muted-foreground">
            Built for teams who'd rather ship than babysit selectors.
          </p>
        </div>
      </div>
    </footer>
  )
}
