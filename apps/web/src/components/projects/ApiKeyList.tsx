"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { ROUTES } from "@/lib/routes"
import { API_KEY_ROLE_BADGE_VARIANT } from "@/lib/roles"
import type { ApiKey } from "@/lib/types"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Badge } from "@iris/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@iris/ui/components/card"
import { ApiKeyCreateDialog } from "./ApiKeyCreateDialog"

interface Props {
  apiKeys: ApiKey[]
  projectId: string
  onUpdate: () => void
}

export function ApiKeyList({ apiKeys, projectId, onUpdate }: Props) {
  const [newKey, setNewKey] = useState<string | null>(null)
  const { copied, copy } = useCopyToClipboard()

  async function handleRevoke(keyId: string) {
    await api.delete(`${ROUTES.project(projectId)}/api-keys/${keyId}`)
    onUpdate()
  }

  function handleCopy() {
    if (newKey) copy(newKey)
  }

  return (
    <div className="space-y-4">
      {newKey && (
        <Card className="ring-2 ring-ring/50">
          <CardContent className="space-y-3">
            <p className="text-xs font-medium text-foreground">
              API key created — copy it now
            </p>
            <p className="text-xs text-muted-foreground">
              This key will never be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
                {newKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
              I&apos;ve saved it, dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardAction>
            <ApiKeyCreateDialog
              projectId={projectId}
              onCreated={(raw) => {
                setNewKey(raw)
                onUpdate()
              }}
            />
          </CardAction>
        </CardHeader>
        {apiKeys.length === 0 ? (
          <CardContent>
            <p className="py-6 text-center text-xs text-muted-foreground">
              No API keys yet
            </p>
          </CardContent>
        ) : (
          apiKeys.map((key, i) => (
            <div
              key={key.id}
              className={`flex items-center justify-between px-4 py-3${i > 0 ? "border-t border-border" : ""}`}
            >
              <div>
                <p className="text-xs font-medium text-foreground">
                  {key.name}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <code className="font-mono text-xs text-muted-foreground">
                    {key.keyPrefix}••••••••
                  </code>
                  <Badge variant={API_KEY_ROLE_BADGE_VARIANT[key.role]}>
                    {key.role}
                  </Badge>
                  {key.lastUsedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <ConfirmDialog
                title="Revoke API key?"
                description={`"${key.name}" will be permanently revoked. Any services using it will lose access.`}
                confirmLabel="Yes, revoke"
                onConfirm={() => handleRevoke(key.id)}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Revoke
                  </Button>
                }
              />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
