/** Image processing capability. Optional: when absent, `s.image()` degrades. */
export interface ImageProcessor {
  probe(data: Uint8Array): Promise<{ width: number; height: number; format: string }>
  blurDataURL(data: Uint8Array): Promise<string>
}
