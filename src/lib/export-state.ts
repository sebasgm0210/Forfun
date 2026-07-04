import type { State } from "./store"

let latestExportState: State | null = null

export function setLatestExportState(state: State) {
  latestExportState = state
}

export function getLatestExportState() {
  return latestExportState
}
