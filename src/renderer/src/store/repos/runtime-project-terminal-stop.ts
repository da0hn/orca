import { callRuntimeRpc } from '../../runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '../../runtime/runtime-worktree-selector'

/**
 * Stops a project's shells on its runtime host ahead of `repo.rm`: the host resolves
 * `terminal.stop` through the project's workspace rows, which `repo.rm` deletes.
 */
export async function stopRuntimeProjectTerminalsBeforeRemoval(
  environmentId: string,
  projectId: string,
  worktreeIds: readonly string[]
): Promise<void> {
  const target = { kind: 'environment', environmentId } as const
  // Why: repo.show shares repo.rm's resolver, so a removal the host will reject (e.g.
  // selector_ambiguous) leaves the shells running instead of killing them first.
  const hostResolvesProject = await callRuntimeRpc(
    target,
    'repo.show',
    { repo: projectId },
    { timeoutMs: 15_000 }
  ).then(
    () => true,
    (error: unknown) => {
      console.warn('[e2e-diag] repo.show failed', environmentId, projectId, String(error))
      return false
    }
  )
  console.warn('[e2e-diag] stop pass', environmentId, projectId, hostResolvesProject, worktreeIds)
  if (!hostResolvesProject) {
    return
  }
  const settled = await Promise.allSettled(
    worktreeIds.map((worktreeId) =>
      callRuntimeRpc(
        target,
        'terminal.stop',
        { worktree: toRuntimeWorktreeSelector(worktreeId) },
        { timeoutMs: 15_000 }
      )
    )
  )
  console.warn(
    '[e2e-diag] stop results',
    JSON.stringify(
      settled.map((entry) => (entry.status === 'fulfilled' ? entry.value : String(entry.reason)))
    )
  )
}
