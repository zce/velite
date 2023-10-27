export interface BuildOptions {
  config?: string
}

export default async (options: BuildOptions = {}): Promise<void> => {
  console.log('build')
}
