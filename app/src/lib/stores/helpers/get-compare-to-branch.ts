import { TipState } from '../../../models/tip'
import { IRepositoryState, IBranchesState } from '../../app-state'
import { Repository } from '../../../models/repository'
import { GitHubRepository } from '../../../models/github-repository'
import { ComparisonCache } from '../../comparison-cache'
import { Branch } from '../../../models/branch'

//TODO: make private; needed linter to leave me alone
//TODO: figure out if it's better to return branch name or SHA
export function getCompareToBranch(
  repository: Repository,
  state: IRepositoryState
): string | null {
  const { compareState, branchesState } = state
  const tip = branchesState.tip
  const currentBranch = tip.kind === TipState.Valid ? tip.branch : null

  if (currentBranch === null) {
    return null
  }

  // If the current branch has a PR associated with it, use the target branch of the PR
  const associatedPullRequest = branchesState.currentPullRequest
  if (associatedPullRequest !== null) {
    return associatedPullRequest.base.ref
  }

  const githubRepository = repository.gitHubRepository
  if (githubRepository !== null) {
    if (githubRepository.fork) {
      return inferCompareToBranchFromFork(
        currentBranch,
        githubRepository,
        branchesState,
        compareState.aheadBehindCache
      )
    } else {
      return githubRepository.defaultBranch
    }
  }

  // fall through to the local master branch
  const defaultBranch = branchesState.allBranches.find(b => b.name === 'master')
  return defaultBranch!.name
}

// if the repository is a fork, use the default branch on upstream
// otherwise use the default branch on origin
// if the repo is a fork, parent must exist(???)
function inferCompareToBranchFromFork(
  currentBranch: Branch,
  ghRepository: GitHubRepository,
  state: IBranchesState,
  cache: ComparisonCache
) {
  const defaultBranchName = ghRepository.defaultBranch

  // TODO: figure out if this branch is stored in branch list
  // TODO: figure out what to return
  if (defaultBranchName === null) {
    return null
  }

  const defaultBranch = state.allBranches.find(
    b => b.name === defaultBranchName
  )

  // TODO: figure out if it's a problem that
  // we don't store the branch in our branches list
  if (defaultBranch === undefined) {
    return null
  }

  const defaultBranchAheadBehind = cache.get(
    defaultBranch.tip.sha,
    currentBranch.tip.sha
  )

  // If no changes exist on orgin/master
  // then return upstream/master instead
  if (
    defaultBranchAheadBehind !== null &&
    defaultBranchAheadBehind.behind > 0
  ) {
    return defaultBranch.name
  }

  return ghRepository.parent!.defaultBranch
}
