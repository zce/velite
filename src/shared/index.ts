import { z } from 'zod'

import * as shared from './shared'

const s = { ...shared, ...z }

export { s, z }
