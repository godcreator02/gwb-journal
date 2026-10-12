// 命令参数的核对：参数是外部输入，形状不对抛 ArgumentError，命令回 invalid
import type { CaptureKind } from '../shared/capture.js'
import { isIsoDate } from '../shared/date.js'

export class ArgumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArgumentError'
  }
}

const reject = (message: string): never => {
  throw new ArgumentError(message)
}

/** 参数对象：顶层只认 `keys` 里的键，多写的当场拒 */
export function argumentFields(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return reject(`参数要是对象，认的键是 ${keys.join('、')}`)
  const unrecognizedKeys = Object.keys(raw).filter((key) => !keys.includes(key))
  if (unrecognizedKeys.length > 0) reject(`参数里认不出的键：${unrecognizedKeys.join('、')}（认的是 ${keys.join('、')}）`)
  return raw as Record<string, unknown>
}

export function requireDate(fields: Record<string, unknown>, key: string): string {
  const value = fields[key]
  return typeof value === 'string' && isIsoDate(value) ? value : reject(`${key} 要是一天，形如 2026-09-20${typeof value === 'string' ? `（拿到「${value}」）` : ''}`)
}

export function optionalDate(fields: Record<string, unknown>, key: string): string | undefined {
  return fields[key] === undefined ? undefined : requireDate(fields, key)
}

export function requireText(fields: Record<string, unknown>, key: string): string {
  const value = fields[key]
  return typeof value === 'string' && value.trim() !== '' ? value : reject(`${key} 要是一句非空的话`)
}

export function requireTag(fields: Record<string, unknown>): string {
  const value = fields['tag']
  if (typeof value !== 'string' || value === '') reject('tag 要是标签名（# 后面那段，非空、不含空白；写 / 表示层级，如 仿真/MMC）')
  return /\s/.test(value as string) ? reject('tag 里不能有空白（# 后面直到空白就是一个标签；/ 表示层级）') : (value as string)
}

export function optionalBoolean(fields: Record<string, unknown>, key: string): boolean | undefined {
  const value = fields[key]
  if (value === undefined) return undefined
  return typeof value === 'boolean' ? value : reject(`${key} 要是布尔值`)
}

export function requireCaptureKind(fields: Record<string, unknown>): CaptureKind {
  const value = fields['kind']
  return value === 'todo' || value === 'note' ? value : reject('kind 要是 todo（记成一条待办）或 note（记成一句话）')
}

export const MAX_PAGE_SIZE = 200
export const PAGING_KEYS = ['offset', 'limit'] as const
export const PAGING_USAGE = `offset?: number（从第几条起，默认 0）, limit?: number（一页几条，1–${String(MAX_PAGE_SIZE)}，默认 ${String(MAX_PAGE_SIZE)}）`

export interface Paging {
  offset: number
  limit: number
}

export function pagingOf(fields: Record<string, unknown>): Paging {
  const count = (key: string, min: number, max: number, fallback: number): number => {
    const value = fields[key]
    if (value === undefined) return fallback
    return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : reject(`${key} 要是 ${String(min)}–${String(max)} 的整数`)
  }
  return { offset: count('offset', 0, Number.MAX_SAFE_INTEGER, 0), limit: count('limit', 1, MAX_PAGE_SIZE, MAX_PAGE_SIZE) }
}

/** 一页：这一页的几条、一共几条、下一页从第几条起（读完是 null） */
export function pageOf<Item>(items: readonly Item[], paging: Paging): { items: Item[]; total: number; nextOffset: number | null } {
  const page = items.slice(paging.offset, paging.offset + paging.limit)
  const end = paging.offset + page.length
  return { items: page, total: items.length, nextOffset: end < items.length ? end : null }
}
