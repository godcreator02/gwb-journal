import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "journal:h-9 journal:w-full journal:min-w-0 journal:rounded-md journal:border journal:border-input journal:bg-transparent journal:px-3 journal:py-1 journal:text-base journal:shadow-xs journal:transition-[color,box-shadow] journal:outline-none journal:selection:bg-primary journal:selection:text-primary-foreground journal:file:inline-flex journal:file:h-7 journal:file:border-0 journal:file:bg-transparent journal:file:text-sm journal:file:font-medium journal:file:text-foreground journal:placeholder:text-muted-foreground journal:disabled:pointer-events-none journal:disabled:cursor-not-allowed journal:disabled:opacity-50 journal:md:text-sm journal:dark:bg-input/30",
        "journal:focus-visible:border-ring journal:focus-visible:ring-[3px] journal:focus-visible:ring-ring/50",
        "journal:aria-invalid:border-destructive journal:aria-invalid:ring-destructive/20 journal:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
