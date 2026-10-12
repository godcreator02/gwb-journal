// journal 的数据目录（gwbData 给的插件数据目录）：一天一个 mdx 文件，认一天只看文件名。写盘先写同目录临时文件再改名
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dayFileOf } from '../shared/days.js'

export interface JournalStore {
  /** 全部有文件的日子：日期 → 文件内容 */
  days(): Promise<Map<string, string>>
  /** 一天的内容；没有文件是 null */
  day(date: string): Promise<string | null>
  /** 往一天末尾追加一行（不带换行符的原文），文件没有就建。回：是不是这次新建的 */
  append(date: string, line: string): Promise<boolean>
  /** 整份替换一天的内容（勾掉待办用），文件必须已在 */
  writeDay(date: string, content: string): Promise<void>
}

export function createJournalStore(dir: string): JournalStore {
  const pathOf = (date: string): string => join(dir, `${date}.mdx`)

  const writeAtomic = async (target: string, body: string): Promise<void> => {
    const temp = `${target}.tmp`
    await writeFile(temp, body, 'utf8')
    await rename(temp, target)
  }

  const append = async (date: string, line: string): Promise<boolean> => {
    await mkdir(dir, { recursive: true })
    const target = pathOf(date)
    const before = await readFile(target, 'utf8').catch(() => null)
    const body = before === null ? `${line}\n` : `${before.endsWith('\n') || before === '' ? before : `${before}\n`}${line}\n`
    await writeAtomic(target, body)
    return before === null
  }

  return {
    async days() {
      const names = await readdir(dir).catch(() => [] as string[])
      const dates = names.flatMap((name) => {
        const date = dayFileOf(name)
        return date === null ? [] : [date]
      })
      const entries = await Promise.all(
        dates.map(async (date) => [date, await readFile(pathOf(date), 'utf8')] as const),
      )
      return new Map(entries)
    },
    async day(date) {
      return readFile(pathOf(date), 'utf8').catch(() => null)
    },
    append,
    async writeDay(date, content) {
      await writeAtomic(pathOf(date), content)
    },
  }
}
