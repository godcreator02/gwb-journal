/**
 * 状态栏「快速记录」按钮弹出的浮层：选记成待办还是记录，写一句、回车就记进今天，记完输入框清空、可以接着记。
 * 外壳每打开一次浮层挂载一次、关上就 dispose，这里不留跨两次打开的状态。浮层贴着窗口底部，下拉向上弹出
 */

import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HostBridge, StatusItemArgs, StatusItemHandle } from '@godcreator/gwb-shell/pane'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CAPTURE_KINDS, type CaptureKind } from '../shared/capture.js'
import { formatDay, systemClock, todayOf } from '../shared/date.js'
import { CAPTURE_COMMAND } from '../shared/types.js'
import { callData, errorText } from './calls.js'

export function mountStatusCapture(args: StatusItemArgs, container: HTMLElement): StatusItemHandle {
  const root = createRoot(container)
  root.render(<QuickCapture host={args.host} />)
  return {
    dispose() {
      root.unmount()
      container.replaceChildren()
    },
  }
}

function QuickCapture({ host }: { host: HostBridge }): ReactNode {
  const [kind, setKind] = useState<CaptureKind>('todo')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const capture = useCallback(async (): Promise<void> => {
    const text = draft.trim()
    if (text === '') {
      setError('先写点内容')
      return
    }
    const today = todayOf(systemClock)
    try {
      await callData(host, CAPTURE_COMMAND, { date: today, kind, text })
      setDraft('')
      setError(null)
      setSaved(`已记到 ${formatDay(today)}：${text}`)
    } catch (caught) {
      setError(errorText(caught))
    }
  }, [host, kind, draft])

  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    void capture()
  }

  const pickKind = (value: string): void => {
    if (value !== 'todo' && value !== 'note') throw new Error(`下拉里没有这一项：${value}`)
    setKind(value)
  }

  return (
    <div className="journal:flex journal:w-96 journal:flex-col journal:gap-2 journal:text-sm">
      <ButtonGroup className="journal:w-full">
        <Select value={kind} onValueChange={pickKind}>
          <SelectTrigger aria-label="记成什么" title="记成待办还是随手记的一句">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="top" align="start">
            {CAPTURE_KINDS.map((each) => (
              <SelectItem key={each.kind} value={each.kind}>
                {each.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input autoFocus placeholder="记到今天，回车保存" value={draft} onChange={(event) => { setDraft(event.target.value); setError(null) }} onKeyDown={onKey} />
      </ButtonGroup>
      {error === null ? null : (
        <p role="alert" className="journal:m-0 journal:rounded-md journal:border journal:border-destructive journal:bg-destructive/10 journal:px-3 journal:py-2 journal:text-destructive">
          {error}
        </p>
      )}
      {saved === null ? null : <p className="journal:m-0 journal:text-xs journal:text-muted-foreground">{saved}</p>}
    </div>
  )
}
