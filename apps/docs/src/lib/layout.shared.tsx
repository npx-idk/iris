import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

const GITHUB_URL = "https://github.com/npx-idk/iris"

function IrisLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden
    >
      <g>
        <path d="M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z" />
        <path
          d="M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"
          transform="rotate(60 12 12)"
        />
        <path
          d="M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"
          transform="rotate(120 12 12)"
        />
        <path
          d="M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"
          transform="rotate(180 12 12)"
        />
        <path
          d="M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"
          transform="rotate(240 12 12)"
        />
        <path
          d="M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"
          transform="rotate(300 12 12)"
        />
        <circle cx="12" cy="12" r="1.7" />
      </g>
    </svg>
  )
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <IrisLogo />
          Iris
        </>
      ),
    },
    githubUrl: GITHUB_URL,
  }
}
