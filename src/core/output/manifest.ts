/** Maps absolute output file paths to content digests from the last successful write. */
export interface OutputManifest {
  files: Record<string, string>
}

export const emptyManifest = (): OutputManifest => ({ files: {} })
