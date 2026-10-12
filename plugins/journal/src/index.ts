// 日志插件的 node 端：八条命令（六条读 + 快速记录 + 勾待办）。数据是数据目录下一天一个 mdx 文件，
// 假日缓存是数据文档 holidays。窗格在浏览器端：日志窗格、当天窗格、状态栏快速记录
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 空的类型 import 只为让这几个包的 `declare module 'cordis'` 生效，ctx 上才有 gwbCommands / gwbData / gwbShell 的类型
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-data'
import type {} from '@godcreator/gwb-shell'
import { journalCommands, type JournalClock } from './node/commands.js'
import { createHolidayBook, HOLIDAY_DOC, type FetchText } from './node/holidays.js'
import { createJournalStore } from './node/store.js'
import { DAY_PANE, JOURNAL_PANE, QUICK_CAPTURE_ID } from './shared/types.js'

export const name = 'gwb-journal'

/** 命令总线与数据文档都在，cordis 才调用 apply；任何一个重新加载，本插件跟着重新加载。外壳可有可无，窗格跟着它在不在 */
export const inject = ['gwbCommands', 'gwbData']

/** 浏览器侧脚本与样式表的地址，注册窗格与状态栏项时交给外壳 */
const CLIENT = new URL('./client.js', import.meta.url).href
const STYLE = new URL('./style.css', import.meta.url).href

const HOLIDAY_FETCH_TIMEOUT_MS = 8000

const REAL_FETCH: FetchText = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(HOLIDAY_FETCH_TIMEOUT_MS) })
  return { status: response.status, text: await response.text() }
}

/** 测试换掉的两样：钟与下载 */
export interface JournalOptions {
  clock?: JournalClock
  fetchText?: FetchText
}

export function apply(ctx: GwbContext, options: JournalOptions = {}): void {
  const log = ctx.logger(name)
  const commands = ctx.gwbCommands
  if (commands === undefined) throw new Error('日志插件要命令总线 gwbCommands：inject 里写了它，却没拿到')
  const data = ctx.gwbData
  if (data === undefined) throw new Error('日志插件要数据文档 gwbData：inject 里写了它，却没拿到')
  const clock = options.clock ?? { now: () => new Date() }
  const store = createJournalStore(data.dir)
  const holidays = createHolidayBook({
    fetchText: options.fetchText ?? REAL_FETCH,
    store: { read: () => data.readDoc(HOLIDAY_DOC), write: (value) => data.writeDoc(HOLIDAY_DOC, value) },
    clock,
  })
  log.info('journal 已加载')

  for (const command of journalCommands({ store, holidays, clock })) commands.register(command.definition, (raw) => command.run(raw))

  ctx.inject(['gwbShell'], (scoped) => {
    scoped.gwbShell.registerPane({ id: JOURNAL_PANE, title: '日志', icon: 'calendar-days', kind: 'tool', client: CLIENT, style: STYLE })
    scoped.gwbShell.registerPane({ id: DAY_PANE, title: '当天', icon: 'calendar', kind: 'document', client: CLIENT, style: STYLE })
    scoped.gwbShell.registerStatusItem({ id: QUICK_CAPTURE_ID, title: '快速记录', icon: 'pen-line', client: CLIENT, style: STYLE })
    scoped.gwbShell.describeSelf({ title: '日志', icon: 'calendar-days' })
  })
}
