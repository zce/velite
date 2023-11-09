export interface Entry {
  [name: string]: unknown
  // source file path
  _file?: string
}

export interface Collections {
  [name: string]: Entry[]
}

export interface FieldBase {
  required?: boolean
  default?: unknown
}

export interface StringField extends FieldBase {
  type: 'string'
  default?: string
}
export interface NumberField extends FieldBase {
  type: 'number'
  default?: number
}
export interface BooleanField extends FieldBase {
  type: 'boolean'
  default?: boolean
}
export interface DateField extends FieldBase {
  type: 'date'
  default?: Date
}
export interface FileField extends FieldBase {
  type: 'file'
  default?: string
}

export interface NestedField extends FieldBase {
  type: 'nested'
  of: Fields
  default?: Record<string, unknown>
}

export interface ListFieldBase extends FieldBase {
  type: 'list'
  default?: unknown[]
}
export interface StringListField extends ListFieldBase {
  of: 'string'
  default?: string[]
}
export interface NumberListField extends ListFieldBase {
  of: 'number'
  default?: number[]
}
export interface BooleanListField extends ListFieldBase {
  of: 'boolean'
  default?: boolean[]
}
export interface DateListField extends ListFieldBase {
  of: 'date'
  default?: Date[]
}
export interface FileListField extends ListFieldBase {
  of: 'file'
  default?: string[]
}
export interface NestedListField extends ListFieldBase {
  of: Fields
  default?: Array<Record<string, unknown>>
}

export type Field =
  | StringField
  | NumberField
  | BooleanField
  | DateField
  | FileField
  | NestedField
  | StringListField
  | NumberListField
  | BooleanListField
  | DateListField
  | FileListField
  | NestedListField

export interface Fields {
  [name: string]: Field
}

export interface Schema {
  name: string
  pattern: string
  type: 'yaml' | 'json' | 'markdown'
  fields: Fields
  computeds?: Record<string, (data: Record<string, unknown>) => unknown | Promise<unknown>>
}

export interface Parsers {
  [type: string]: (file: string) => Promise<unknown>
}

export interface Config {
  root: string
  output: { data: string; public: string; publicUrl: string }
  schemas: Record<string, Schema>
  callback?: (collections: Collections) => void | Promise<void>
  parsers?: Parsers
}

// for user config type inference
export const defineConfig = (config: Config): Config => config
export const defineNestedType = (fields: Fields): Fields => fields
