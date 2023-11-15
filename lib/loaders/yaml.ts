/**
 * @file yaml file loader
 */

import yaml from 'yaml'

import { defineLoader } from '../types'

export default defineLoader({
  name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: async vfile => {
    vfile.data.result = yaml.parse(vfile.toString())
  }
})
