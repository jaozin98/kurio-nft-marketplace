import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 rounded border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
}

export { Input }
