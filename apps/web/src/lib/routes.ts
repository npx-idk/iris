export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  project: (id: string) => `/projects/${id}`,
  projectTests: (id: string) => `/projects/${id}/tests`,
  projectTestNew: (id: string) => `/projects/${id}/tests/new`,
  projectFlows: (id: string) => `/projects/${id}/flows`,
  projectFlow: (projectId: string, flowId: string) =>
    `/projects/${projectId}/flows/${flowId}`,
  test: (id: string) => `/tests/${id}`,
  variables: "/variables",
  runs: "/runs",
  usage: "/usage",
} as const
