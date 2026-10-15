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
   *
   * `output` lets callers customize the produced blur image's dimensions and
   * WebP quality. When omitted, the adapter picks a reasonable default
   * (8px wide, aspect-preserving height, quality 1). `output.width` /
   * `output.height` may not exceed the source dimensions.
   */
  blurDataURL(data: Uint8Array, metadata?: { width: number; height: number }, output?: { width?: number; height?: number; quality?: number }): Promise<string>
}
