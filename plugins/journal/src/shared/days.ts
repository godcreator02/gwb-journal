// 一天 mdx 的解析与聚合：行、任务、行尾标签。认一天只看文件名（调用方管），这里只看内容；
// frontmatter（首行 --- 到下一个 ---）跳过，空行不算行

/** 一天的文件名：`YYYY-MM-DD.mdx` */
export const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.mdx$/

/** 这一行是不是文件名认的那一天 */
export function dayFileOf(name: string): string | null {
  const matched = DAY_FILE.exec(name)
  return matched === null ? null : (matched[1] as string)
}

/** 任务行的形状：任意缩进的 `- [ ]` / `- [x]`，勾没勾大小写都认 */
const TASK = /^(\s*)- \[( |x|X)\] (.*)$/

/**
 * 行尾标签：一行末尾连续的 `#名字`（每个前面是空白或行首），从尾部逐个剥出来。
 * `abc#tag` 不算（# 前没有空白）；`#` 后直到空白，中文随便用
 */
export function splitTrailingTags(line: string): { text: string; tags: string[] } {
  let text = line.trimEnd()
  const tags: string[] = []
  for (;;) {
    const matched = /(?:^|\s)(#[^\s#]+)$/.exec(text)
    if (matched === null) break
    tags.unshift((matched[1] as string).slice(1))
    text = text.slice(0, matched.index).trimEnd()
  }
  return { text, tags }
}

/** 一行解析出来的东西：文本（去掉行尾标签）、任务态、行尾标签 */
export interface DayLine {
  text: string
  task: 'open' | 'done' | null
  tags: string[]
}

/** 一天的内容 → 行列表（跳过 frontmatter 与空行，保持行序） */
export function parseDayLines(content: string): DayLine[] {
  const rawLines = content.split(/\r?\n/)
  const start = rawLines[0] === '---' ? rawLines.indexOf('---', 1) : -1
  const body = start === -1 ? rawLines : rawLines.slice(start + 1)
  const out: DayLine[] = []
  for (const raw of body) {
    if (raw.trim() === '') continue
    const task = TASK.exec(raw)
    const rest = task === null ? raw : (task[3] as string)
    const { text, tags } = splitTrailingTags(rest)
    out.push({ text, task: task === null ? null : (task[2] as string) === ' ' ? 'open' : 'done', tags })
  }
  return out
}

/** 一天的统计：记事几行、任务几条、勾掉几条 */
export interface DayStat {
  date: string
  entries: number
  tasks: number
  done: number
}

export function statOfDay(date: string, lines: readonly DayLine[]): DayStat {
  let entries = 0
  let tasks = 0
  let done = 0
  for (const line of lines) {
    if (line.task === null) entries += 1
    else {
      tasks += 1
      if (line.task === 'done') done += 1
    }
  }
  return { date, entries, tasks, done }
}

/** 全库任务行：日期倒序（同一天保持行序）。`includeDone` 为假只回没勾的 */
export interface TodoRow {
  date: string
  text: string
  done: boolean
}

export function todosOf(days: readonly { date: string; lines: readonly DayLine[] }[], includeDone: boolean): TodoRow[] {
  const ordered = [...days].sort((left, right) => right.date.localeCompare(left.date))
  const out: TodoRow[] = []
  for (const day of ordered) {
    for (const line of day.lines) {
      if (line.task === null) continue
      if (!includeDone && line.task === 'done') continue
      out.push({ date: day.date, text: line.text, done: line.task === 'done' })
    }
  }
  return out
}

/** 一个标签的回看：一行一条，日期倒序（同一天保持行序）；tags 是这一行实际打的标签（显示徽章用） */
export interface TaggedRow {
  date: string
  text: string
  task: 'open' | 'done' | null
  tags: string[]
}

/** `tag` 含下级时一行算不算：`#仿真` 也算 `#仿真/MMC` 那行的（照旧 bn-tags 的习惯）；exact 只认精确路径 */
export function tagMatches(lineTag: string, tag: string, exact: boolean): boolean {
  if (exact) return lineTag === tag
  return lineTag === tag || lineTag.startsWith(`${tag}/`)
}

export function taggedOf(days: readonly { date: string; lines: readonly DayLine[] }[], tag: string, exact: boolean): TaggedRow[] {
  const ordered = [...days].sort((left, right) => right.date.localeCompare(left.date))
  const out: TaggedRow[] = []
  for (const day of ordered) {
    for (const line of day.lines) {
      if (line.tags.some((each) => tagMatches(each, tag, exact))) out.push({ date: day.date, text: line.text, task: line.task, tags: line.tags })
    }
  }
  return out
}

/** 标签树的一个节点：`path` 是完整路径（`仿真/MMC`），`tag` 是最后一段；`lines` 是直接打这个路径的行数，`withChildren` 连下级一起数 */
export interface TagNode {
  tag: string
  path: string
  lines: number
  withChildren: number
  /** 含下级里最近出现的日子（树排序与显示用） */
  lastDate: string
  children: TagNode[]
}

/** 标签总览：按路径段组树，根一层按含下级的行数降序 */
export function tagsOf(days: readonly { date: string; lines: readonly DayLine[] }[]): TagNode[] {
  const exact = new Map<string, { lines: number; lastDate: string }>()
  for (const day of days) {
    for (const line of day.lines) {
      for (const tag of line.tags) {
        const known = exact.get(tag)
        if (known === undefined) exact.set(tag, { lines: 1, lastDate: day.date })
        else {
          known.lines += 1
          if (day.date > known.lastDate) known.lastDate = day.date
        }
      }
    }
  }
  const roots: TagNode[] = []
  const byPath = new Map<string, TagNode>()
  const nodeAt = (path: string): TagNode => {
    const found = byPath.get(path)
    if (found !== undefined) return found
    const slash = path.lastIndexOf('/')
    const parent = slash === -1 ? null : nodeAt(path.slice(0, slash))
    const created: TagNode = { tag: path.slice(slash + 1), path, lines: 0, withChildren: 0, lastDate: '', children: [] }
    byPath.set(path, created)
    ;(parent === null ? roots : parent.children).push(created)
    return created
  }
  for (const [path, stat] of [...exact.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const node = nodeAt(path)
    node.lines = stat.lines
    node.lastDate = stat.lastDate
  }
  /** 自底向上补 withChildren 与 lastDate（父的最近日子取自己与下级里最近的） */
  const settle = (node: TagNode): void => {
    node.children.sort((left, right) => right.withChildren - left.withChildren || left.tag.localeCompare(right.tag))
    for (const child of node.children) settle(child)
    node.withChildren = node.lines + node.children.reduce((sum, child) => sum + child.withChildren, 0)
    node.lastDate = [node.lastDate, ...node.children.map((child) => child.lastDate)].reduce((latest, each) => (each > latest ? each : latest), '')
  }
  for (const root of roots) settle(root)
  roots.sort((left, right) => right.withChildren - left.withChildren || left.tag.localeCompare(right.tag))
  return roots
}

/**
 * 把一天里第一条文本完全匹配的任务行翻转到给定状态（保留缩进与行尾标签），回改后的全文与有没有改到。
 * 文本按去掉行尾标签后的比——todos 回执里的 text 就是它；同文本多条时只动第一条，要改的是哪条，把那条写得更具体些
 */
export function toggleTaskLine(content: string, text: string, done: boolean): { content: string; changed: boolean } {
  const lines = content.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    if (raw === undefined) continue
    const task = TASK.exec(raw)
    if (task === null) continue
    if (splitTrailingTags(task[3] ?? '').text !== text) continue
    const mark = done ? 'x' : ' '
    if ((task[2] ?? '') === mark) return { content, changed: false }
    lines[index] = `${task[1] ?? ''}- [${mark}] ${task[3] ?? ''}`
    return { content: lines.join('\n'), changed: true }
  }
  return { content, changed: false }
}
