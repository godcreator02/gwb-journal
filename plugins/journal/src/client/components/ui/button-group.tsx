import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

/** 把下拉与输入框拼成一行的一组控件（快速记录那一行）；样式跟 shadcn 的按钮组一样：相邻的去掉中间的圆角与边 */
const buttonGroupVariants = cva(
  'journal:flex journal:w-fit journal:items-stretch journal:[&>*]:focus-visible:relative journal:[&>*]:focus-visible:z-10 journal:[&>input]:flex-1',
  {
    variants: {
      orientation: {
        horizontal: 'journal:[&>*:not(:first-child)]:rounded-l-none journal:[&>*:not(:first-child)]:border-l-0 journal:[&>*:not(:last-child)]:rounded-r-none',
        vertical: 'journal:flex-col journal:[&>*:not(:first-child)]:rounded-t-none journal:[&>*:not(:first-child)]:border-t-0 journal:[&>*:not(:last-child)]:rounded-b-none',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  },
)

function ButtonGroup({ className, orientation, ...props }: React.ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
  return <div role="group" data-slot="button-group" data-orientation={orientation} className={cn(buttonGroupVariants({ orientation }), className)} {...props} />
}

export { ButtonGroup, buttonGroupVariants }
