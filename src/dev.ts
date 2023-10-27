export interface DevOptions {
  port?: number
}

export default async (options: DevOptions = {}): Promise<void> => {
  console.log('dev')
}
