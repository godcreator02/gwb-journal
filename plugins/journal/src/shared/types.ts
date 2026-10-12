// 两端共用的回执形状：聚合命令、快速记录与读一天。字段名对着旧 bn-journal 的回执取，窗格照搬时少改
import type { DayLine, DayStat, TagNode, TaggedRow, TodoRow } from './days.js'

export type { DayLine, TagNode, TaggedRow, TodoRow } from './days.js'

/** 列表命令的分页：`total` 是一共几条，`nextOffset` 是下一页从第几条起，读完是 null */
export interface PageInfo {
  total: number
  nextOffset: number | null
}

/** 法定假日那一格：`off` 为 true 是放假，false 是调休上班 */
export interface HolidayMark {
  off: boolean
  name: string
}

/** 月历里的一天：`file` 那天的文件在不在（认一天只看文件名），`stat` 有文件才算 */
export interface CalendarDay {
  date: string
  file: boolean
  holiday: HolidayMark | null
  stat: DayStat | null
}

/** 某一年的法定假日下载得怎么样：`published` 已公布；`unpublished` 数据源里这一年还是空的；
 * `stale` 这次没下载到、用的是以前缓存的；`failed` 没下载到、也没有缓存 */
export type HolidayState = 'published' | 'unpublished' | 'stale' | 'failed'

export interface HolidayYearStatus {
  year: number
  state: HolidayState
  /** 缓存是什么时候下载的（ISO 时间），一次都没下载到过是 null */
  fetchedAt: string | null
  /** 这次没下载到的原因；下载到了是 null */
  error: string | null
}

export interface CalendarResult {
  today: string
  /** 窗口里的每一天，按日期升序，一天不缺 */
  days: CalendarDay[]
  holidays: HolidayYearStatus[]
}

export interface DaysResult extends PageInfo {
  today: string
  /** 窗口内有内容的日子，按日期升序；分页的是它 */
  days: DayStat[]
  streaks: { current: number; longest: number }
}

export interface TodosResult extends PageInfo {
  rows: TodoRow[]
}

export interface TagsResult {
  /** 标签树：按路径段嵌套（`#仿真/MMC` 是「仿真」的下级），根一层按含下级的行数降序 */
  tags: TagNode[]
}

export interface TaggedResult extends PageInfo {
  rows: TaggedRow[]
}

/** 快速记录落笔的结果：追加进了哪天的文件、文件是不是这次新建的 */
export interface CaptureResult {
  date: string
  file: string
  created: boolean
}

/** 读一天：文件在不在、解析出的行（文本去掉了行尾标签，标签单列） */
export interface DayResult {
  date: string
  file: boolean
  lines: DayLine[]
}

export const CALENDAR_COMMAND = 'journal.calendar'
export const DAYS_COMMAND = 'journal.days'
export const TODOS_COMMAND = 'journal.todos'
export const TAGS_COMMAND = 'journal.tags'
export const TAGGED_COMMAND = 'journal.tagged'
export const CAPTURE_COMMAND = 'journal.capture'
export const DAY_COMMAND = 'journal.day'
export const TOGGLE_COMMAND = 'journal.toggle'

/** 窗格与状态栏的 id：node 端登记、浏览器端开窗格用的是同一个 */
export const JOURNAL_PANE = 'journal'
export const DAY_PANE = 'day'
export const QUICK_CAPTURE_ID = 'quick-capture'
