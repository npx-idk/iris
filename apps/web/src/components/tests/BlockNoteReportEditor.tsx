"use client"

import {
  SideMenuController,
  SideMenu,
  DragHandleMenu,
  RemoveBlockItem,
  BlockColorsItem,
  useBlockNoteEditor,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import type { useCreateBlockNote } from "@blocknote/react"
import "@blocknote/shadcn/style.css"
import "@blocknote/core/fonts/inter.css"

import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Input } from "@iris/ui/components/input"
import { Label } from "@iris/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@iris/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@iris/ui/components/select"
import { Card, CardContent } from "@iris/ui/components/card"
import { Skeleton } from "@iris/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@iris/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@iris/ui/components/animate-ui/components/radix/tabs"
import { Toggle } from "@iris/ui/components/animate-ui/components/radix/toggle"

const blockNoteShadcnComponents = {
  Badge: { Badge },
  Button: { Button },
  Card: { Card, CardContent },
  DropdownMenu: {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  },
  Input: { Input },
  Label: { Label },
  Popover: { Popover, PopoverContent, PopoverTrigger },
  Select: { Select, SelectContent, SelectItem, SelectTrigger, SelectValue },
  Skeleton: { Skeleton },
  Tabs: { Tabs, TabsContent, TabsList, TabsTrigger },
  Toggle: { Toggle },
  Tooltip: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger },
}

const CustomDragHandleMenu = (props: any) => {
  const editor = useBlockNoteEditor()

  const handleUpdateBlockType = (type: string, headingLevel?: number) => {
    if (props.block) {
      if (type === "heading" && headingLevel) {
        editor.updateBlock(props.block, {
          type,
          props: { level: headingLevel },
        } as any)
      } else {
        editor.updateBlock(props.block, {
          type,
        } as any)
      }
    }
  }

  return (
    <DragHandleMenu>
      <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
      <BlockColorsItem {...props}>Colors</BlockColorsItem>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground outline-none hover:bg-accent">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1 h-3.5 w-3.5"
          >
            <path d="M16 3h5v5" />
            <path d="M8 21H3v-5" />
            <path d="M12 20v-8" />
            <path d="M12 12V4" />
            <path d="m21 3-7.5 7.5" />
            <path d="M3 21l7.5-7.5" />
          </svg>
          Turn into
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="z-[9999] min-w-[130px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-foreground outline-none hover:bg-accent"
            onClick={() => handleUpdateBlockType("paragraph")}
          >
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-foreground outline-none hover:bg-accent"
            onClick={() => handleUpdateBlockType("heading", 1)}
          >
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-foreground outline-none hover:bg-accent"
            onClick={() => handleUpdateBlockType("heading", 2)}
          >
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-foreground outline-none hover:bg-accent"
            onClick={() => handleUpdateBlockType("heading", 3)}
          >
            Heading 3
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-foreground outline-none hover:bg-accent"
            onClick={() => handleUpdateBlockType("bulletListItem")}
          >
            Bullet List
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-foreground outline-none hover:bg-accent"
            onClick={() => handleUpdateBlockType("numberedListItem")}
          >
            Numbered List
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DragHandleMenu>
  )
}

const CustomSideMenu = (props: any) => (
  <SideMenu {...props} dragHandleMenu={CustomDragHandleMenu} />
)

/** BlockNote editor configured with @iris/ui shadcn components and the custom side menu. */
export function BlockNoteReportEditor({
  editor,
  resolvedTheme,
}: {
  editor: ReturnType<typeof useCreateBlockNote>
  resolvedTheme: string | undefined
}) {
  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      shadCNComponents={blockNoteShadcnComponents as any}
      sideMenu={false}
    >
      <SideMenuController sideMenu={CustomSideMenu} />
    </BlockNoteView>
  )
}
