// 快速记录：记成待办还是随手记的一句。命令的参数校验与窗格的下拉共用这一份
export type CaptureKind = 'todo' | 'note'

/** 快速记录下拉里的选项，按这个顺序排 */
export const CAPTURE_KINDS: readonly { kind: CaptureKind; label: string }[] = [
  { kind: 'todo', label: '待办' },
  { kind: 'note', label: '记录' },
]
