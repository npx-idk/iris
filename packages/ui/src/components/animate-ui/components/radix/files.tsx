import * as React from "react"
import {
  Folder01Icon,
  FolderOpenIcon,
  File01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import {
  Files as FilesPrimitive,
  FilesHighlight as FilesHighlightPrimitive,
  FolderItem as FolderItemPrimitive,
  FolderHeader as FolderHeaderPrimitive,
  FolderTrigger as FolderTriggerPrimitive,
  FolderHighlight as FolderHighlightPrimitive,
  Folder as FolderPrimitive,
  FolderIcon as FolderIconPrimitive,
  FileLabel as FileLabelPrimitive,
  FolderContent as FolderContentPrimitive,
  FileHighlight as FileHighlightPrimitive,
  File as FilePrimitive,
  FileIcon as FileIconPrimitive,
  type FilesProps as FilesPrimitiveProps,
  type FolderItemProps as FolderItemPrimitiveProps,
  type FolderContentProps as FolderContentPrimitiveProps,
  type FileProps as FilePrimitiveProps,
  type FileLabelProps as FileLabelPrimitiveProps,
} from "@iris/ui/components/animate-ui/primitives/radix/files"
import { cn } from "@iris/ui/lib/utils"

type GitStatus = "untracked" | "modified" | "deleted"

type FilesProps = FilesPrimitiveProps

function Files({ className, children, ...props }: FilesProps) {
  return (
    <FilesPrimitive className={cn("w-full p-2", className)} {...props}>
      <FilesHighlightPrimitive className="pointer-events-none rounded-lg bg-accent">
        {children}
      </FilesHighlightPrimitive>
    </FilesPrimitive>
  )
}

type SubFilesProps = FilesProps

function SubFiles(props: SubFilesProps) {
  return <FilesPrimitive {...props} />
}

type FolderItemProps = FolderItemPrimitiveProps

function FolderItem(props: FolderItemProps) {
  return <FolderItemPrimitive {...props} />
}

type FolderTriggerProps = FileLabelPrimitiveProps & {
  gitStatus?: GitStatus
}

function FolderTrigger({
  children,
  className,
  gitStatus,
  ...props
}: FolderTriggerProps) {
  return (
    <FolderHeaderPrimitive>
      <FolderTriggerPrimitive className="w-full text-start">
        <FolderHighlightPrimitive>
          <FolderPrimitive className="pointer-events-none flex items-center justify-between gap-2 p-2">
            <div
              className={cn(
                "flex items-center gap-2",
                gitStatus === "untracked" && "text-green-400",
                gitStatus === "modified" && "text-amber-400",
                gitStatus === "deleted" && "text-red-400"
              )}
            >
              <FolderIconPrimitive
                closeIcon={
                  <HugeiconsIcon icon={Folder01Icon} className="size-4" />
                }
                openIcon={
                  <HugeiconsIcon icon={FolderOpenIcon} className="size-4" />
                }
              />
              <FileLabelPrimitive
                className={cn("text-sm", className)}
                {...props}
              >
                {children}
              </FileLabelPrimitive>
            </div>

            {gitStatus && (
              <span
                className={cn(
                  "size-2 rounded-full",
                  gitStatus === "untracked" && "bg-green-400",
                  gitStatus === "modified" && "bg-amber-400",
                  gitStatus === "deleted" && "bg-red-400"
                )}
              />
            )}
          </FolderPrimitive>
        </FolderHighlightPrimitive>
      </FolderTriggerPrimitive>
    </FolderHeaderPrimitive>
  )
}

type FolderContentProps = FolderContentPrimitiveProps

function FolderContent(props: FolderContentProps) {
  return (
    <div className="relative ml-6 before:absolute before:inset-y-0 before:-left-2 before:h-full before:w-px before:bg-border">
      <FolderContentPrimitive {...props} />
    </div>
  )
}

type FileItemProps = FilePrimitiveProps & {
  icon?: IconSvgElement
  gitStatus?: GitStatus
}

function FileItem({
  icon: Icon = File01Icon,
  className,
  children,
  gitStatus,
  ...props
}: FileItemProps) {
  return (
    <FileHighlightPrimitive>
      <FilePrimitive
        className={cn(
          "pointer-events-none flex items-center justify-between gap-2 p-2",
          gitStatus === "untracked" && "text-green-400",
          gitStatus === "modified" && "text-amber-400",
          gitStatus === "deleted" && "text-red-400"
        )}
      >
        <div className="flex items-center gap-2">
          <FileIconPrimitive>
            <HugeiconsIcon icon={Icon} className="size-4" />
          </FileIconPrimitive>
          <FileLabelPrimitive className={cn("text-sm", className)} {...props}>
            {children}
          </FileLabelPrimitive>
        </div>

        {gitStatus && (
          <span className="text-sm font-medium">
            {gitStatus === "untracked" && "U"}
            {gitStatus === "modified" && "M"}
            {gitStatus === "deleted" && "D"}
          </span>
        )}
      </FilePrimitive>
    </FileHighlightPrimitive>
  )
}

export {
  Files,
  FolderItem,
  FolderTrigger,
  FolderContent,
  FileItem,
  SubFiles,
  type FilesProps,
  type FolderItemProps,
  type FolderTriggerProps,
  type FolderContentProps,
  type FileItemProps,
  type SubFilesProps,
}
