import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "journal:inline-flex journal:shrink-0 journal:items-center journal:justify-center journal:gap-2 journal:rounded-md journal:text-sm journal:font-medium journal:whitespace-nowrap journal:transition-all journal:outline-none journal:focus-visible:border-ring journal:focus-visible:ring-[3px] journal:focus-visible:ring-ring/50 journal:disabled:pointer-events-none journal:disabled:opacity-50 journal:aria-invalid:border-destructive journal:aria-invalid:ring-destructive/20 journal:dark:aria-invalid:ring-destructive/40 journal:[&_svg]:pointer-events-none journal:[&_svg]:shrink-0 journal:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "journal:bg-primary journal:text-primary-foreground journal:hover:bg-primary/90",
        destructive:
          "journal:bg-destructive journal:text-white journal:hover:bg-destructive/90 journal:focus-visible:ring-destructive/20 journal:dark:bg-destructive/60 journal:dark:focus-visible:ring-destructive/40",
        outline:
          "journal:border journal:bg-background journal:shadow-xs journal:hover:bg-accent journal:hover:text-accent-foreground journal:dark:border-input journal:dark:bg-input/30 journal:dark:hover:bg-input/50",
        secondary:
          "journal:bg-secondary journal:text-secondary-foreground journal:hover:bg-secondary/80",
        ghost:
          "journal:hover:bg-accent journal:hover:text-accent-foreground journal:dark:hover:bg-accent/50",
        link: "journal:text-primary journal:underline-offset-4 journal:hover:underline",
      },
      size: {
        default: "journal:h-9 journal:px-4 journal:py-2 journal:has-[>svg]:px-3",
        xs: "journal:h-6 journal:gap-1 journal:rounded-md journal:px-2 journal:text-xs journal:has-[>svg]:px-1.5 journal:[&_svg:not([class*=size-])]:size-3",
        sm: "journal:h-8 journal:gap-1.5 journal:rounded-md journal:px-3 journal:has-[>svg]:px-2.5",
        lg: "journal:h-10 journal:rounded-md journal:px-6 journal:has-[>svg]:px-4",
        icon: "journal:size-9",
        "icon-xs": "journal:size-6 journal:rounded-md journal:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "journal:size-8",
        "icon-lg": "journal:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
