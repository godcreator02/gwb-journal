/**
 * 当天窗格：渲染一天的 mdx 文件。第一版按行渲染（任务勾选、记事文本、行尾标签徽章、mdx 组件行原样显示源码），
 * 完整的 markdown / mdx 渲染等真用到再上——文件不用改，只升级渲染器（设计页的「格式全功能、渲染渐进」）。
 * 这一天还没有文件时显示一页空白与一行输入：写下第一行才建出这一天，「只点不写不留下空的日子」。
 */

import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HostBridge, PaneArgs, PaneHandle, ShellBridge } from '@godcreator/gwb-shell/pane'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CAPTURE_KINDS, type CaptureKind } from '../shared/capture.js'
import { formatDay, isIsoDate, isoOf } from '../shared/date.js'
import { CAPTURE_COMMAND, DAY_COMMAND, TOGGLE_COMMAND, type DayLine, type DayResult } from '../shared/types.js'
import { callData, errorText } from './calls.js'

export function mountDayPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const root = createRoot(container)
  const dateOf = (params: Record<string, unknown> | undefined): string => {
    const given = params?.['date']
    if (typeof given === 'string' && isIsoDate(given)) return given
    if (given === undefined) return isoOf(new Date())
    throw new Error(`窗格参数 date 要是一天（YYYY-MM-DD），拿到的是：${String(given)}`)
  }
  const draw = (date: string): void => root.render(<DayPane key={date} host={args.host} shell={args.shell} date={date} />)
  draw(dateOf(args.pane.params))
  return {
    dispose() {
      root.unmount()
      container.replaceChildren()
    },
    retarget(params) {
      draw(dateOf(params))
    },
  }
}

function DayPane({ host, shell, date }: { host: HostBridge; shell: ShellBridge; date: string }): ReactNode {
  const [result, setResult] = useState<DayResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<CaptureKind>('todo')
  const [draft, setDraft] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      setResult(await callData<DayResult>(host, DAY_COMMAND, { date }))
      setError(null)
    } catch (caught) {
      setError(errorText(caught))
    }
  }, [host, date])

  useEffect(() => {
    setResult(null)
    void load()
  }, [load])

  const toggle = useCallback(
    async (line: DayLine): Promise<void> => {
      try {
        await callData(host, TOGGLE_COMMAND, { date, text: line.text, done: line.task !== 'done' })
        await load()
      } catch (caught) {
        setError(errorText(caught))
      }
    },
    [host, date, load],
  )

  const capture = useCallback(async (): Promise<void> => {
    const text = draft.trim()
    if (text === '') {
      setInputError('先写点内容')
      return
    }
    try {
      await callData(host, CAPTURE_COMMAND, { date, kind, text })
      setDraft('')
      setInputError(null)
      shell.keepPane()
      await load()
    } catch (caught) {
      setInputError(errorText(caught))
    }
  }, [host, date, draft, kind, shell, load])

  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    void capture()
  }

  const pickKind = (value: string): void => {
    if (value !== 'todo' && value !== 'note') throw new Error(`下拉里没有这一项：${value}`)
    setKind(value)
  }

  const renderLine = (line: DayLine, index: number): ReactNode => {
    const key = `${String(index)}-${line.text}`
    if (line.task !== null) {
      return (
        <div key={key} className="journal:flex journal:items-center journal:gap-2 journal:py-0.5">
          <Checkbox checked={line.task === 'done'} aria-label={line.task === 'done' ? `取消勾选：${line.text}` : `勾上：${line.text}`} onCheckedChange={() => void toggle(line)} />
          <span className={line.task === 'done' ? 'journal:text-muted-foreground journal:line-through' : undefined}>{line.text}</span>
          {line.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {`#${tag}`}
            </Badge>
          ))}
        </div>
      )
    }
    if (line.text.trimStart().startsWith('<')) {
      return (
        <code key={key} className="journal:my-1 journal:block journal:rounded journal:bg-muted journal:px-2 journal:py-1 journal:text-xs journal:text-muted-foreground">
          {line.text}
        </code>
      )
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.text)
    return (
      <p key={key} className={`journal:m-0 journal:py-0.5 ${heading === null ? '' : 'journal:font-semibold'}`}>
        {heading === null ? line.text : (heading[2] ?? '')}
        {line.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="journal:ml-1.5">
            {`#${tag}`}
          </Badge>
        ))}
      </p>
    )
  }

  return (
    <div className="journal:flex journal:h-full journal:flex-col journal:overflow-y-auto journal:px-4 journal:py-3 journal:text-sm">
      <header className="journal:flex-none journal:pb-2">
        <h1 className="journal:m-0 journal:text-base journal:font-semibold">{formatDay(date)}</h1>
      </header>
      {error === null ? null : (
        <p role="alert" className="journal:m-0 journal:flex-none journal:rounded-md journal:border journal:border-destructive journal:bg-destructive/10 journal:px-3 journal:py-2 journal:text-destructive">
          {error}
        </p>
      )}
      {result === null ? (
        <p className="journal:m-0 journal:text-sm journal:text-muted-foreground">读取中…</p>
      ) : result.file ? (
        <div className="journal:flex journal:min-w-0 journal:flex-1 journal:flex-col">
          {result.lines.map((line, index) => renderLine(line, index))}
          <div className="journal:mt-3">
            <ButtonGroup>
              <Select value={kind} onValueChange={pickKind}>
                <SelectTrigger aria-label="记成什么" title="记成待办还是随手记的一句">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTURE_KINDS.map((each) => (
                    <SelectItem key={each.kind} value={each.kind}>
                      {each.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="往这天再记一笔，回车保存" value={draft} onChange={(event) => { setDraft(event.target.value); setInputError(null) }} onKeyDown={onKey} />
            </ButtonGroup>
          </div>
        </div>
      ) : (
        <div className="journal:flex journal:flex-1 journal:flex-col journal:items-center journal:justify-center journal:gap-3">
          <p className="journal:m-0 journal:text-muted-foreground">这一天还没有内容。写下第一行，这一天才建出来。</p>
          <ButtonGroup className="journal:w-full journal:max-w-96">
            <Select value={kind} onValueChange={pickKind}>
              <SelectTrigger aria-label="记成什么" title="记成待办还是随手记的一句">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPTURE_KINDS.map((each) => (
                  <SelectItem key={each.kind} value={each.kind}>
                    {each.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input autoFocus placeholder={`记到 ${shortDay(date)}，回车保存`} value={draft} onChange={(event) => { setDraft(event.target.value); setInputError(null) }} onKeyDown={onKey} />
          </ButtonGroup>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      )}
      {inputError === null ? null : (
        <p className="journal:m-0 journal:flex-none journal:pt-1 journal:text-xs journal:text-muted-foreground">{inputError}</p>
      )}
    </div>
  )
}

function shortDay(date: string): string {
  return formatDay(date).split(' ')[0] ?? date
}
