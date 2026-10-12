import * as React from "react"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "journal:peer journal:size-4 journal:shrink-0 journal:rounded-[4px] journal:border journal:border-input journal:shadow-xs journal:transition-shadow journal:outline-none journal:focus-visible:border-ring journal:focus-visible:ring-[3px] journal:focus-visible:ring-ring/50 journal:disabled:cursor-not-allowed journal:disabled:opacity-50 journal:aria-invalid:border-destructive journal:aria-invalid:ring-destructive/20 journal:data-[state=checked]:border-primary journal:data-[state=checked]:bg-primary journal:data-[state=checked]:text-primary-foreground journal:dark:bg-input/30 journal:dark:aria-invalid:ring-destructive/40 journal:dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="journal:grid journal:place-content-center journal:text-current journal:transition-none"
      >
        <CheckIcon className="journal:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
