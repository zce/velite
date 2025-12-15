import type { NextConfig } from 'next'
import type { Options as VeliteOptions } from 'velite'

export type Options = Omit<VeliteOptions, 'watch' | 'clean'>

type NextConfigFunction = (phase: string, options: { defaultConfig: NextConfig }) => Promise<NextConfig> | NextConfig
type NextConfigInput = NextConfig | NextConfigFunction

/**
 * Create a Next.js plugin for integrating Velite
 */
declare const createNextPlugin: (options?: Options) => <T extends NextConfigInput>(nextConfig?: T) => Promise<T>

/**
 * Next.js plugin for integrating Velite
 */
declare const withVelite: ReturnType<typeof createNextPlugin>

export { createNextPlugin, withVelite, type Options }
