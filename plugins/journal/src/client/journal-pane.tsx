/**
 * 日志窗格：上面一张紧凑月历（每格只有日期和有没有内容的圆点，周末与放假用颜色区分），
 * 单击一天在「当天」窗格打开那一天；下面是全部待办，快速记录写进选中的那一天。
 * 布局与交互照搬旧 bn-journal 的窗格，数据源从块库换成自己的命令。
 */

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { HostBridge, PaneArgs, PaneHandle, ShellBridge } from '@godcreator/gwb-shell/pane'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CAPTURE_KINDS, type CaptureKind } from '../shared/capture.js'
import { formatDay, formatMonth, isoOf, monthGrid, monthOf, shiftMonth, weekdayOf } from '../shared/date.js'
import { DAY_PANE } from '../shared/types.js'
import { CALENDAR_COMMAND, CAPTURE_COMMAND, TODOS_COMMAND, TOGGLE_COMMAND, type CalendarDay, type CalendarResult, type HolidayYearStatus, type TodoRow } from '../shared/types.js'
import { callData, errorText } from './calls.js'
import { TagsSection } from './tags-section.js'

const WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'] as const
const MONTH_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** 月历那一片格子（含上下月补白的那几天）当窗口 */
function windowOfMonth(month: string): { from: string; to: string } {
  const grid = monthGrid(month)
  return { from: grid[0]?.[0] ?? month, to: grid.at(-1)?.at(-1) ?? month }
}

/** 月历下面那一行说明：只说没下载到或还没公布的年份 */
function holidayNoticesOf(years: readonly HolidayYearStatus[]): string[] {
  const notices: string[] = []
  for (const year of years) {
    if (year.state === 'unpublished') notices.push(`${String(year.year)} 年的放假安排还没公布`)
    if (year.state === 'stale') notices.push(`${String(year.year)} 年的节假日这次没下载到，用的是 ${(year.fetchedAt ?? '').slice(0, 10)} 的缓存：${year.error ?? ''}`)
    if (year.state === 'failed') notices.push(`${String(year.year)} 年的节假日没下载到：${year.error ?? ''}`)
  }
  return notices
}

/** 选中那天在快速记录那一行里怎么写：`10月8日` */
function shortDayOf(date: string): string {
  return formatDay(date).split(' ')[0] ?? date
}

/** 格子里日期按钮的朗读标签：`9月25日 周五 中秋节 休`，今天另说一声 */
function dayButtonLabelOf(date: string, holiday: CalendarDay['holiday'], isToday: boolean): string {
  const parts = [formatDay(date)]
  if (isToday) parts.push('今天')
  if (holiday !== null) parts.push(holiday.name, holiday.off ? '休' : '班')
  return parts.join(' ')
}

export function mountJournalPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const root = createRoot(container)
  root.render(<JournalPane host={args.host} shell={args.shell} />)
  return {
    dispose() {
      root.unmount()
      container.replaceChildren()
    },
  }
}

interface Shown {
  month: string
  days: CalendarDay[]
  holidays: HolidayYearStatus[]
}

function JournalPane({ host, shell }: { host: HostBridge; shell: ShellBridge }): ReactNode {
  const [today] = useState(() => isoOf(new Date()))
  const [shown, setShown] = useState<Shown | null>(null)
  const [todos, setTodos] = useState<TodoRow[] | null>(null)
  const [selected, setSelected] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<CaptureKind>('todo')
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)
  const showDoneId = 'journal-show-done'
  const [tab, setTab] = useState<'todos' | 'tags'>('todos')
  const [inputError, setInputError] = useState<string | null>(null)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(0)

  const loadMonth = useCallback(
    async (month: string): Promise<void> => {
      try {
        const window = windowOfMonth(month)
        const calendar = await callData<CalendarResult>(host, CALENDAR_COMMAND, { from: window.from, to: window.to })
        setShown({ month, days: calendar.days, holidays: calendar.holidays })
        setError(null)
      } catch (caught) {
        setError(errorText(caught))
      }
    },
    [host],
  )

  const loadTodos = useCallback(async (): Promise<void> => {
    try {
      const result = await callData<{ rows: TodoRow[] }>(host, TODOS_COMMAND, { includeDone: true })
      setTodos(result.rows)
    } catch (caught) {
      setError(errorText(caught))
    }
  }, [host])

  useEffect(() => {
    void loadMonth(monthOf(today) ?? today.slice(0, 7))
    void loadTodos()
  }, [loadMonth, loadTodos, today])

  /** 勾掉一条待办后：重读待办与当天那一格（顺手把整月重读，一个月的数据很小） */
  const toggle = useCallback(
    async (date: string, text: string, done: boolean): Promise<void> => {
      try {
        await callData(host, TOGGLE_COMMAND, { date, text, done })
        await Promise.all([loadTodos(), shown === null ? Promise.resolve() : loadMonth(shown.month)])
      } catch (caught) {
        setError(errorText(caught))
      }
    },
    [host, loadTodos, loadMonth, shown],
  )

  const capture = useCallback(async (): Promise<void> => {
    const text = draft.trim()
    if (text === '') {
      setInputError('先写点内容')
      return
    }
    try {
      await callData(host, CAPTURE_COMMAND, { date: selected, kind, text })
      setDraft('')
      setInputError(null)
      await Promise.all([loadTodos(), shown === null ? Promise.resolve() : loadMonth(shown.month)])
    } catch (caught) {
      setInputError(errorText(caught))
    }
  }, [host, draft, kind, selected, loadTodos, loadMonth, shown])

  /** 点一天：选中它、在「当天」窗格打开那一天（同一天只有一份，别的天另开一份） */
  const select = (date: string): void => {
    setSelected(date)
    shell.openPane(DAY_PANE, { key: date, params: { date } })
  }

  const month = shown?.month ?? null

  const goMonth = (by: number): void => {
    if (month !== null) void loadMonth(shiftMonth(month, by) ?? month)
  }

  const goToday = (): void => {
    setSelected(today)
    const at = monthOf(today) ?? today.slice(0, 7)
    if (at !== month) void loadMonth(at)
  }

  const toggleMonthPicker = (open: boolean): void => {
    if (open && month !== null) setPickerYear(Number(month.slice(0, 4)))
    setMonthPickerOpen(open)
  }
  const pickMonth = (index: number): void => {
    setMonthPickerOpen(false)
    const value = `${String(pickerYear).padStart(4, '0')}-${String(index).padStart(2, '0')}`
    void loadMonth(value)
  }

  const pickKind = (value: string): void => {
    if (value !== 'todo' && value !== 'note') throw new Error(`下拉里没有这一项：${value}`)
    setKind(value)
  }

  const byDate = useMemo(() => new Map<string, CalendarDay>((shown?.days ?? []).map((each) => [each.date, each])), [shown])
  const grid = useMemo(() => (month === null ? [] : monthGrid(month)), [month])
  /** 待办按日期倒序（todos 命令已排好），这里只按开关过滤 */
  const visibleTodos = useMemo(() => (todos ?? []).filter((row) => showDone || !row.done), [todos, showDone])
  const remaining = (todos ?? []).filter((row) => !row.done).length
  const notices = holidayNoticesOf(shown?.holidays ?? [])

  const onKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    void capture()
  }

  const cell = (date: string): ReactNode => {
    const info = byDate.get(date)
    const inMonth = month !== null && date.startsWith(month)
    const holiday = info?.holiday ?? null
    const restDay = holiday?.off === true || (weekdayOf(date)! >= 5 && holiday?.off !== false)
    const hasContent = (info?.stat?.entries ?? 0) + (info?.stat?.tasks ?? 0) > 0
    const isToday = date === today
    const tone = isToday ? 'journal:bg-primary journal:text-primary-foreground' : date === selected ? 'journal:bg-secondary' : 'journal:hover:bg-muted'
    return (
      <div key={date} className="journal:flex journal:flex-col journal:items-center">
        <button
          type="button"
          className={`journal:flex journal:size-6 journal:items-center journal:justify-center journal:rounded-md journal:text-xs ${tone}`}
          aria-label={dayButtonLabelOf(date, holiday, isToday)}
          aria-pressed={date === selected}
          title={`${formatDay(date)}：打开当天${hasContent ? '，有内容' : ''}`}
          onClick={(event: MouseEvent) => {
            event.preventDefault()
            select(date)
          }}
        >
          <span className={isToday ? '' : !inMonth ? 'journal:text-muted-foreground' : restDay ? 'journal:text-destructive' : ''}>{String(Number(date.slice(8)))}</span>
        </button>
        <span aria-hidden="true" className={`journal:mt-px journal:size-[3px] journal:rounded-full ${hasContent ? 'journal:bg-primary' : ''}`} />
      </div>
    )
  }

  const todoLine = (row: TodoRow): ReactNode => (
    <div key={`${row.date}-${row.text}`} className="journal:flex journal:min-w-0 journal:items-center journal:gap-2 journal:py-0.5">
      <Button variant="ghost" size="sm" className="journal:w-[112px] journal:flex-none journal:justify-start" aria-label={`打开 ${row.date} 的日志`} onClick={() => select(row.date)}>
        {row.date}
      </Button>
      <Checkbox
        checked={row.done}
        aria-label={row.done ? `取消勾选：${row.text}` : `勾上：${row.text}`}
        onCheckedChange={() => void toggle(row.date, row.text, !row.done)}
      />
      <Button variant="ghost" size="sm" className="journal:min-w-0 journal:flex-1 journal:justify-start" title={row.text} onClick={() => select(row.date)}>
        <span className={row.done ? 'journal:truncate journal:text-muted-foreground journal:line-through' : 'journal:truncate'}>{row.text === '' ? '（空）' : row.text}</span>
      </Button>
    </div>
  )

  return (
    <div className="journal:flex journal:h-full journal:min-w-0 journal:flex-col journal:gap-2 journal:overflow-y-auto journal:px-3 journal:py-3 journal:text-sm">
      <header className="journal:flex journal:flex-none journal:flex-wrap journal:items-center journal:gap-1">
        <Button variant="outline" size="sm" title="回到今天" onClick={goToday}>
          今天
        </Button>
        <div className="journal:flex journal:flex-none journal:items-center">
          <Button variant="ghost" size="icon-sm" aria-label="上一个月" title="上一个月" onClick={() => goMonth(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="下一个月" title="下一个月" onClick={() => goMonth(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <Popover open={monthPickerOpen} onOpenChange={toggleMonthPicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="选择年月" title="选择年月">
              {month === null ? '' : formatMonth(month)}
              <ChevronDownIcon className="journal:text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="journal:w-60 journal:p-2">
            <div className="journal:flex journal:items-center journal:justify-between journal:pb-1">
              <Button variant="ghost" size="icon-sm" aria-label="上一年" title="上一年" onClick={() => setPickerYear((year) => year - 1)}>
                <ChevronLeftIcon />
              </Button>
              <span className="journal:text-sm journal:font-medium">{`${String(pickerYear)}年`}</span>
              <Button variant="ghost" size="icon-sm" aria-label="下一年" title="下一年" onClick={() => setPickerYear((year) => year + 1)}>
                <ChevronRightIcon />
              </Button>
            </div>
            <div className="journal:grid journal:grid-cols-4 journal:gap-1">
              {MONTH_INDEXES.map((index) => {
                const value = `${String(pickerYear).padStart(4, '0')}-${String(index).padStart(2, '0')}`
                return (
                  <Button key={index} variant={value === month ? 'default' : value === monthOf(today) ? 'outline' : 'ghost'} size="sm" onClick={() => pickMonth(index)}>
                    {`${String(index)}月`}
                  </Button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        <ButtonGroup className="journal:ml-2 journal:min-w-[12rem] journal:flex-auto">
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
          <Input
            placeholder={`记到 ${shortDayOf(selected)}${selected === today ? '（今天）' : ''}，回车保存`}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setInputError(null)
            }}
            onKeyDown={onKey}
          />
        </ButtonGroup>
      </header>

      {[error, inputError].map((message) =>
        message === null ? null : (
          <p key={message} role="alert" className="journal:m-0 journal:flex-none journal:rounded-md journal:border journal:border-destructive journal:bg-destructive/10 journal:px-3 journal:py-2 journal:text-destructive">
            {message}
          </p>
        ),
      )}

      <section aria-label="日志月历" className="journal:flex-none journal:rounded-lg journal:border journal:border-border journal:p-1.5">
        <div className="journal:grid journal:grid-cols-7">
          {WEEK_HEADS.map((head) => (
            <span key={head} className="journal:py-0.5 journal:text-center journal:text-[10px] journal:text-muted-foreground">
              {head}
            </span>
          ))}
        </div>
        <div className="journal:grid journal:grid-cols-7">{grid.flat().map((date) => cell(date))}</div>
      </section>
      <section aria-label="待办与标签" className="journal:min-w-0 journal:flex-1">
        <div className="journal:mb-1 journal:flex journal:gap-1 journal:rounded-lg journal:bg-muted journal:p-0.5">
          <button
            type="button"
            aria-pressed={tab === 'todos'}
            title="全部待办"
            onClick={() => setTab('todos')}
            className={`journal:flex journal:flex-1 journal:items-center journal:justify-center journal:gap-1.5 journal:rounded-md journal:py-1 journal:text-xs ${tab === 'todos' ? 'journal:bg-background journal:font-medium journal:shadow-sm' : 'journal:text-muted-foreground journal:hover:text-foreground'}`}
          >
            待办
            <Badge variant="secondary">{String(remaining)}</Badge>
          </button>
          <button
            type="button"
            aria-pressed={tab === 'tags'}
            title="全部标签"
            onClick={() => setTab('tags')}
            className={`journal:flex journal:flex-1 journal:items-center journal:justify-center journal:gap-1.5 journal:rounded-md journal:py-1 journal:text-xs ${tab === 'tags' ? 'journal:bg-background journal:font-medium journal:shadow-sm' : 'journal:text-muted-foreground journal:hover:text-foreground'}`}
          >
            标签
          </button>
        </div>
        {tab === 'todos' ? (
          <>
            <div className="journal:flex journal:items-center journal:gap-2 journal:py-0.5">
              <div className="journal:ml-auto journal:flex journal:items-center journal:gap-2">
                <Checkbox id={showDoneId} aria-label="显示已完成" checked={showDone} onCheckedChange={(value) => setShowDone(value === true)} />
                <label htmlFor={showDoneId} className="journal:text-xs journal:text-muted-foreground">
                  显示已完成
                </label>
              </div>
            </div>
            {visibleTodos.map((row) => todoLine(row))}
            {todos !== null && visibleTodos.length === 0 ? <p className="journal:p-4 journal:text-sm journal:text-muted-foreground">{showDone ? '没有待办' : '没有未完成待办'}</p> : null}
          </>
        ) : (
          <TagsSection host={host} shell={shell} />
        )}
      </section>
      {notices.map((notice) => (
        <p key={notice} className="journal:m-0 journal:flex-none journal:text-xs journal:text-muted-foreground">
          {notice}
        </p>
      ))}
    </div>
  )
}
