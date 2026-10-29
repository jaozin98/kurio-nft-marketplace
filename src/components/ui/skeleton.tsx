import * as React from "react"
import { cn } from "@/lib/utils"

type SkeletonProps = React.ComponentProps<"div"> & { as?: "div" | "span" | "li" }

// bloco de carregamento com shimmer (a animação para com prefers-reduced-motion, ver index.css)
function Skeleton({ as: Tag = "div", className, ...props }: SkeletonProps) {
  return (
    <Tag
      data-slot="skeleton"
      className={cn("shimmer rounded-md", className)}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  )
}

export { Skeleton }
