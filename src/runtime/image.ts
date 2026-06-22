/** Image processing capability. Optional: when absent, `s.image()` degrades. */
export interface ImageProcessor {
  /** Probe an image for its intrinsic dimensions and detected format. */
  probe(data: Uint8Array): Promise<{ width: number; height: number; format: string }>
  /**
   * Generate a tiny blur placeholder for `data`.
   *
   * When `metadata` is provided, the adapter trusts it and skips its own
   * internal metadata read — pass `probe()`'s result to avoid the duplicate
   * decode. When omitted, the adapter probes the image itself and returns
   * `''` for dimensionless inputs (e.g. SVGs without intrinsic size).
   */
  blurDataURL(data: Uint8Array, metadata?: { width: number; height: number }): Promise<string>
}
