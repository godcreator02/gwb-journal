// 窗格调自己命令的薄包装：回执判 ok 取 data，失败抛给调用方显示
import type { HostBridge } from '@godcreator/gwb-shell/pane'

export async function callData<T>(host: HostBridge, command: string, args?: unknown): Promise<T> {
  const reply = (await host.call(command, args)) as { ok?: boolean; data?: T; error?: string }
  if (reply?.ok !== true) throw new Error(`${command} 没成功：${reply?.error ?? '未知原因'}`)
  return reply.data as T
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
