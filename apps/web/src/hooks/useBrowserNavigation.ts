'use client'

import { api } from '@/lib/api'

export function useBrowserNavigation(sessionId: string | null) {
  async function handleActivateTab(targetId: string) {
    if (!sessionId) return
    await api.post(`/author/${sessionId}/tabs/${targetId}/activate`, {}).catch(() => {})
  }

  async function handleCloseTab(targetId: string) {
    if (!sessionId) return
    await api.delete(`/author/${sessionId}/tabs/${targetId}`).catch(() => {})
  }

  async function navigate(url: string) {
    if (!sessionId || !url.trim()) return
    await api.post(`/author/${sessionId}/navigate`, { url: url.trim() }).catch(() => {})
  }

  async function goBack() {
    if (!sessionId) return
    await api.post(`/author/${sessionId}/back`, {}).catch(() => {})
  }

  async function goForward() {
    if (!sessionId) return
    await api.post(`/author/${sessionId}/forward`, {}).catch(() => {})
  }

  async function reload() {
    if (!sessionId) return
    await api.post(`/author/${sessionId}/reload`, {}).catch(() => {})
  }

  return { handleActivateTab, handleCloseTab, navigate, goBack, goForward, reload }
}
