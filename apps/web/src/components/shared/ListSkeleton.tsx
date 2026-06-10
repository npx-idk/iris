import { Skeleton } from "@iris/ui/components/skeleton"

/** A column of identical loading skeletons for list/card placeholders. */
export function ListSkeleton({
  count = 3,
  className = "h-14 w-full rounded-xl",
}: {
  count?: number
  className?: string
}) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </>
  )
}
