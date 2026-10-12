import * as React from "react"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "journal:flex journal:w-fit journal:items-center journal:justify-between journal:gap-2 journal:rounded-md journal:border journal:border-input journal:bg-transparent journal:px-3 journal:py-2 journal:text-sm journal:whitespace-nowrap journal:shadow-xs journal:transition-[color,box-shadow] journal:outline-none journal:focus-visible:border-ring journal:focus-visible:ring-[3px] journal:focus-visible:ring-ring/50 journal:disabled:cursor-not-allowed journal:disabled:opacity-50 journal:aria-invalid:border-destructive journal:aria-invalid:ring-destructive/20 journal:data-[placeholder]:text-muted-foreground journal:data-[size=default]:h-9 journal:data-[size=sm]:h-8 journal:*:data-[slot=select-value]:line-clamp-1 journal:*:data-[slot=select-value]:flex journal:*:data-[slot=select-value]:items-center journal:*:data-[slot=select-value]:gap-2 journal:dark:bg-input/30 journal:dark:hover:bg-input/50 journal:dark:aria-invalid:ring-destructive/40 journal:[&_svg]:pointer-events-none journal:[&_svg]:shrink-0 journal:[&_svg:not([class*=size-])]:size-4 journal:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="journal:size-4 journal:opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "journal:relative journal:z-50 journal:max-h-(--radix-select-content-available-height) journal:min-w-[8rem] journal:origin-(--radix-select-content-transform-origin) journal:overflow-x-hidden journal:overflow-y-auto journal:rounded-md journal:border journal:bg-popover journal:text-popover-foreground journal:shadow-md journal:data-[side=bottom]:slide-in-from-top-2 journal:data-[side=left]:slide-in-from-right-2 journal:data-[side=right]:slide-in-from-left-2 journal:data-[side=top]:slide-in-from-bottom-2 journal:data-[state=closed]:animate-out journal:data-[state=closed]:fade-out-0 journal:data-[state=closed]:zoom-out-95 journal:data-[state=open]:animate-in journal:data-[state=open]:fade-in-0 journal:data-[state=open]:zoom-in-95",
          position === "popper" &&
            "journal:data-[side=bottom]:translate-y-1 journal:data-[side=left]:-translate-x-1 journal:data-[side=right]:translate-x-1 journal:data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "journal:p-1",
            position === "popper" &&
              "journal:h-[var(--radix-select-trigger-height)] journal:w-full journal:min-w-[var(--radix-select-trigger-width)] journal:scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("journal:px-2 journal:py-1.5 journal:text-xs journal:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "journal:relative journal:flex journal:w-full journal:cursor-default journal:items-center journal:gap-2 journal:rounded-sm journal:py-1.5 journal:pr-8 journal:pl-2 journal:text-sm journal:outline-hidden journal:select-none journal:focus:bg-accent journal:focus:text-accent-foreground journal:data-[disabled]:pointer-events-none journal:data-[disabled]:opacity-50 journal:[&_svg]:pointer-events-none journal:[&_svg]:shrink-0 journal:[&_svg:not([class*=size-])]:size-4 journal:[&_svg:not([class*=text-])]:text-muted-foreground journal:*:[span]:last:flex journal:*:[span]:last:items-center journal:*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="journal:absolute journal:right-2 journal:flex journal:size-3.5 journal:items-center journal:justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="journal:size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("journal:pointer-events-none journal:-mx-1 journal:my-1 journal:h-px journal:bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "journal:flex journal:cursor-default journal:items-center journal:justify-center journal:py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="journal:size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "journal:flex journal:cursor-default journal:items-center journal:justify-center journal:py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="journal:size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
