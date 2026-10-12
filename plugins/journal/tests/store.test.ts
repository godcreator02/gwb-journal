import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createJournalStore } from '../src/node/store.js'

const dirs: string[] = []

async function freshDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gwb-journal-test-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  // 临时目录交给系统清理，这里只保证不再引用
  dirs.length = 0
})

describe('JournalStore', () => {
  it('新的一天：append 建文件、回 created 为真，内容以换行收尾', async () => {
    const store = createJournalStore(await freshDir())
    await expect(store.day('2026-10-12')).resolves.toBeNull()
    await expect(store.append('2026-10-12', '- [ ] 第一条')).resolves.toBe(true)
    await expect(store.day('2026-10-12')).resolves.toBe('- [ ] 第一条\n')
  })

  it('已有文件追加一行，接得上', async () => {
    const store = createJournalStore(await freshDir())
    await store.append('2026-10-12', '第一行')
    await store.append('2026-10-12', '第二行')
    await expect(store.day('2026-10-12')).resolves.toBe('第一行\n第二行\n')
  })

  it('days() 只认日期文件名；目录还没有也不报错', async () => {
    const store = createJournalStore(await freshDir())
    await expect(store.days()).resolves.toEqual(new Map())

    const dir = await freshDir()
    const store2 = createJournalStore(dir)
    await store2.append('2026-10-12', '一句')
    await store2.append('2026-10-13', '两句')
    const days = await store2.days()
    expect([...days.keys()].sort()).toEqual(['2026-10-12', '2026-10-13'])
    expect(days.get('2026-10-12')).toBe('一句\n')
  })

  it('追加完目录里没有 .tmp 残留（先写临时文件再改名）', async () => {
    const dir = await freshDir()
    const store = createJournalStore(dir)
    await store.append('2026-10-12', '一句')
    await expect(readdir(dir)).resolves.toEqual(['2026-10-12.mdx'])
    await expect(readFile(join(dir, '2026-10-12.mdx'), 'utf8')).resolves.toBe('一句\n')
  })
})
