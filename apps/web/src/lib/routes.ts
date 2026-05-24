export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
  projectNew: '/projects/new',
  project: (id: string) => `/projects/${id}`,
  projectTests: (id: string) => `/projects/${id}/tests`,
  projectTestNew: (id: string) => `/projects/${id}/tests/new`,
  test: (id: string) => `/tests/${id}`,
} as const;
