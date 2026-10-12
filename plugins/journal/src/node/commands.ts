// 日志插件的六条命令：五条读（月历、每天统计、全库待办、标签总览、一个标签的行）与快速记录。
// 由 index.ts 直接登记到命令总线；参数不对回 invalid，别的错误原样抛给命令总线
import type { GwbCommandDef, GwbResult } from '@godcreator/gwb-commands'
import { parseDayLines, statOfDay, taggedOf, tagsOf, todosOf, toggleTaskLine } from '../shared/days.js'
import { addDays, daysBetween, todayOf } from '../shared/date.js'
import { streaksOf } from '../shared/streaks.js'
import { CALENDAR_COMMAND, CAPTURE_COMMAND, DAY_COMMAND, DAYS_COMMAND, TAGGED_COMMAND, TAGS_COMMAND, TODOS_COMMAND, TOGGLE_COMMAND, type CalendarResult, type CaptureResult, type DayResult, type DaysResult, type TaggedResult, type TagsResult, type TodosResult } from '../shared/types.js'
import { ArgumentError, argumentFields, optionalBoolean, optionalDate, pageOf, pagingOf, PAGING_KEYS, PAGING_USAGE, requireCaptureKind, requireDate, requireTag, requireText } from './command-args.js'
import type { HolidayBook } from './holidays.js'
import type { JournalStore } from './store.js'

/** 「今天」从哪来：生产是真钟，测试给固定钟 */
export interface JournalClock {
  now(): Date
}

export interface CommandDeps {
  store: JournalStore
  holidays: HolidayBook
  clock: JournalClock
}

export interface JournalCommand {
  definition: GwbCommandDef
  run(raw: unknown): Promise<GwbResult>
}

/** 一次看日历最多多少天：法定假日按年下载，窗口太大就是一次下载很多年 */
export const MAX_CALENDAR_WINDOW = 400

/** 命令的返回结果：参数不对回 ok:false（错误消息里写清哪里不对），别的错误原样抛给命令总线 */
async function envelopeOf(run: () => Promise<unknown>): Promise<GwbResult> {
  try {
    return { ok: true, data: await run() }
  } catch (error) {
    if (error instanceof ArgumentError) return { ok: false, error: `参数不对：${error.message}` }
    throw error
  }
}

function calendarCommand(deps: CommandDeps): JournalCommand {
  const keys = ['from', 'to']
  return {
    definition: {
      name: CALENDAR_COMMAND,
      description: '看一段日子的月历：每天有没有文件、写了多少、是不是法定假日',
      effect: 'read',
      usage:
        `{ from: string, to: string }（YYYY-MM-DD，含两端，最多 ${String(MAX_CALENDAR_WINDOW)} 天）：认一天只看文件名。` +
        '回 { today, days, holidays }：days 是窗口里每一天（按日期升序，一天不缺）{ date, file, holiday, stat }——file 是那天的文件在不在；' +
        'holiday 是 { off, name }（off 为 true 放假、false 调休上班），不是假日为 null；stat 是 { date, entries, tasks, done }（记事几行、任务几条、勾掉几条），没文件是 null。' +
        '法定假日按年联网下载（holiday-cn）、缓存在插件的数据里，holidays 写每年的下载状态 [{ year, state, fetchedAt, error }]，state 是 published / unpublished（还没公布）/ stale（没下载到，用缓存）/ failed（没下载到也没缓存）',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<CalendarResult> => {
        const fields = argumentFields(raw, keys)
        const from = requireDate(fields, 'from')
        const to = requireDate(fields, 'to')
        const span = daysBetween(from, to)!
        if (span < 0) throw new ArgumentError(`from（${from}）不能晚于 to（${to}）`)
        if (span >= MAX_CALENDAR_WINDOW) throw new ArgumentError(`窗口最多 ${String(MAX_CALENDAR_WINDOW)} 天（拿到 ${String(span + 1)} 天）`)
        const files = await deps.store.days()
        const years = new Set<number>()
        for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) years.add(year)
        const holidayYears = await deps.holidays.holidaysFor([...years])
        const marks = new Map(holidayYears.flatMap((year) => year.days.map((day) => [day.date, day] as const)))
        const days = []
        for (let cursor = from; ; cursor = addDaysOrThrow(cursor, 1)) {
          const content = files.get(cursor)
          const holiday = marks.get(cursor) ?? null
          days.push({ date: cursor, file: content !== undefined, holiday, stat: content === undefined ? null : statOfDay(cursor, parseDayLines(content)) })
          if (cursor === to) break
        }
        return { today: todayOf(deps.clock), days, holidays: holidayYears.map(({ year, state, fetchedAt, error }) => ({ year, state, fetchedAt, error })) }
      }),
  }
}

/** `addDays` 在这里的输入都校验过形状，null 只可能是代码错了，走到那就是 bug，直接抛 */
function addDaysOrThrow(iso: string, days: number): string {
  const next = addDays(iso, days)
  if (next === null) throw new Error(`算不动日期：${iso} + ${String(days)}`)
  return next
}

function daysCommand(deps: CommandDeps): JournalCommand {
  const keys = ['from', 'to', ...PAGING_KEYS]
  return {
    definition: {
      name: DAYS_COMMAND,
      description: '看一段日子里每天写了多少，外加连续天数',
      effect: 'read',
      usage:
        `{ from?: string, to?: string（YYYY-MM-DD，不给就是到今天为止的一年）, ${PAGING_USAGE} }。` +
        '回 { today, days, streaks, total, nextOffset }：days 是窗口里有内容的日子，按日期升序（分页的是它），每行 { date, entries, tasks, done }；' +
        'streaks 是 { current, longest } 连续天数：current 从今天往回数，今天还没写就从昨天起算；今天以后的日子不算（那些文件里是排上去的待办，不是写过）',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<DaysResult> => {
        const fields = argumentFields(raw, keys)
        const from = optionalDate(fields, 'from')
        const to = optionalDate(fields, 'to')
        const paging = pagingOf(fields)
        const today = todayOf(deps.clock)
        const window = { from: from ?? addDaysOrThrow(today, -364), to: to ?? today }
        if (daysBetween(window.from, window.to)! < 0) throw new ArgumentError(`from（${window.from}）不能晚于 to（${window.to}）`)
        const files = await deps.store.days()
        const all = [...files.entries()].map(([date, content]) => ({ date, lines: parseDayLines(content) }))
        const stats = all.filter((day) => day.date >= window.from && day.date <= window.to).map((day) => statOfDay(day.date, day.lines)).sort((left, right) => left.date.localeCompare(right.date))
        const page = pageOf(stats, paging)
        return { today, days: page.items, streaks: streaksOf(all.map((day) => day.date), today), total: page.total, nextOffset: page.nextOffset }
      }),
  }
}

function todosCommand(deps: CommandDeps): JournalCommand {
  const keys = ['includeDone', ...PAGING_KEYS]
  return {
    definition: {
      name: TODOS_COMMAND,
      description: '列全部文件里的任务项，按日期倒序，默认只列没勾的',
      effect: 'read',
      usage:
        `{ includeDone?: boolean（连勾上的一起列）, ${PAGING_USAGE} }。任务项是任意缩进的 \`- [ ] …\` / \`- [x] …\` 行。` +
        '回 { rows, total, nextOffset }，rows 每项 { date, text, done }：text 已去掉行尾标签',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<TodosResult> => {
        const fields = argumentFields(raw, keys)
        const includeDone = optionalBoolean(fields, 'includeDone') ?? false
        const paging = pagingOf(fields)
        const files = await deps.store.days()
        const all = [...files.entries()].map(([date, content]) => ({ date, lines: parseDayLines(content) }))
        const page = pageOf(todosOf(all, includeDone), paging)
        return { rows: page.items, total: page.total, nextOffset: page.nextOffset }
      }),
  }
}

function tagsCommand(deps: CommandDeps): JournalCommand {
  return {
    definition: {
      name: TAGS_COMMAND,
      description: '全部行尾标签：按路径段组树，各挂在几行、最近出现在哪天',
      effect: 'read',
      usage:
        '无参数。标签是一行末尾的 `#名字`（每个前面是空白或行首），名字里写 `/` 表示层级：`#仿真/MMC` 是「仿真」的下级，打它也算打了「仿真」。' +
        '回 { tags }：树按含下级的行数降序，每个节点 { tag（最后一段）, path（完整路径）, lines（直接打这个路径的行数）, withChildren（连下级）, lastDate（含下级最近出现）, children }',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<TagsResult> => {
        argumentFields(raw, [])
        const files = await deps.store.days()
        const all = [...files.entries()].map(([date, content]) => ({ date, lines: parseDayLines(content) }))
        return { tags: tagsOf(all) }
      }),
  }
}

function taggedCommand(deps: CommandDeps): JournalCommand {
  const keys = ['tag', 'exact', ...PAGING_KEYS]
  return {
    definition: {
      name: TAGGED_COMMAND,
      description: '列打了某个行尾标签的全部行（默认连下级一起），按日期倒序——回看用',
      effect: 'read',
      usage:
        `{ tag: string（# 后面那段，可含 / 表层级）, exact?: boolean（true 只回精确这个路径的行；缺省连下级一起：查「仿真」也回「仿真/MMC」的行）, ${PAGING_USAGE} }。` +
        '回 { rows, total, nextOffset }，rows 每项 { date, text, task, tags }：text 已去掉行尾标签，task 是 "open" / "done"，不是任务项为 null，tags 是这一行实际打的标签',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<TaggedResult> => {
        const fields = argumentFields(raw, keys)
        const tag = requireTag(fields)
        const exact = optionalBoolean(fields, 'exact') ?? false
        const paging = pagingOf(fields)
        const files = await deps.store.days()
        const all = [...files.entries()].map(([date, content]) => ({ date, lines: parseDayLines(content) }))
        const page = pageOf(taggedOf(all, tag, exact), paging)
        return { rows: page.items, total: page.total, nextOffset: page.nextOffset }
      }),
  }
}

function captureCommand(deps: CommandDeps): JournalCommand {
  const keys = ['date', 'kind', 'text']
  return {
    definition: {
      name: CAPTURE_COMMAND,
      description: '往一天末尾记一笔：待办或一句话，文件没有就建',
      effect: 'write',
      usage:
        '{ date: string（YYYY-MM-DD，未来也行）, kind: "todo" | "note", text: string }。todo 追加一行 `- [ ] <text>`，note 追加一行原文；行尾想挂标签写在 text 里（`… #仿真`）。' +
        '回 { date, file, created }：追加进了哪天的文件、是不是这次新建的。批量整理正文直接编辑文件，不走这条',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<CaptureResult> => {
        const fields = argumentFields(raw, keys)
        const date = requireDate(fields, 'date')
        const kind = requireCaptureKind(fields)
        const text = requireText(fields, 'text')
        const line = kind === 'todo' ? `- [ ] ${text}` : text
        const created = await deps.store.append(date, line)
        return { date, file: `${date}.mdx`, created }
      }),
  }
}

function dayCommand(deps: CommandDeps): JournalCommand {
  return {
    definition: {
      name: DAY_COMMAND,
      description: '读一天：文件在不在、解析出的行（文本、任务态、行尾标签）',
      effect: 'read',
      usage:
        '{ date: string（YYYY-MM-DD） }。回 { date, file, lines }：file 是那天的文件在不在（不在时 lines 是空表）；' +
        'lines 每项 { text, task, tags }——text 去掉了行尾标签，task 是 "open" / "done"，不是任务项为 null',
    },
    run: (raw) =>
      envelopeOf(async (): Promise<DayResult> => {
        const fields = argumentFields(raw, ['date'])
        const date = requireDate(fields, 'date')
        const content = await deps.store.day(date)
        return { date, file: content !== null, lines: content === null ? [] : parseDayLines(content) }
      }),
  }
}

function toggleCommand(deps: CommandDeps): JournalCommand {
  const keys = ['date', 'text', 'done']
  return {
    definition: {
      name: TOGGLE_COMMAND,
      description: '把一天里的一条待办勾上或取消勾上，改的是那天的文件',
      effect: 'write',
      usage:
        '{ date: string, text: string（todos 回执里的那条 text）, done: boolean（勾上还是取消） }。' +
        '按去掉行尾标签后的文本完全匹配，同文本多条只动第一条（要改哪条就把那条写具体些）；保留缩进与行尾标签。' +
        '回 { changed }：已是目标状态或没找到这条时是 false。批量整理直接编辑文件',
    },
    run: (raw) =>
      envelopeOf(async () => {
        const fields = argumentFields(raw, keys)
        const date = requireDate(fields, 'date')
        const text = requireText(fields, 'text')
        const done = optionalBoolean(fields, 'done')
        if (done === undefined) throw new ArgumentError('done 要是布尔值：勾上是 true、取消是 false')
        const content = await deps.store.day(date)
        if (content === null) throw new ArgumentError(`${date} 还没有文件，没有可勾的待办`)
        const next = toggleTaskLine(content, text, done)
        if (next.changed) await deps.store.writeDay(date, next.content)
        return { changed: next.changed }
      }),
  }
}

export function journalCommands(deps: CommandDeps): JournalCommand[] {
  return [calendarCommand(deps), daysCommand(deps), todosCommand(deps), tagsCommand(deps), taggedCommand(deps), captureCommand(deps), dayCommand(deps), toggleCommand(deps)]
}
