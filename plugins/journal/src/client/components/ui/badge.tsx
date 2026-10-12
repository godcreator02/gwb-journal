import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "journal:inline-flex journal:w-fit journal:shrink-0 journal:items-center journal:justify-center journal:gap-1 journal:overflow-hidden journal:rounded-full journal:border journal:border-transparent journal:px-2 journal:py-0.5 journal:text-xs journal:font-medium journal:whitespace-nowrap journal:transition-[color,box-shadow] journal:focus-visible:border-ring journal:focus-visible:ring-[3px] journal:focus-visible:ring-ring/50 journal:aria-invalid:border-destructive journal:aria-invalid:ring-destructive/20 journal:dark:aria-invalid:ring-destructive/40 journal:[&>svg]:pointer-events-none journal:[&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "journal:bg-primary journal:text-primary-foreground journal:[a&]:hover:bg-primary/90",
        secondary:
          "journal:bg-secondary journal:text-secondary-foreground journal:[a&]:hover:bg-secondary/90",
        destructive:
          "journal:bg-destructive journal:text-white journal:focus-visible:ring-destructive/20 journal:dark:bg-destructive/60 journal:dark:focus-visible:ring-destructive/40 journal:[a&]:hover:bg-destructive/90",
        outline:
          "journal:border-border journal:text-foreground journal:[a&]:hover:bg-accent journal:[a&]:hover:text-accent-foreground",
        ghost: "journal:[a&]:hover:bg-accent journal:[a&]:hover:text-accent-foreground",
        link: "journal:text-primary journal:underline-offset-4 journal:[a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
