import { CompileOptions } from '@mdx-js/mdx'
import * as unist from 'unist'
import { Data as Data$8, Node as Node$5, Point as Point$1, Position as Position$1 } from 'unist'

type LogType = 'debug' | 'info' | 'warn' | 'error'
type LogLevel = LogType | 'silent'
declare const logger: {
  log: (msg: unknown, begin?: number) => void
  info: (msg: unknown, begin?: number) => void
  warn: (msg: unknown, begin?: number) => void
  error: (msg: unknown, begin?: number) => void
  clear: () => void
  set: (level: LogLevel) => void
}

type Primitive = string | number | symbol | bigint | boolean | null | undefined
type Scalars = Primitive | Primitive[]

declare namespace util {
  type AssertEqual<T, U> = (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2 ? true : false
  export type isAny<T> = 0 extends 1 & T ? true : false
  export const assertEqual: <A, B>(val: AssertEqual<A, B>) => AssertEqual<A, B>
  export function assertIs<T>(_arg: T): void
  export function assertNever(_x: never): never
  export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
  export type OmitKeys<T, K extends string> = Pick<T, Exclude<keyof T, K>>
  export type MakePartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
  export type Exactly<T, X> = T & Record<Exclude<keyof X, keyof T>, never>
  export const arrayToEnum: <T extends string, U extends [T, ...T[]]>(items: U) => { [k in U[number]]: k }
  export const getValidEnumValues: (obj: any) => any[]
  export const objectValues: (obj: any) => any[]
  export const objectKeys: ObjectConstructor['keys']
  export const find: <T>(arr: T[], checker: (arg: T) => any) => T | undefined
  export type identity<T> = objectUtil.identity<T>
  export type flatten<T> = objectUtil.flatten<T>
  export type noUndefined<T> = T extends undefined ? never : T
  export const isInteger: NumberConstructor['isInteger']
  export function joinValues<T extends any[]>(array: T, separator?: string): string
  export const jsonStringifyReplacer: (_: string, value: any) => any
  export {}
}
declare namespace objectUtil {
  export type MergeShapes<U, V> = {
    [k in Exclude<keyof U, keyof V>]: U[k]
  } & V
  type optionalKeys<T extends object> = {
    [k in keyof T]: undefined extends T[k] ? k : never
  }[keyof T]
  type requiredKeys<T extends object> = {
    [k in keyof T]: undefined extends T[k] ? never : k
  }[keyof T]
  export type addQuestionMarks<T extends object, _O = any> = {
    [K in requiredKeys<T>]: T[K]
  } & {
    [K in optionalKeys<T>]?: T[K]
  } & {
    [k in keyof T]?: unknown
  }
  export type identity<T> = T
  export type flatten<T> = identity<{
    [k in keyof T]: T[k]
  }>
  export type noNeverKeys<T> = {
    [k in keyof T]: [T[k]] extends [never] ? never : k
  }[keyof T]
  export type noNever<T> = identity<{
    [k in noNeverKeys<T>]: k extends keyof T ? T[k] : never
  }>
  export const mergeShapes: <U, T>(first: U, second: T) => T & U
  export type extendShape<A extends object, B extends object> = {
    [K in keyof A as K extends keyof B ? never : K]: A[K]
  } & {
    [K in keyof B]: B[K]
  }
  export {}
}
declare const ZodParsedType: {
  string: 'string'
  number: 'number'
  bigint: 'bigint'
  boolean: 'boolean'
  symbol: 'symbol'
  undefined: 'undefined'
  object: 'object'
  function: 'function'
  map: 'map'
  nan: 'nan'
  integer: 'integer'
  float: 'float'
  date: 'date'
  null: 'null'
  array: 'array'
  unknown: 'unknown'
  promise: 'promise'
  void: 'void'
  never: 'never'
  set: 'set'
}
type ZodParsedType = keyof typeof ZodParsedType
declare const getParsedType: (data: any) => ZodParsedType

type allKeys<T> = T extends any ? keyof T : never
type inferFlattenedErrors<T extends ZodType<any, any, any>, U = string> = typeToFlattenedError<TypeOf<T>, U>
type typeToFlattenedError<T, U = string> = {
  formErrors: U[]
  fieldErrors: {
    [P in allKeys<T>]?: U[]
  }
}
declare const ZodIssueCode: {
  invalid_type: 'invalid_type'
  invalid_literal: 'invalid_literal'
  custom: 'custom'
  invalid_union: 'invalid_union'
  invalid_union_discriminator: 'invalid_union_discriminator'
  invalid_enum_value: 'invalid_enum_value'
  unrecognized_keys: 'unrecognized_keys'
  invalid_arguments: 'invalid_arguments'
  invalid_return_type: 'invalid_return_type'
  invalid_date: 'invalid_date'
  invalid_string: 'invalid_string'
  too_small: 'too_small'
  too_big: 'too_big'
  invalid_intersection_types: 'invalid_intersection_types'
  not_multiple_of: 'not_multiple_of'
  not_finite: 'not_finite'
}
type ZodIssueCode = keyof typeof ZodIssueCode
type ZodIssueBase = {
  path: (string | number)[]
  message?: string
}
interface ZodInvalidTypeIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_type
  expected: ZodParsedType
  received: ZodParsedType
}
interface ZodInvalidLiteralIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_literal
  expected: unknown
  received: unknown
}
interface ZodUnrecognizedKeysIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.unrecognized_keys
  keys: string[]
}
interface ZodInvalidUnionIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_union
  unionErrors: ZodError[]
}
interface ZodInvalidUnionDiscriminatorIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_union_discriminator
  options: Primitive[]
}
interface ZodInvalidEnumValueIssue extends ZodIssueBase {
  received: string | number
  code: typeof ZodIssueCode.invalid_enum_value
  options: (string | number)[]
}
interface ZodInvalidArgumentsIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_arguments
  argumentsError: ZodError
}
interface ZodInvalidReturnTypeIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_return_type
  returnTypeError: ZodError
}
interface ZodInvalidDateIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_date
}
type StringValidation =
  | 'email'
  | 'url'
  | 'emoji'
  | 'uuid'
  | 'nanoid'
  | 'regex'
  | 'cuid'
  | 'cuid2'
  | 'ulid'
  | 'datetime'
  | 'date'
  | 'time'
  | 'duration'
  | 'ip'
  | 'base64'
  | {
      includes: string
      position?: number
    }
  | {
      startsWith: string
    }
  | {
      endsWith: string
    }
interface ZodInvalidStringIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_string
  validation: StringValidation
}
interface ZodTooSmallIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.too_small
  minimum: number | bigint
  inclusive: boolean
  exact?: boolean
  type: 'array' | 'string' | 'number' | 'set' | 'date' | 'bigint'
}
interface ZodTooBigIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.too_big
  maximum: number | bigint
  inclusive: boolean
  exact?: boolean
  type: 'array' | 'string' | 'number' | 'set' | 'date' | 'bigint'
}
interface ZodInvalidIntersectionTypesIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.invalid_intersection_types
}
interface ZodNotMultipleOfIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.not_multiple_of
  multipleOf: number | bigint
}
interface ZodNotFiniteIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.not_finite
}
interface ZodCustomIssue extends ZodIssueBase {
  code: typeof ZodIssueCode.custom
  params?: {
    [k: string]: any
  }
}
type DenormalizedError = {
  [k: string]: DenormalizedError | string[]
}
type ZodIssueOptionalMessage =
  | ZodInvalidTypeIssue
  | ZodInvalidLiteralIssue
  | ZodUnrecognizedKeysIssue
  | ZodInvalidUnionIssue
  | ZodInvalidUnionDiscriminatorIssue
  | ZodInvalidEnumValueIssue
  | ZodInvalidArgumentsIssue
  | ZodInvalidReturnTypeIssue
  | ZodInvalidDateIssue
  | ZodInvalidStringIssue
  | ZodTooSmallIssue
  | ZodTooBigIssue
  | ZodInvalidIntersectionTypesIssue
  | ZodNotMultipleOfIssue
  | ZodNotFiniteIssue
  | ZodCustomIssue
type ZodIssue = ZodIssueOptionalMessage & {
  fatal?: boolean
  message: string
}
declare const quotelessJson: (obj: any) => string
type recursiveZodFormattedError<T> = T extends [any, ...any[]]
  ? {
      [K in keyof T]?: ZodFormattedError<T[K]>
    }
  : T extends any[]
    ? {
        [k: number]: ZodFormattedError<T[number]>
      }
    : T extends object
      ? {
          [K in keyof T]?: ZodFormattedError<T[K]>
        }
      : unknown
type ZodFormattedError<T, U = string> = {
  _errors: U[]
} & recursiveZodFormattedError<NonNullable<T>>
type inferFormattedError<T extends ZodType<any, any, any>, U = string> = ZodFormattedError<TypeOf<T>, U>
declare class ZodError<T = any> extends Error {
  issues: ZodIssue[]
  get errors(): ZodIssue[]
  constructor(issues: ZodIssue[])
  format(): ZodFormattedError<T>
  format<U>(mapper: (issue: ZodIssue) => U): ZodFormattedError<T, U>
  static create: (issues: ZodIssue[]) => ZodError<any>
  static assert(value: unknown): asserts value is ZodError
  toString(): string
  get message(): string
  get isEmpty(): boolean
  addIssue: (sub: ZodIssue) => void
  addIssues: (subs?: ZodIssue[]) => void
  flatten(): typeToFlattenedError<T>
  flatten<U>(mapper?: (issue: ZodIssue) => U): typeToFlattenedError<T, U>
  get formErrors(): typeToFlattenedError<T, string>
}
type stripPath<T extends object> = T extends any ? util.OmitKeys<T, 'path'> : never
type IssueData = stripPath<ZodIssueOptionalMessage> & {
  path?: (string | number)[]
  fatal?: boolean
}
type ErrorMapCtx = {
  defaultError: string
  data: any
}
type ZodErrorMap = (
  issue: ZodIssueOptionalMessage,
  _ctx: ErrorMapCtx
) => {
  message: string
}

declare const errorMap: ZodErrorMap

declare function setErrorMap(map: ZodErrorMap): void
declare function getErrorMap(): ZodErrorMap

declare const makeIssue: (params: { data: any; path: (string | number)[]; errorMaps: ZodErrorMap[]; issueData: IssueData }) => ZodIssue
interface ZodMeta {
  [key: string | number | symbol]: unknown
}
type ParseParams = {
  path: (string | number)[]
  meta: ZodMeta
  errorMap: ZodErrorMap
  async: boolean
}
type ParsePathComponent = string | number
type ParsePath = ParsePathComponent[]
declare const EMPTY_PATH: ParsePath
interface ParseContext {
  readonly common: {
    readonly issues: ZodIssue[]
    readonly contextualErrorMap?: ZodErrorMap
    readonly async: boolean
  }
  readonly path: ParsePath
  readonly meta: ZodMeta
  readonly schemaErrorMap?: ZodErrorMap
  readonly parent: ParseContext | null
  readonly data: any
  readonly parsedType: ZodParsedType
}
type ParseInput = {
  data: any
  path: (string | number)[]
  meta: ZodMeta
  parent: ParseContext
}
declare function addIssueToContext(ctx: ParseContext, issueData: IssueData): void
type ObjectPair = {
  key: SyncParseReturnType<any>
  value: SyncParseReturnType<any>
}
declare class ParseStatus {
  value: 'aborted' | 'dirty' | 'valid'
  dirty(): void
  abort(): void
  static mergeArray(status: ParseStatus, results: SyncParseReturnType<any>[]): SyncParseReturnType
  static mergeObjectAsync(
    status: ParseStatus,
    pairs: {
      key: ParseReturnType<any>
      value: ParseReturnType<any>
    }[]
  ): Promise<SyncParseReturnType<any>>
  static mergeObjectSync(
    status: ParseStatus,
    pairs: {
      key: SyncParseReturnType<any>
      value: SyncParseReturnType<any>
      alwaysSet?: boolean
    }[]
  ): SyncParseReturnType
}
interface ParseResult {
  status: 'aborted' | 'dirty' | 'valid'
  data: any
}
type INVALID = {
  status: 'aborted'
}
declare const INVALID: INVALID
type DIRTY<T> = {
  status: 'dirty'
  value: T
}
declare const DIRTY: <T>(value: T) => DIRTY<T>
type OK<T> = {
  status: 'valid'
  value: T
}
declare const OK: <T>(value: T) => OK<T>
type SyncParseReturnType<T = any> = OK<T> | DIRTY<T> | INVALID
type AsyncParseReturnType<T> = Promise<SyncParseReturnType<T>>
type ParseReturnType<T> = SyncParseReturnType<T> | AsyncParseReturnType<T>
declare const isAborted: (x: ParseReturnType<any>) => x is INVALID
declare const isDirty: <T>(x: ParseReturnType<T>) => x is OK<T> | DIRTY<T>
declare const isValid: <T>(x: ParseReturnType<T>) => x is OK<T>
declare const isAsync: <T>(x: ParseReturnType<T>) => x is AsyncParseReturnType<T>

declare namespace enumUtil {
  type UnionToIntersectionFn<T> = (T extends unknown ? (k: () => T) => void : never) extends (k: infer Intersection) => void ? Intersection : never
  type GetUnionLast<T> = UnionToIntersectionFn<T> extends () => infer Last ? Last : never
  type UnionToTuple<T, Tuple extends unknown[] = []> = [T] extends [never] ? Tuple : UnionToTuple<Exclude<T, GetUnionLast<T>>, [GetUnionLast<T>, ...Tuple]>
  type CastToStringTuple<T> = T extends [string, ...string[]] ? T : never
  export type UnionToTupleString<T> = CastToStringTuple<UnionToTuple<T>>
  export {}
}

declare namespace errorUtil {
  type ErrMessage =
    | string
    | {
        message?: string
      }
  const errToObj: (message?: ErrMessage) => {
    message?: string
  }
  const toString: (message?: ErrMessage) => string | undefined
}

declare namespace partialUtil {
  type DeepPartial<T extends ZodTypeAny> =
    T extends ZodObject<ZodRawShape>
      ? ZodObject<
          {
            [k in keyof T['shape']]: ZodOptional<DeepPartial<T['shape'][k]>>
          },
          T['_def']['unknownKeys'],
          T['_def']['catchall']
        >
      : T extends ZodArray<infer Type, infer Card>
        ? ZodArray<DeepPartial<Type>, Card>
        : T extends ZodOptional<infer Type>
          ? ZodOptional<DeepPartial<Type>>
          : T extends ZodNullable<infer Type>
            ? ZodNullable<DeepPartial<Type>>
            : T extends ZodTuple<infer Items>
              ? {
                  [k in keyof Items]: Items[k] extends ZodTypeAny ? DeepPartial<Items[k]> : never
                } extends infer PI
                ? PI extends ZodTupleItems
                  ? ZodTuple<PI>
                  : never
                : never
              : T
}

interface RefinementCtx {
  addIssue: (arg: IssueData) => void
  path: (string | number)[]
  meta: ZodMeta
}
type ZodRawShape = {
  [k: string]: ZodTypeAny
}
type ZodTypeAny = ZodType<any, any, any>
type TypeOf<T extends ZodType<any, any, any>> = T['_output']
type input<T extends ZodType<any, any, any>> = T['_input']
type output<T extends ZodType<any, any, any>> = T['_output']

type CustomErrorParams = Partial<util.Omit<ZodCustomIssue, 'code'>>
interface ZodTypeDef {
  errorMap?: ZodErrorMap
  description?: string
}
type RawCreateParams =
  | {
      errorMap?: ZodErrorMap
      invalid_type_error?: string
      required_error?: string
      message?: string
      description?: string
    }
  | undefined
type ProcessedCreateParams = {
  errorMap?: ZodErrorMap
  description?: string
}
type SafeParseSuccess<Output> = {
  success: true
  data: Output
  error?: never
}
type SafeParseError<Input> = {
  success: false
  error: ZodError<Input>
  data?: never
}
type SafeParseReturnType<Input, Output> = SafeParseSuccess<Output> | SafeParseError<Input>
declare abstract class ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
  readonly _type: Output
  readonly _output: Output
  readonly _input: Input
  readonly _def: Def
  get description(): string | undefined
  abstract _parse(input: ParseInput): ParseReturnType<Output>
  _getType(input: ParseInput): string
  _getOrReturnCtx(input: ParseInput, ctx?: ParseContext | undefined): ParseContext
  _processInputParams(input: ParseInput): {
    status: ParseStatus
    ctx: ParseContext
  }
  _parseSync(input: ParseInput): SyncParseReturnType<Output>
  _parseAsync(input: ParseInput): AsyncParseReturnType<Output>
  parse(data: unknown, params?: Partial<ParseParams>): Output
  safeParse(data: unknown, params?: Partial<ParseParams>): SafeParseReturnType<Input, Output>
  parseAsync(data: unknown, params?: Partial<ParseParams>): Promise<Output>
  safeParseAsync(data: unknown, params?: Partial<ParseParams>): Promise<SafeParseReturnType<Input, Output>>
  /** Alias of safeParseAsync */
  spa: (data: unknown, params?: Partial<ParseParams>) => Promise<SafeParseReturnType<Input, Output>>
  refine<RefinedOutput extends Output>(
    check: (arg: Output) => arg is RefinedOutput,
    message?: string | CustomErrorParams | ((arg: Output) => CustomErrorParams)
  ): ZodEffects<this, RefinedOutput, Input>
  refine(
    check: (arg: Output) => unknown | Promise<unknown>,
    message?: string | CustomErrorParams | ((arg: Output) => CustomErrorParams)
  ): ZodEffects<this, Output, Input>
  refinement<RefinedOutput extends Output>(
    check: (arg: Output) => arg is RefinedOutput,
    refinementData: IssueData | ((arg: Output, ctx: RefinementCtx) => IssueData)
  ): ZodEffects<this, RefinedOutput, Input>
  refinement(check: (arg: Output) => boolean, refinementData: IssueData | ((arg: Output, ctx: RefinementCtx) => IssueData)): ZodEffects<this, Output, Input>
  _refinement(refinement: RefinementEffect<Output>['refinement']): ZodEffects<this, Output, Input>
  superRefine<RefinedOutput extends Output>(refinement: (arg: Output, ctx: RefinementCtx) => arg is RefinedOutput): ZodEffects<this, RefinedOutput, Input>
  superRefine(refinement: (arg: Output, ctx: RefinementCtx) => void): ZodEffects<this, Output, Input>
  superRefine(refinement: (arg: Output, ctx: RefinementCtx) => Promise<void>): ZodEffects<this, Output, Input>
  constructor(def: Def)
  optional(): ZodOptional<this>
  nullable(): ZodNullable<this>
  nullish(): ZodOptional<ZodNullable<this>>
  array(): ZodArray<this>
  promise(): ZodPromise<this>
  or<T extends ZodTypeAny>(option: T): ZodUnion<[this, T]>
  and<T extends ZodTypeAny>(incoming: T): ZodIntersection<this, T>
  transform<NewOut>(transform: (arg: Output, ctx: RefinementCtx) => NewOut | Promise<NewOut>): ZodEffects<this, NewOut>
  default(def: util.noUndefined<Input>): ZodDefault<this>
  default(def: () => util.noUndefined<Input>): ZodDefault<this>
  brand<B extends string | number | symbol>(brand?: B): ZodBranded<this, B>
  catch(def: Output): ZodCatch<this>
  catch(def: (ctx: { error: ZodError; input: Input }) => Output): ZodCatch<this>
  describe(description: string): this
  pipe<T extends ZodTypeAny>(target: T): ZodPipeline<this, T>
  readonly(): ZodReadonly<this>
  isOptional(): boolean
  isNullable(): boolean
}
type IpVersion = 'v4' | 'v6'
type ZodStringCheck =
  | {
      kind: 'min'
      value: number
      message?: string
    }
  | {
      kind: 'max'
      value: number
      message?: string
    }
  | {
      kind: 'length'
      value: number
      message?: string
    }
  | {
      kind: 'email'
      message?: string
    }
  | {
      kind: 'url'
      message?: string
    }
  | {
      kind: 'emoji'
      message?: string
    }
  | {
      kind: 'uuid'
      message?: string
    }
  | {
      kind: 'nanoid'
      message?: string
    }
  | {
      kind: 'cuid'
      message?: string
    }
  | {
      kind: 'includes'
      value: string
      position?: number
      message?: string
    }
  | {
      kind: 'cuid2'
      message?: string
    }
  | {
      kind: 'ulid'
      message?: string
    }
  | {
      kind: 'startsWith'
      value: string
      message?: string
    }
  | {
      kind: 'endsWith'
      value: string
      message?: string
    }
  | {
      kind: 'regex'
      regex: RegExp
      message?: string
    }
  | {
      kind: 'trim'
      message?: string
    }
  | {
      kind: 'toLowerCase'
      message?: string
    }
  | {
      kind: 'toUpperCase'
      message?: string
    }
  | {
      kind: 'datetime'
      offset: boolean
      local: boolean
      precision: number | null
      message?: string
    }
  | {
      kind: 'date'
      message?: string
    }
  | {
      kind: 'time'
      precision: number | null
      message?: string
    }
  | {
      kind: 'duration'
      message?: string
    }
  | {
      kind: 'ip'
      version?: IpVersion
      message?: string
    }
  | {
      kind: 'base64'
      message?: string
    }
interface ZodStringDef extends ZodTypeDef {
  checks: ZodStringCheck[]
  typeName: ZodFirstPartyTypeKind.ZodString
  coerce: boolean
}
declare function datetimeRegex(args: { precision?: number | null; offset?: boolean; local?: boolean }): RegExp
declare class ZodString extends ZodType<string, ZodStringDef, string> {
  _parse(input: ParseInput): ParseReturnType<string>
  protected _regex(regex: RegExp, validation: StringValidation, message?: errorUtil.ErrMessage): ZodEffects<this, string, string>
  _addCheck(check: ZodStringCheck): ZodString
  email(message?: errorUtil.ErrMessage): ZodString
  url(message?: errorUtil.ErrMessage): ZodString
  emoji(message?: errorUtil.ErrMessage): ZodString
  uuid(message?: errorUtil.ErrMessage): ZodString
  nanoid(message?: errorUtil.ErrMessage): ZodString
  cuid(message?: errorUtil.ErrMessage): ZodString
  cuid2(message?: errorUtil.ErrMessage): ZodString
  ulid(message?: errorUtil.ErrMessage): ZodString
  base64(message?: errorUtil.ErrMessage): ZodString
  ip(
    options?:
      | string
      | {
          version?: 'v4' | 'v6'
          message?: string
        }
  ): ZodString
  datetime(
    options?:
      | string
      | {
          message?: string | undefined
          precision?: number | null
          offset?: boolean
          local?: boolean
        }
  ): ZodString
  date(message?: string): ZodString
  time(
    options?:
      | string
      | {
          message?: string | undefined
          precision?: number | null
        }
  ): ZodString
  duration(message?: errorUtil.ErrMessage): ZodString
  regex(regex: RegExp, message?: errorUtil.ErrMessage): ZodString
  includes(
    value: string,
    options?: {
      message?: string
      position?: number
    }
  ): ZodString
  startsWith(value: string, message?: errorUtil.ErrMessage): ZodString
  endsWith(value: string, message?: errorUtil.ErrMessage): ZodString
  min(minLength: number, message?: errorUtil.ErrMessage): ZodString
  max(maxLength: number, message?: errorUtil.ErrMessage): ZodString
  length(len: number, message?: errorUtil.ErrMessage): ZodString
  /**
   * @deprecated Use z.string().min(1) instead.
   * @see {@link ZodString.min}
   */
  nonempty(message?: errorUtil.ErrMessage): ZodString
  trim(): ZodString
  toLowerCase(): ZodString
  toUpperCase(): ZodString
  get isDatetime(): boolean
  get isDate(): boolean
  get isTime(): boolean
  get isDuration(): boolean
  get isEmail(): boolean
  get isURL(): boolean
  get isEmoji(): boolean
  get isUUID(): boolean
  get isNANOID(): boolean
  get isCUID(): boolean
  get isCUID2(): boolean
  get isULID(): boolean
  get isIP(): boolean
  get isBase64(): boolean
  get minLength(): number | null
  get maxLength(): number | null
  static create: (
    params?: RawCreateParams & {
      coerce?: true
    }
  ) => ZodString
}
type ZodNumberCheck =
  | {
      kind: 'min'
      value: number
      inclusive: boolean
      message?: string
    }
  | {
      kind: 'max'
      value: number
      inclusive: boolean
      message?: string
    }
  | {
      kind: 'int'
      message?: string
    }
  | {
      kind: 'multipleOf'
      value: number
      message?: string
    }
  | {
      kind: 'finite'
      message?: string
    }
interface ZodNumberDef extends ZodTypeDef {
  checks: ZodNumberCheck[]
  typeName: ZodFirstPartyTypeKind.ZodNumber
  coerce: boolean
}
declare class ZodNumber extends ZodType<number, ZodNumberDef, number> {
  _parse(input: ParseInput): ParseReturnType<number>
  static create: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodNumber
  gte(value: number, message?: errorUtil.ErrMessage): ZodNumber
  min: (value: number, message?: errorUtil.ErrMessage) => ZodNumber
  gt(value: number, message?: errorUtil.ErrMessage): ZodNumber
  lte(value: number, message?: errorUtil.ErrMessage): ZodNumber
  max: (value: number, message?: errorUtil.ErrMessage) => ZodNumber
  lt(value: number, message?: errorUtil.ErrMessage): ZodNumber
  protected setLimit(kind: 'min' | 'max', value: number, inclusive: boolean, message?: string): ZodNumber
  _addCheck(check: ZodNumberCheck): ZodNumber
  int(message?: errorUtil.ErrMessage): ZodNumber
  positive(message?: errorUtil.ErrMessage): ZodNumber
  negative(message?: errorUtil.ErrMessage): ZodNumber
  nonpositive(message?: errorUtil.ErrMessage): ZodNumber
  nonnegative(message?: errorUtil.ErrMessage): ZodNumber
  multipleOf(value: number, message?: errorUtil.ErrMessage): ZodNumber
  step: (value: number, message?: errorUtil.ErrMessage) => ZodNumber
  finite(message?: errorUtil.ErrMessage): ZodNumber
  safe(message?: errorUtil.ErrMessage): ZodNumber
  get minValue(): number | null
  get maxValue(): number | null
  get isInt(): boolean
  get isFinite(): boolean
}
type ZodBigIntCheck =
  | {
      kind: 'min'
      value: bigint
      inclusive: boolean
      message?: string
    }
  | {
      kind: 'max'
      value: bigint
      inclusive: boolean
      message?: string
    }
  | {
      kind: 'multipleOf'
      value: bigint
      message?: string
    }
interface ZodBigIntDef extends ZodTypeDef {
  checks: ZodBigIntCheck[]
  typeName: ZodFirstPartyTypeKind.ZodBigInt
  coerce: boolean
}
declare class ZodBigInt extends ZodType<bigint, ZodBigIntDef, bigint> {
  _parse(input: ParseInput): ParseReturnType<bigint>
  static create: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodBigInt
  gte(value: bigint, message?: errorUtil.ErrMessage): ZodBigInt
  min: (value: bigint, message?: errorUtil.ErrMessage) => ZodBigInt
  gt(value: bigint, message?: errorUtil.ErrMessage): ZodBigInt
  lte(value: bigint, message?: errorUtil.ErrMessage): ZodBigInt
  max: (value: bigint, message?: errorUtil.ErrMessage) => ZodBigInt
  lt(value: bigint, message?: errorUtil.ErrMessage): ZodBigInt
  protected setLimit(kind: 'min' | 'max', value: bigint, inclusive: boolean, message?: string): ZodBigInt
  _addCheck(check: ZodBigIntCheck): ZodBigInt
  positive(message?: errorUtil.ErrMessage): ZodBigInt
  negative(message?: errorUtil.ErrMessage): ZodBigInt
  nonpositive(message?: errorUtil.ErrMessage): ZodBigInt
  nonnegative(message?: errorUtil.ErrMessage): ZodBigInt
  multipleOf(value: bigint, message?: errorUtil.ErrMessage): ZodBigInt
  get minValue(): bigint | null
  get maxValue(): bigint | null
}
interface ZodBooleanDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodBoolean
  coerce: boolean
}
declare class ZodBoolean extends ZodType<boolean, ZodBooleanDef, boolean> {
  _parse(input: ParseInput): ParseReturnType<boolean>
  static create: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodBoolean
}
type ZodDateCheck =
  | {
      kind: 'min'
      value: number
      message?: string
    }
  | {
      kind: 'max'
      value: number
      message?: string
    }
interface ZodDateDef extends ZodTypeDef {
  checks: ZodDateCheck[]
  coerce: boolean
  typeName: ZodFirstPartyTypeKind.ZodDate
}
declare class ZodDate extends ZodType<Date, ZodDateDef, Date> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  _addCheck(check: ZodDateCheck): ZodDate
  min(minDate: Date, message?: errorUtil.ErrMessage): ZodDate
  max(maxDate: Date, message?: errorUtil.ErrMessage): ZodDate
  get minDate(): Date | null
  get maxDate(): Date | null
  static create: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodDate
}
interface ZodSymbolDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodSymbol
}
declare class ZodSymbol extends ZodType<symbol, ZodSymbolDef, symbol> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: (params?: RawCreateParams) => ZodSymbol
}
interface ZodUndefinedDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodUndefined
}
declare class ZodUndefined extends ZodType<undefined, ZodUndefinedDef, undefined> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  params?: RawCreateParams
  static create: (params?: RawCreateParams) => ZodUndefined
}
interface ZodNullDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodNull
}
declare class ZodNull extends ZodType<null, ZodNullDef, null> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: (params?: RawCreateParams) => ZodNull
}
interface ZodAnyDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodAny
}
declare class ZodAny extends ZodType<any, ZodAnyDef, any> {
  _any: true
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: (params?: RawCreateParams) => ZodAny
}
interface ZodUnknownDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodUnknown
}
declare class ZodUnknown extends ZodType<unknown, ZodUnknownDef, unknown> {
  _unknown: true
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: (params?: RawCreateParams) => ZodUnknown
}
interface ZodNeverDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodNever
}
declare class ZodNever extends ZodType<never, ZodNeverDef, never> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: (params?: RawCreateParams) => ZodNever
}
interface ZodVoidDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodVoid
}
declare class ZodVoid extends ZodType<void, ZodVoidDef, void> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: (params?: RawCreateParams) => ZodVoid
}
interface ZodArrayDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  type: T
  typeName: ZodFirstPartyTypeKind.ZodArray
  exactLength: {
    value: number
    message?: string
  } | null
  minLength: {
    value: number
    message?: string
  } | null
  maxLength: {
    value: number
    message?: string
  } | null
}
type ArrayCardinality = 'many' | 'atleastone'
type arrayOutputType<T extends ZodTypeAny, Cardinality extends ArrayCardinality = 'many'> = Cardinality extends 'atleastone'
  ? [T['_output'], ...T['_output'][]]
  : T['_output'][]
declare class ZodArray<T extends ZodTypeAny, Cardinality extends ArrayCardinality = 'many'> extends ZodType<
  arrayOutputType<T, Cardinality>,
  ZodArrayDef<T>,
  Cardinality extends 'atleastone' ? [T['_input'], ...T['_input'][]] : T['_input'][]
> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get element(): T
  min(minLength: number, message?: errorUtil.ErrMessage): this
  max(maxLength: number, message?: errorUtil.ErrMessage): this
  length(len: number, message?: errorUtil.ErrMessage): this
  nonempty(message?: errorUtil.ErrMessage): ZodArray<T, 'atleastone'>
  static create: <T_1 extends ZodTypeAny>(schema: T_1, params?: RawCreateParams) => ZodArray<T_1>
}
type ZodNonEmptyArray<T extends ZodTypeAny> = ZodArray<T, 'atleastone'>
type UnknownKeysParam = 'passthrough' | 'strict' | 'strip'
interface ZodObjectDef<T extends ZodRawShape = ZodRawShape, UnknownKeys extends UnknownKeysParam = UnknownKeysParam, Catchall extends ZodTypeAny = ZodTypeAny>
  extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodObject
  shape: () => T
  catchall: Catchall
  unknownKeys: UnknownKeys
}
type mergeTypes<A, B> = {
  [k in keyof A | keyof B]: k extends keyof B ? B[k] : k extends keyof A ? A[k] : never
}
type objectOutputType<Shape extends ZodRawShape, Catchall extends ZodTypeAny, UnknownKeys extends UnknownKeysParam = UnknownKeysParam> = objectUtil.flatten<
  objectUtil.addQuestionMarks<baseObjectOutputType<Shape>>
> &
  CatchallOutput<Catchall> &
  PassthroughType<UnknownKeys>
type baseObjectOutputType<Shape extends ZodRawShape> = {
  [k in keyof Shape]: Shape[k]['_output']
}
type objectInputType<Shape extends ZodRawShape, Catchall extends ZodTypeAny, UnknownKeys extends UnknownKeysParam = UnknownKeysParam> = objectUtil.flatten<
  baseObjectInputType<Shape>
> &
  CatchallInput<Catchall> &
  PassthroughType<UnknownKeys>
type baseObjectInputType<Shape extends ZodRawShape> = objectUtil.addQuestionMarks<{
  [k in keyof Shape]: Shape[k]['_input']
}>
type CatchallOutput<T extends ZodType> = ZodType extends T
  ? unknown
  : {
      [k: string]: T['_output']
    }
type CatchallInput<T extends ZodType> = ZodType extends T
  ? unknown
  : {
      [k: string]: T['_input']
    }
type PassthroughType<T extends UnknownKeysParam> = T extends 'passthrough'
  ? {
      [k: string]: unknown
    }
  : unknown
type deoptional<T extends ZodTypeAny> = T extends ZodOptional<infer U> ? deoptional<U> : T extends ZodNullable<infer U> ? ZodNullable<deoptional<U>> : T
type SomeZodObject = ZodObject<ZodRawShape, UnknownKeysParam, ZodTypeAny>
type noUnrecognized<Obj extends object, Shape extends object> = {
  [k in keyof Obj]: k extends keyof Shape ? Obj[k] : never
}
declare class ZodObject<
  T extends ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny,
  Output = objectOutputType<T, Catchall, UnknownKeys>,
  Input = objectInputType<T, Catchall, UnknownKeys>
> extends ZodType<Output, ZodObjectDef<T, UnknownKeys, Catchall>, Input> {
  private _cached
  _getCached(): {
    shape: T
    keys: string[]
  }
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get shape(): T
  strict(message?: errorUtil.ErrMessage): ZodObject<T, 'strict', Catchall>
  strip(): ZodObject<T, 'strip', Catchall>
  passthrough(): ZodObject<T, 'passthrough', Catchall>
  /**
   * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
   * If you want to pass through unknown properties, use `.passthrough()` instead.
   */
  nonstrict: () => ZodObject<T, 'passthrough', Catchall>
  extend<Augmentation extends ZodRawShape>(augmentation: Augmentation): ZodObject<objectUtil.extendShape<T, Augmentation>, UnknownKeys, Catchall>
  /**
   * @deprecated Use `.extend` instead
   *  */
  augment: <Augmentation extends ZodRawShape>(augmentation: Augmentation) => ZodObject<objectUtil.extendShape<T, Augmentation>, UnknownKeys, Catchall>
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge<Incoming extends AnyZodObject, Augmentation extends Incoming['shape']>(
    merging: Incoming
  ): ZodObject<objectUtil.extendShape<T, Augmentation>, Incoming['_def']['unknownKeys'], Incoming['_def']['catchall']>
  setKey<Key extends string, Schema extends ZodTypeAny>(
    key: Key,
    schema: Schema
  ): ZodObject<
    T & {
      [k in Key]: Schema
    },
    UnknownKeys,
    Catchall
  >
  catchall<Index extends ZodTypeAny>(index: Index): ZodObject<T, UnknownKeys, Index>
  pick<
    Mask extends util.Exactly<
      {
        [k in keyof T]?: true
      },
      Mask
    >
  >(mask: Mask): ZodObject<Pick<T, Extract<keyof T, keyof Mask>>, UnknownKeys, Catchall>
  omit<
    Mask extends util.Exactly<
      {
        [k in keyof T]?: true
      },
      Mask
    >
  >(mask: Mask): ZodObject<Omit<T, keyof Mask>, UnknownKeys, Catchall>
  /**
   * @deprecated
   */
  deepPartial(): partialUtil.DeepPartial<this>
  partial(): ZodObject<
    {
      [k in keyof T]: ZodOptional<T[k]>
    },
    UnknownKeys,
    Catchall
  >
  partial<
    Mask extends util.Exactly<
      {
        [k in keyof T]?: true
      },
      Mask
    >
  >(
    mask: Mask
  ): ZodObject<
    objectUtil.noNever<{
      [k in keyof T]: k extends keyof Mask ? ZodOptional<T[k]> : T[k]
    }>,
    UnknownKeys,
    Catchall
  >
  required(): ZodObject<
    {
      [k in keyof T]: deoptional<T[k]>
    },
    UnknownKeys,
    Catchall
  >
  required<
    Mask extends util.Exactly<
      {
        [k in keyof T]?: true
      },
      Mask
    >
  >(
    mask: Mask
  ): ZodObject<
    objectUtil.noNever<{
      [k in keyof T]: k extends keyof Mask ? deoptional<T[k]> : T[k]
    }>,
    UnknownKeys,
    Catchall
  >
  keyof(): ZodEnum<enumUtil.UnionToTupleString<keyof T>>
  static create: <T_1 extends ZodRawShape>(
    shape: T_1,
    params?: RawCreateParams
  ) => ZodObject<T_1, 'strip', ZodTypeAny, objectOutputType<T_1, ZodTypeAny, 'strip'>, objectInputType<T_1, ZodTypeAny, 'strip'>>
  static strictCreate: <T_1 extends ZodRawShape>(shape: T_1, params?: RawCreateParams) => ZodObject<T_1, 'strict'>
  static lazycreate: <T_1 extends ZodRawShape>(shape: () => T_1, params?: RawCreateParams) => ZodObject<T_1, 'strip'>
}
type AnyZodObject = ZodObject<any, any, any>
type ZodUnionOptions = Readonly<[ZodTypeAny, ...ZodTypeAny[]]>
interface ZodUnionDef<T extends ZodUnionOptions = Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>> extends ZodTypeDef {
  options: T
  typeName: ZodFirstPartyTypeKind.ZodUnion
}
declare class ZodUnion<T extends ZodUnionOptions> extends ZodType<T[number]['_output'], ZodUnionDef<T>, T[number]['_input']> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get options(): T
  static create: <T_1 extends Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>>(types: T_1, params?: RawCreateParams) => ZodUnion<T_1>
}
type ZodDiscriminatedUnionOption<Discriminator extends string> = ZodObject<
  {
    [key in Discriminator]: ZodTypeAny
  } & ZodRawShape,
  UnknownKeysParam,
  ZodTypeAny
>
interface ZodDiscriminatedUnionDef<Discriminator extends string, Options extends ZodDiscriminatedUnionOption<string>[] = ZodDiscriminatedUnionOption<string>[]>
  extends ZodTypeDef {
  discriminator: Discriminator
  options: Options
  optionsMap: Map<Primitive, ZodDiscriminatedUnionOption<any>>
  typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion
}
declare class ZodDiscriminatedUnion<Discriminator extends string, Options extends ZodDiscriminatedUnionOption<Discriminator>[]> extends ZodType<
  output<Options[number]>,
  ZodDiscriminatedUnionDef<Discriminator, Options>,
  input<Options[number]>
> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get discriminator(): Discriminator
  get options(): Options
  get optionsMap(): Map<Primitive, ZodDiscriminatedUnionOption<any>>
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create<Discriminator extends string, Types extends [ZodDiscriminatedUnionOption<Discriminator>, ...ZodDiscriminatedUnionOption<Discriminator>[]]>(
    discriminator: Discriminator,
    options: Types,
    params?: RawCreateParams
  ): ZodDiscriminatedUnion<Discriminator, Types>
}
interface ZodIntersectionDef<T extends ZodTypeAny = ZodTypeAny, U extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  left: T
  right: U
  typeName: ZodFirstPartyTypeKind.ZodIntersection
}
declare class ZodIntersection<T extends ZodTypeAny, U extends ZodTypeAny> extends ZodType<
  T['_output'] & U['_output'],
  ZodIntersectionDef<T, U>,
  T['_input'] & U['_input']
> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: <T_1 extends ZodTypeAny, U_1 extends ZodTypeAny>(left: T_1, right: U_1, params?: RawCreateParams) => ZodIntersection<T_1, U_1>
}
type ZodTupleItems = [ZodTypeAny, ...ZodTypeAny[]]
type AssertArray<T> = T extends any[] ? T : never
type OutputTypeOfTuple<T extends ZodTupleItems | []> = AssertArray<{
  [k in keyof T]: T[k] extends ZodType<any, any, any> ? T[k]['_output'] : never
}>
type OutputTypeOfTupleWithRest<T extends ZodTupleItems | [], Rest extends ZodTypeAny | null = null> = Rest extends ZodTypeAny
  ? [...OutputTypeOfTuple<T>, ...Rest['_output'][]]
  : OutputTypeOfTuple<T>
type InputTypeOfTuple<T extends ZodTupleItems | []> = AssertArray<{
  [k in keyof T]: T[k] extends ZodType<any, any, any> ? T[k]['_input'] : never
}>
type InputTypeOfTupleWithRest<T extends ZodTupleItems | [], Rest extends ZodTypeAny | null = null> = Rest extends ZodTypeAny
  ? [...InputTypeOfTuple<T>, ...Rest['_input'][]]
  : InputTypeOfTuple<T>
interface ZodTupleDef<T extends ZodTupleItems | [] = ZodTupleItems, Rest extends ZodTypeAny | null = null> extends ZodTypeDef {
  items: T
  rest: Rest
  typeName: ZodFirstPartyTypeKind.ZodTuple
}
type AnyZodTuple = ZodTuple<[ZodTypeAny, ...ZodTypeAny[]] | [], ZodTypeAny | null>
declare class ZodTuple<T extends [ZodTypeAny, ...ZodTypeAny[]] | [] = [ZodTypeAny, ...ZodTypeAny[]], Rest extends ZodTypeAny | null = null> extends ZodType<
  OutputTypeOfTupleWithRest<T, Rest>,
  ZodTupleDef<T, Rest>,
  InputTypeOfTupleWithRest<T, Rest>
> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get items(): T
  rest<Rest extends ZodTypeAny>(rest: Rest): ZodTuple<T, Rest>
  static create: <T_1 extends [ZodTypeAny, ...ZodTypeAny[]] | []>(schemas: T_1, params?: RawCreateParams) => ZodTuple<T_1, null>
}
interface ZodRecordDef<Key extends KeySchema = ZodString, Value extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  valueType: Value
  keyType: Key
  typeName: ZodFirstPartyTypeKind.ZodRecord
}
type KeySchema = ZodType<string | number | symbol, any, any>
type RecordType<K extends string | number | symbol, V> = [string] extends [K]
  ? Record<K, V>
  : [number] extends [K]
    ? Record<K, V>
    : [symbol] extends [K]
      ? Record<K, V>
      : [BRAND<string | number | symbol>] extends [K]
        ? Record<K, V>
        : Partial<Record<K, V>>
declare class ZodRecord<Key extends KeySchema = ZodString, Value extends ZodTypeAny = ZodTypeAny> extends ZodType<
  RecordType<Key['_output'], Value['_output']>,
  ZodRecordDef<Key, Value>,
  RecordType<Key['_input'], Value['_input']>
> {
  get keySchema(): Key
  get valueSchema(): Value
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get element(): Value
  static create<Value extends ZodTypeAny>(valueType: Value, params?: RawCreateParams): ZodRecord<ZodString, Value>
  static create<Keys extends KeySchema, Value extends ZodTypeAny>(keySchema: Keys, valueType: Value, params?: RawCreateParams): ZodRecord<Keys, Value>
}
interface ZodMapDef<Key extends ZodTypeAny = ZodTypeAny, Value extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  valueType: Value
  keyType: Key
  typeName: ZodFirstPartyTypeKind.ZodMap
}
declare class ZodMap<Key extends ZodTypeAny = ZodTypeAny, Value extends ZodTypeAny = ZodTypeAny> extends ZodType<
  Map<Key['_output'], Value['_output']>,
  ZodMapDef<Key, Value>,
  Map<Key['_input'], Value['_input']>
> {
  get keySchema(): Key
  get valueSchema(): Value
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: <Key_1 extends ZodTypeAny = ZodTypeAny, Value_1 extends ZodTypeAny = ZodTypeAny>(
    keyType: Key_1,
    valueType: Value_1,
    params?: RawCreateParams
  ) => ZodMap<Key_1, Value_1>
}
interface ZodSetDef<Value extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  valueType: Value
  typeName: ZodFirstPartyTypeKind.ZodSet
  minSize: {
    value: number
    message?: string
  } | null
  maxSize: {
    value: number
    message?: string
  } | null
}
declare class ZodSet<Value extends ZodTypeAny = ZodTypeAny> extends ZodType<Set<Value['_output']>, ZodSetDef<Value>, Set<Value['_input']>> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  min(minSize: number, message?: errorUtil.ErrMessage): this
  max(maxSize: number, message?: errorUtil.ErrMessage): this
  size(size: number, message?: errorUtil.ErrMessage): this
  nonempty(message?: errorUtil.ErrMessage): ZodSet<Value>
  static create: <Value_1 extends ZodTypeAny = ZodTypeAny>(valueType: Value_1, params?: RawCreateParams) => ZodSet<Value_1>
}
interface ZodFunctionDef<Args extends ZodTuple<any, any> = ZodTuple<any, any>, Returns extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  args: Args
  returns: Returns
  typeName: ZodFirstPartyTypeKind.ZodFunction
}
type OuterTypeOfFunction<Args extends ZodTuple<any, any>, Returns extends ZodTypeAny> =
  Args['_input'] extends Array<any> ? (...args: Args['_input']) => Returns['_output'] : never
type InnerTypeOfFunction<Args extends ZodTuple<any, any>, Returns extends ZodTypeAny> =
  Args['_output'] extends Array<any> ? (...args: Args['_output']) => Returns['_input'] : never
declare class ZodFunction<Args extends ZodTuple<any, any>, Returns extends ZodTypeAny> extends ZodType<
  OuterTypeOfFunction<Args, Returns>,
  ZodFunctionDef<Args, Returns>,
  InnerTypeOfFunction<Args, Returns>
> {
  _parse(input: ParseInput): ParseReturnType<any>
  parameters(): Args
  returnType(): Returns
  args<Items extends Parameters<(typeof ZodTuple)['create']>[0]>(...items: Items): ZodFunction<ZodTuple<Items, ZodUnknown>, Returns>
  returns<NewReturnType extends ZodType<any, any, any>>(returnType: NewReturnType): ZodFunction<Args, NewReturnType>
  implement<F extends InnerTypeOfFunction<Args, Returns>>(
    func: F
  ): ReturnType<F> extends Returns['_output'] ? (...args: Args['_input']) => ReturnType<F> : OuterTypeOfFunction<Args, Returns>
  strictImplement(func: InnerTypeOfFunction<Args, Returns>): InnerTypeOfFunction<Args, Returns>
  validate: <F extends InnerTypeOfFunction<Args, Returns>>(
    func: F
  ) => ReturnType<F> extends Returns['_output'] ? (...args: Args['_input']) => ReturnType<F> : OuterTypeOfFunction<Args, Returns>
  static create(): ZodFunction<ZodTuple<[], ZodUnknown>, ZodUnknown>
  static create<T extends AnyZodTuple = ZodTuple<[], ZodUnknown>>(args: T): ZodFunction<T, ZodUnknown>
  static create<T extends AnyZodTuple, U extends ZodTypeAny>(args: T, returns: U): ZodFunction<T, U>
  static create<T extends AnyZodTuple = ZodTuple<[], ZodUnknown>, U extends ZodTypeAny = ZodUnknown>(
    args: T,
    returns: U,
    params?: RawCreateParams
  ): ZodFunction<T, U>
}
interface ZodLazyDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  getter: () => T
  typeName: ZodFirstPartyTypeKind.ZodLazy
}
declare class ZodLazy<T extends ZodTypeAny> extends ZodType<output<T>, ZodLazyDef<T>, input<T>> {
  get schema(): T
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: <T_1 extends ZodTypeAny>(getter: () => T_1, params?: RawCreateParams) => ZodLazy<T_1>
}
interface ZodLiteralDef<T = any> extends ZodTypeDef {
  value: T
  typeName: ZodFirstPartyTypeKind.ZodLiteral
}
declare class ZodLiteral<T> extends ZodType<T, ZodLiteralDef<T>, T> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get value(): T
  static create: <T_1 extends Primitive>(value: T_1, params?: RawCreateParams) => ZodLiteral<T_1>
}
type ArrayKeys = keyof any[]
type Indices<T> = Exclude<keyof T, ArrayKeys>
type EnumValues<T extends string = string> = readonly [T, ...T[]]
type Values<T extends EnumValues> = {
  [k in T[number]]: k
}
interface ZodEnumDef<T extends EnumValues = EnumValues> extends ZodTypeDef {
  values: T
  typeName: ZodFirstPartyTypeKind.ZodEnum
}
type Writeable<T> = {
  -readonly [P in keyof T]: T[P]
}
type FilterEnum<Values, ToExclude> = Values extends []
  ? []
  : Values extends [infer Head, ...infer Rest]
    ? Head extends ToExclude
      ? FilterEnum<Rest, ToExclude>
      : [Head, ...FilterEnum<Rest, ToExclude>]
    : never
type typecast<A, T> = A extends T ? A : never
declare function createZodEnum<U extends string, T extends Readonly<[U, ...U[]]>>(values: T, params?: RawCreateParams): ZodEnum<Writeable<T>>
declare function createZodEnum<U extends string, T extends [U, ...U[]]>(values: T, params?: RawCreateParams): ZodEnum<T>
declare class ZodEnum<T extends [string, ...string[]]> extends ZodType<T[number], ZodEnumDef<T>, T[number]> {
  #private
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  get options(): T
  get enum(): Values<T>
  get Values(): Values<T>
  get Enum(): Values<T>
  extract<ToExtract extends readonly [T[number], ...T[number][]]>(values: ToExtract, newDef?: RawCreateParams): ZodEnum<Writeable<ToExtract>>
  exclude<ToExclude extends readonly [T[number], ...T[number][]]>(
    values: ToExclude,
    newDef?: RawCreateParams
  ): ZodEnum<typecast<Writeable<FilterEnum<T, ToExclude[number]>>, [string, ...string[]]>>
  static create: typeof createZodEnum
}
interface ZodNativeEnumDef<T extends EnumLike = EnumLike> extends ZodTypeDef {
  values: T
  typeName: ZodFirstPartyTypeKind.ZodNativeEnum
}
type EnumLike = {
  [k: string]: string | number
  [nu: number]: string
}
declare class ZodNativeEnum<T extends EnumLike> extends ZodType<T[keyof T], ZodNativeEnumDef<T>, T[keyof T]> {
  #private
  _parse(input: ParseInput): ParseReturnType<T[keyof T]>
  get enum(): T
  static create: <T_1 extends EnumLike>(values: T_1, params?: RawCreateParams) => ZodNativeEnum<T_1>
}
interface ZodPromiseDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  type: T
  typeName: ZodFirstPartyTypeKind.ZodPromise
}
declare class ZodPromise<T extends ZodTypeAny> extends ZodType<Promise<T['_output']>, ZodPromiseDef<T>, Promise<T['_input']>> {
  unwrap(): T
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: <T_1 extends ZodTypeAny>(schema: T_1, params?: RawCreateParams) => ZodPromise<T_1>
}
type Refinement<T> = (arg: T, ctx: RefinementCtx) => any
type SuperRefinement<T> = (arg: T, ctx: RefinementCtx) => void | Promise<void>
type RefinementEffect<T> = {
  type: 'refinement'
  refinement: (arg: T, ctx: RefinementCtx) => any
}
type TransformEffect<T> = {
  type: 'transform'
  transform: (arg: T, ctx: RefinementCtx) => any
}
type PreprocessEffect<T> = {
  type: 'preprocess'
  transform: (arg: T, ctx: RefinementCtx) => any
}
type Effect<T> = RefinementEffect<T> | TransformEffect<T> | PreprocessEffect<T>
interface ZodEffectsDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  schema: T
  typeName: ZodFirstPartyTypeKind.ZodEffects
  effect: Effect<any>
}
declare class ZodEffects<T extends ZodTypeAny, Output = output<T>, Input = input<T>> extends ZodType<Output, ZodEffectsDef<T>, Input> {
  innerType(): T
  sourceType(): T
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: <I extends ZodTypeAny>(schema: I, effect: Effect<I['_output']>, params?: RawCreateParams) => ZodEffects<I, I['_output']>
  static createWithPreprocess: <I extends ZodTypeAny>(
    preprocess: (arg: unknown, ctx: RefinementCtx) => unknown,
    schema: I,
    params?: RawCreateParams
  ) => ZodEffects<I, I['_output'], unknown>
}

interface ZodOptionalDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  innerType: T
  typeName: ZodFirstPartyTypeKind.ZodOptional
}
type ZodOptionalType<T extends ZodTypeAny> = ZodOptional<T>
declare class ZodOptional<T extends ZodTypeAny> extends ZodType<T['_output'] | undefined, ZodOptionalDef<T>, T['_input'] | undefined> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  unwrap(): T
  static create: <T_1 extends ZodTypeAny>(type: T_1, params?: RawCreateParams) => ZodOptional<T_1>
}
interface ZodNullableDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  innerType: T
  typeName: ZodFirstPartyTypeKind.ZodNullable
}
type ZodNullableType<T extends ZodTypeAny> = ZodNullable<T>
declare class ZodNullable<T extends ZodTypeAny> extends ZodType<T['_output'] | null, ZodNullableDef<T>, T['_input'] | null> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  unwrap(): T
  static create: <T_1 extends ZodTypeAny>(type: T_1, params?: RawCreateParams) => ZodNullable<T_1>
}
interface ZodDefaultDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  innerType: T
  defaultValue: () => util.noUndefined<T['_input']>
  typeName: ZodFirstPartyTypeKind.ZodDefault
}
declare class ZodDefault<T extends ZodTypeAny> extends ZodType<util.noUndefined<T['_output']>, ZodDefaultDef<T>, T['_input'] | undefined> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  removeDefault(): T
  static create: <T_1 extends ZodTypeAny>(
    type: T_1,
    params: RawCreateParams & {
      default: T_1['_input'] | (() => util.noUndefined<T_1['_input']>)
    }
  ) => ZodDefault<T_1>
}
interface ZodCatchDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  innerType: T
  catchValue: (ctx: { error: ZodError; input: unknown }) => T['_input']
  typeName: ZodFirstPartyTypeKind.ZodCatch
}
declare class ZodCatch<T extends ZodTypeAny> extends ZodType<T['_output'], ZodCatchDef<T>, unknown> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  removeCatch(): T
  static create: <T_1 extends ZodTypeAny>(
    type: T_1,
    params: RawCreateParams & {
      catch: T_1['_output'] | (() => T_1['_output'])
    }
  ) => ZodCatch<T_1>
}
interface ZodNaNDef extends ZodTypeDef {
  typeName: ZodFirstPartyTypeKind.ZodNaN
}
declare class ZodNaN extends ZodType<number, ZodNaNDef, number> {
  _parse(input: ParseInput): ParseReturnType<any>
  static create: (params?: RawCreateParams) => ZodNaN
}
interface ZodBrandedDef<T extends ZodTypeAny> extends ZodTypeDef {
  type: T
  typeName: ZodFirstPartyTypeKind.ZodBranded
}
declare const BRAND: unique symbol
type BRAND<T extends string | number | symbol> = {
  [BRAND]: {
    [k in T]: true
  }
}
declare class ZodBranded<T extends ZodTypeAny, B extends string | number | symbol> extends ZodType<T['_output'] & BRAND<B>, ZodBrandedDef<T>, T['_input']> {
  _parse(input: ParseInput): ParseReturnType<any>
  unwrap(): T
}
interface ZodPipelineDef<A extends ZodTypeAny, B extends ZodTypeAny> extends ZodTypeDef {
  in: A
  out: B
  typeName: ZodFirstPartyTypeKind.ZodPipeline
}
declare class ZodPipeline<A extends ZodTypeAny, B extends ZodTypeAny> extends ZodType<B['_output'], ZodPipelineDef<A, B>, A['_input']> {
  _parse(input: ParseInput): ParseReturnType<any>
  static create<A extends ZodTypeAny, B extends ZodTypeAny>(a: A, b: B): ZodPipeline<A, B>
}
type BuiltIn =
  | (((...args: any[]) => any) | (new (...args: any[]) => any))
  | {
      readonly [Symbol.toStringTag]: string
    }
  | Date
  | Error
  | Generator
  | Promise<unknown>
  | RegExp
type MakeReadonly<T> =
  T extends Map<infer K, infer V>
    ? ReadonlyMap<K, V>
    : T extends Set<infer V>
      ? ReadonlySet<V>
      : T extends [infer Head, ...infer Tail]
        ? readonly [Head, ...Tail]
        : T extends Array<infer V>
          ? ReadonlyArray<V>
          : T extends BuiltIn
            ? T
            : Readonly<T>
interface ZodReadonlyDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
  innerType: T
  typeName: ZodFirstPartyTypeKind.ZodReadonly
}
declare class ZodReadonly<T extends ZodTypeAny> extends ZodType<MakeReadonly<T['_output']>, ZodReadonlyDef<T>, MakeReadonly<T['_input']>> {
  _parse(input: ParseInput): ParseReturnType<this['_output']>
  static create: <T_1 extends ZodTypeAny>(type: T_1, params?: RawCreateParams) => ZodReadonly<T_1>
  unwrap(): T
}
type CustomParams = CustomErrorParams & {
  fatal?: boolean
}
declare function custom<T>(
  check?: (data: any) => any,
  params?: string | CustomParams | ((input: any) => CustomParams),
  /**
   * @deprecated
   *
   * Pass `fatal` into the params object instead:
   *
   * ```ts
   * z.string().custom((val) => val.length > 5, { fatal: false })
   * ```
   *
   */
  fatal?: boolean
): ZodType<T, ZodTypeDef, T>

declare const late: {
  object: <T extends ZodRawShape>(shape: () => T, params?: RawCreateParams) => ZodObject<T, 'strip'>
}
declare enum ZodFirstPartyTypeKind {
  ZodString = 'ZodString',
  ZodNumber = 'ZodNumber',
  ZodNaN = 'ZodNaN',
  ZodBigInt = 'ZodBigInt',
  ZodBoolean = 'ZodBoolean',
  ZodDate = 'ZodDate',
  ZodSymbol = 'ZodSymbol',
  ZodUndefined = 'ZodUndefined',
  ZodNull = 'ZodNull',
  ZodAny = 'ZodAny',
  ZodUnknown = 'ZodUnknown',
  ZodNever = 'ZodNever',
  ZodVoid = 'ZodVoid',
  ZodArray = 'ZodArray',
  ZodObject = 'ZodObject',
  ZodUnion = 'ZodUnion',
  ZodDiscriminatedUnion = 'ZodDiscriminatedUnion',
  ZodIntersection = 'ZodIntersection',
  ZodTuple = 'ZodTuple',
  ZodRecord = 'ZodRecord',
  ZodMap = 'ZodMap',
  ZodSet = 'ZodSet',
  ZodFunction = 'ZodFunction',
  ZodLazy = 'ZodLazy',
  ZodLiteral = 'ZodLiteral',
  ZodEnum = 'ZodEnum',
  ZodEffects = 'ZodEffects',
  ZodNativeEnum = 'ZodNativeEnum',
  ZodOptional = 'ZodOptional',
  ZodNullable = 'ZodNullable',
  ZodDefault = 'ZodDefault',
  ZodCatch = 'ZodCatch',
  ZodPromise = 'ZodPromise',
  ZodBranded = 'ZodBranded',
  ZodPipeline = 'ZodPipeline',
  ZodReadonly = 'ZodReadonly'
}
type ZodFirstPartySchemaTypes =
  | ZodString
  | ZodNumber
  | ZodNaN
  | ZodBigInt
  | ZodBoolean
  | ZodDate
  | ZodUndefined
  | ZodNull
  | ZodAny
  | ZodUnknown
  | ZodNever
  | ZodVoid
  | ZodArray<any, any>
  | ZodObject<any, any, any>
  | ZodUnion<any>
  | ZodDiscriminatedUnion<any, any>
  | ZodIntersection<any, any>
  | ZodTuple<any, any>
  | ZodRecord<any, any>
  | ZodMap<any>
  | ZodSet<any>
  | ZodFunction<any, any>
  | ZodLazy<any>
  | ZodLiteral<any>
  | ZodEnum<any>
  | ZodEffects<any, any, any>
  | ZodNativeEnum<any>
  | ZodOptional<any>
  | ZodNullable<any>
  | ZodDefault<any>
  | ZodCatch<any>
  | ZodPromise<any>
  | ZodBranded<any, any>
  | ZodPipeline<any, any>
  | ZodReadonly<any>
  | ZodSymbol
declare abstract class Class {
  constructor(..._: any[])
}
declare const instanceOfType: <T extends typeof Class>(cls: T, params?: CustomParams) => ZodType<InstanceType<T>, ZodTypeDef, InstanceType<T>>
declare const stringType: (
  params?: RawCreateParams & {
    coerce?: true
  }
) => ZodString
declare const numberType: (
  params?: RawCreateParams & {
    coerce?: boolean
  }
) => ZodNumber
declare const nanType: (params?: RawCreateParams) => ZodNaN
declare const bigIntType: (
  params?: RawCreateParams & {
    coerce?: boolean
  }
) => ZodBigInt
declare const booleanType: (
  params?: RawCreateParams & {
    coerce?: boolean
  }
) => ZodBoolean
declare const dateType: (
  params?: RawCreateParams & {
    coerce?: boolean
  }
) => ZodDate
declare const symbolType: (params?: RawCreateParams) => ZodSymbol
declare const undefinedType: (params?: RawCreateParams) => ZodUndefined
declare const nullType: (params?: RawCreateParams) => ZodNull
declare const anyType: (params?: RawCreateParams) => ZodAny
declare const unknownType: (params?: RawCreateParams) => ZodUnknown
declare const neverType: (params?: RawCreateParams) => ZodNever
declare const voidType: (params?: RawCreateParams) => ZodVoid
declare const arrayType: <T extends ZodTypeAny>(schema: T, params?: RawCreateParams) => ZodArray<T>
declare const objectType: <T extends ZodRawShape>(
  shape: T,
  params?: RawCreateParams
) => ZodObject<T, 'strip', ZodTypeAny, objectOutputType<T, ZodTypeAny, 'strip'>, objectInputType<T, ZodTypeAny, 'strip'>>
declare const strictObjectType: <T extends ZodRawShape>(shape: T, params?: RawCreateParams) => ZodObject<T, 'strict'>
declare const unionType: <T extends Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>>(types: T, params?: RawCreateParams) => ZodUnion<T>
declare const discriminatedUnionType: typeof ZodDiscriminatedUnion.create
declare const intersectionType: <T extends ZodTypeAny, U extends ZodTypeAny>(left: T, right: U, params?: RawCreateParams) => ZodIntersection<T, U>
declare const tupleType: <T extends [ZodTypeAny, ...ZodTypeAny[]] | []>(schemas: T, params?: RawCreateParams) => ZodTuple<T, null>
declare const recordType: typeof ZodRecord.create
declare const mapType: <Key extends ZodTypeAny = ZodTypeAny, Value extends ZodTypeAny = ZodTypeAny>(
  keyType: Key,
  valueType: Value,
  params?: RawCreateParams
) => ZodMap<Key, Value>
declare const setType: <Value extends ZodTypeAny = ZodTypeAny>(valueType: Value, params?: RawCreateParams) => ZodSet<Value>
declare const functionType: typeof ZodFunction.create
declare const lazyType: <T extends ZodTypeAny>(getter: () => T, params?: RawCreateParams) => ZodLazy<T>
declare const literalType: <T extends Primitive>(value: T, params?: RawCreateParams) => ZodLiteral<T>
declare const enumType: typeof createZodEnum
declare const nativeEnumType: <T extends EnumLike>(values: T, params?: RawCreateParams) => ZodNativeEnum<T>
declare const promiseType: <T extends ZodTypeAny>(schema: T, params?: RawCreateParams) => ZodPromise<T>
declare const effectsType: <I extends ZodTypeAny>(schema: I, effect: Effect<I['_output']>, params?: RawCreateParams) => ZodEffects<I, I['_output']>
declare const optionalType: <T extends ZodTypeAny>(type: T, params?: RawCreateParams) => ZodOptional<T>
declare const nullableType: <T extends ZodTypeAny>(type: T, params?: RawCreateParams) => ZodNullable<T>
declare const preprocessType: <I extends ZodTypeAny>(
  preprocess: (arg: unknown, ctx: RefinementCtx) => unknown,
  schema: I,
  params?: RawCreateParams
) => ZodEffects<I, I['_output'], unknown>
declare const pipelineType: typeof ZodPipeline.create
declare const ostring: () => ZodOptional<ZodString>
declare const onumber: () => ZodOptional<ZodNumber>
declare const oboolean: () => ZodOptional<ZodBoolean>
declare const coerce: {
  string: (typeof ZodString)['create']
  number: (typeof ZodNumber)['create']
  boolean: (typeof ZodBoolean)['create']
  bigint: (typeof ZodBigInt)['create']
  date: (typeof ZodDate)['create']
}

declare const NEVER: never

type index_AnyZodObject = AnyZodObject
type index_AnyZodTuple = AnyZodTuple
type index_ArrayCardinality = ArrayCardinality
type index_ArrayKeys = ArrayKeys
type index_AssertArray<T> = AssertArray<T>
type index_AsyncParseReturnType<T> = AsyncParseReturnType<T>
type index_BRAND<T extends string | number | symbol> = BRAND<T>
type index_CatchallInput<T extends ZodType> = CatchallInput<T>
type index_CatchallOutput<T extends ZodType> = CatchallOutput<T>
type index_CustomErrorParams = CustomErrorParams
declare const index_DIRTY: typeof DIRTY
type index_DenormalizedError = DenormalizedError
declare const index_EMPTY_PATH: typeof EMPTY_PATH
type index_Effect<T> = Effect<T>
type index_EnumLike = EnumLike
type index_EnumValues<T extends string = string> = EnumValues<T>
type index_ErrorMapCtx = ErrorMapCtx
type index_FilterEnum<Values, ToExclude> = FilterEnum<Values, ToExclude>
declare const index_INVALID: typeof INVALID
type index_Indices<T> = Indices<T>
type index_InnerTypeOfFunction<Args extends ZodTuple<any, any>, Returns extends ZodTypeAny> = InnerTypeOfFunction<Args, Returns>
type index_InputTypeOfTuple<T extends ZodTupleItems | []> = InputTypeOfTuple<T>
type index_InputTypeOfTupleWithRest<T extends ZodTupleItems | [], Rest extends ZodTypeAny | null = null> = InputTypeOfTupleWithRest<T, Rest>
type index_IpVersion = IpVersion
type index_IssueData = IssueData
type index_KeySchema = KeySchema
declare const index_NEVER: typeof NEVER
declare const index_OK: typeof OK
type index_ObjectPair = ObjectPair
type index_OuterTypeOfFunction<Args extends ZodTuple<any, any>, Returns extends ZodTypeAny> = OuterTypeOfFunction<Args, Returns>
type index_OutputTypeOfTuple<T extends ZodTupleItems | []> = OutputTypeOfTuple<T>
type index_OutputTypeOfTupleWithRest<T extends ZodTupleItems | [], Rest extends ZodTypeAny | null = null> = OutputTypeOfTupleWithRest<T, Rest>
type index_ParseContext = ParseContext
type index_ParseInput = ParseInput
type index_ParseParams = ParseParams
type index_ParsePath = ParsePath
type index_ParsePathComponent = ParsePathComponent
type index_ParseResult = ParseResult
type index_ParseReturnType<T> = ParseReturnType<T>
type index_ParseStatus = ParseStatus
declare const index_ParseStatus: typeof ParseStatus
type index_PassthroughType<T extends UnknownKeysParam> = PassthroughType<T>
type index_PreprocessEffect<T> = PreprocessEffect<T>
type index_Primitive = Primitive
type index_ProcessedCreateParams = ProcessedCreateParams
type index_RawCreateParams = RawCreateParams
type index_RecordType<K extends string | number | symbol, V> = RecordType<K, V>
type index_Refinement<T> = Refinement<T>
type index_RefinementCtx = RefinementCtx
type index_RefinementEffect<T> = RefinementEffect<T>
type index_SafeParseError<Input> = SafeParseError<Input>
type index_SafeParseReturnType<Input, Output> = SafeParseReturnType<Input, Output>
type index_SafeParseSuccess<Output> = SafeParseSuccess<Output>
type index_Scalars = Scalars
type index_SomeZodObject = SomeZodObject
type index_StringValidation = StringValidation
type index_SuperRefinement<T> = SuperRefinement<T>
type index_SyncParseReturnType<T = any> = SyncParseReturnType<T>
type index_TransformEffect<T> = TransformEffect<T>
type index_TypeOf<T extends ZodType<any, any, any>> = TypeOf<T>
type index_UnknownKeysParam = UnknownKeysParam
type index_Values<T extends EnumValues> = Values<T>
type index_Writeable<T> = Writeable<T>
type index_ZodAny = ZodAny
declare const index_ZodAny: typeof ZodAny
type index_ZodAnyDef = ZodAnyDef
type index_ZodArray<T extends ZodTypeAny, Cardinality extends ArrayCardinality = 'many'> = ZodArray<T, Cardinality>
declare const index_ZodArray: typeof ZodArray
type index_ZodArrayDef<T extends ZodTypeAny = ZodTypeAny> = ZodArrayDef<T>
type index_ZodBigInt = ZodBigInt
declare const index_ZodBigInt: typeof ZodBigInt
type index_ZodBigIntCheck = ZodBigIntCheck
type index_ZodBigIntDef = ZodBigIntDef
type index_ZodBoolean = ZodBoolean
declare const index_ZodBoolean: typeof ZodBoolean
type index_ZodBooleanDef = ZodBooleanDef
type index_ZodBranded<T extends ZodTypeAny, B extends string | number | symbol> = ZodBranded<T, B>
declare const index_ZodBranded: typeof ZodBranded
type index_ZodBrandedDef<T extends ZodTypeAny> = ZodBrandedDef<T>
type index_ZodCatch<T extends ZodTypeAny> = ZodCatch<T>
declare const index_ZodCatch: typeof ZodCatch
type index_ZodCatchDef<T extends ZodTypeAny = ZodTypeAny> = ZodCatchDef<T>
type index_ZodCustomIssue = ZodCustomIssue
type index_ZodDate = ZodDate
declare const index_ZodDate: typeof ZodDate
type index_ZodDateCheck = ZodDateCheck
type index_ZodDateDef = ZodDateDef
type index_ZodDefault<T extends ZodTypeAny> = ZodDefault<T>
declare const index_ZodDefault: typeof ZodDefault
type index_ZodDefaultDef<T extends ZodTypeAny = ZodTypeAny> = ZodDefaultDef<T>
type index_ZodDiscriminatedUnion<Discriminator extends string, Options extends ZodDiscriminatedUnionOption<Discriminator>[]> = ZodDiscriminatedUnion<
  Discriminator,
  Options
>
declare const index_ZodDiscriminatedUnion: typeof ZodDiscriminatedUnion
type index_ZodDiscriminatedUnionDef<
  Discriminator extends string,
  Options extends ZodDiscriminatedUnionOption<string>[] = ZodDiscriminatedUnionOption<string>[]
> = ZodDiscriminatedUnionDef<Discriminator, Options>
type index_ZodDiscriminatedUnionOption<Discriminator extends string> = ZodDiscriminatedUnionOption<Discriminator>
type index_ZodEffects<T extends ZodTypeAny, Output = output<T>, Input = input<T>> = ZodEffects<T, Output, Input>
declare const index_ZodEffects: typeof ZodEffects
type index_ZodEffectsDef<T extends ZodTypeAny = ZodTypeAny> = ZodEffectsDef<T>
type index_ZodEnum<T extends [string, ...string[]]> = ZodEnum<T>
declare const index_ZodEnum: typeof ZodEnum
type index_ZodEnumDef<T extends EnumValues = EnumValues> = ZodEnumDef<T>
type index_ZodError<T = any> = ZodError<T>
declare const index_ZodError: typeof ZodError
type index_ZodErrorMap = ZodErrorMap
type index_ZodFirstPartySchemaTypes = ZodFirstPartySchemaTypes
type index_ZodFirstPartyTypeKind = ZodFirstPartyTypeKind
declare const index_ZodFirstPartyTypeKind: typeof ZodFirstPartyTypeKind
type index_ZodFormattedError<T, U = string> = ZodFormattedError<T, U>
type index_ZodFunction<Args extends ZodTuple<any, any>, Returns extends ZodTypeAny> = ZodFunction<Args, Returns>
declare const index_ZodFunction: typeof ZodFunction
type index_ZodFunctionDef<Args extends ZodTuple<any, any> = ZodTuple<any, any>, Returns extends ZodTypeAny = ZodTypeAny> = ZodFunctionDef<Args, Returns>
type index_ZodIntersection<T extends ZodTypeAny, U extends ZodTypeAny> = ZodIntersection<T, U>
declare const index_ZodIntersection: typeof ZodIntersection
type index_ZodIntersectionDef<T extends ZodTypeAny = ZodTypeAny, U extends ZodTypeAny = ZodTypeAny> = ZodIntersectionDef<T, U>
type index_ZodInvalidArgumentsIssue = ZodInvalidArgumentsIssue
type index_ZodInvalidDateIssue = ZodInvalidDateIssue
type index_ZodInvalidEnumValueIssue = ZodInvalidEnumValueIssue
type index_ZodInvalidIntersectionTypesIssue = ZodInvalidIntersectionTypesIssue
type index_ZodInvalidLiteralIssue = ZodInvalidLiteralIssue
type index_ZodInvalidReturnTypeIssue = ZodInvalidReturnTypeIssue
type index_ZodInvalidStringIssue = ZodInvalidStringIssue
type index_ZodInvalidTypeIssue = ZodInvalidTypeIssue
type index_ZodInvalidUnionDiscriminatorIssue = ZodInvalidUnionDiscriminatorIssue
type index_ZodInvalidUnionIssue = ZodInvalidUnionIssue
type index_ZodIssue = ZodIssue
type index_ZodIssueBase = ZodIssueBase
type index_ZodIssueCode = ZodIssueCode
type index_ZodIssueOptionalMessage = ZodIssueOptionalMessage
type index_ZodLazy<T extends ZodTypeAny> = ZodLazy<T>
declare const index_ZodLazy: typeof ZodLazy
type index_ZodLazyDef<T extends ZodTypeAny = ZodTypeAny> = ZodLazyDef<T>
type index_ZodLiteral<T> = ZodLiteral<T>
declare const index_ZodLiteral: typeof ZodLiteral
type index_ZodLiteralDef<T = any> = ZodLiteralDef<T>
type index_ZodMap<Key extends ZodTypeAny = ZodTypeAny, Value extends ZodTypeAny = ZodTypeAny> = ZodMap<Key, Value>
declare const index_ZodMap: typeof ZodMap
type index_ZodMapDef<Key extends ZodTypeAny = ZodTypeAny, Value extends ZodTypeAny = ZodTypeAny> = ZodMapDef<Key, Value>
type index_ZodMeta = ZodMeta
type index_ZodNaN = ZodNaN
declare const index_ZodNaN: typeof ZodNaN
type index_ZodNaNDef = ZodNaNDef
type index_ZodNativeEnum<T extends EnumLike> = ZodNativeEnum<T>
declare const index_ZodNativeEnum: typeof ZodNativeEnum
type index_ZodNativeEnumDef<T extends EnumLike = EnumLike> = ZodNativeEnumDef<T>
type index_ZodNever = ZodNever
declare const index_ZodNever: typeof ZodNever
type index_ZodNeverDef = ZodNeverDef
type index_ZodNonEmptyArray<T extends ZodTypeAny> = ZodNonEmptyArray<T>
type index_ZodNotFiniteIssue = ZodNotFiniteIssue
type index_ZodNotMultipleOfIssue = ZodNotMultipleOfIssue
type index_ZodNull = ZodNull
declare const index_ZodNull: typeof ZodNull
type index_ZodNullDef = ZodNullDef
type index_ZodNullable<T extends ZodTypeAny> = ZodNullable<T>
declare const index_ZodNullable: typeof ZodNullable
type index_ZodNullableDef<T extends ZodTypeAny = ZodTypeAny> = ZodNullableDef<T>
type index_ZodNullableType<T extends ZodTypeAny> = ZodNullableType<T>
type index_ZodNumber = ZodNumber
declare const index_ZodNumber: typeof ZodNumber
type index_ZodNumberCheck = ZodNumberCheck
type index_ZodNumberDef = ZodNumberDef
type index_ZodObject<
  T extends ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny,
  Output = objectOutputType<T, Catchall, UnknownKeys>,
  Input = objectInputType<T, Catchall, UnknownKeys>
> = ZodObject<T, UnknownKeys, Catchall, Output, Input>
declare const index_ZodObject: typeof ZodObject
type index_ZodObjectDef<
  T extends ZodRawShape = ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny
> = ZodObjectDef<T, UnknownKeys, Catchall>
type index_ZodOptional<T extends ZodTypeAny> = ZodOptional<T>
declare const index_ZodOptional: typeof ZodOptional
type index_ZodOptionalDef<T extends ZodTypeAny = ZodTypeAny> = ZodOptionalDef<T>
type index_ZodOptionalType<T extends ZodTypeAny> = ZodOptionalType<T>
type index_ZodParsedType = ZodParsedType
type index_ZodPipeline<A extends ZodTypeAny, B extends ZodTypeAny> = ZodPipeline<A, B>
declare const index_ZodPipeline: typeof ZodPipeline
type index_ZodPipelineDef<A extends ZodTypeAny, B extends ZodTypeAny> = ZodPipelineDef<A, B>
type index_ZodPromise<T extends ZodTypeAny> = ZodPromise<T>
declare const index_ZodPromise: typeof ZodPromise
type index_ZodPromiseDef<T extends ZodTypeAny = ZodTypeAny> = ZodPromiseDef<T>
type index_ZodRawShape = ZodRawShape
type index_ZodReadonly<T extends ZodTypeAny> = ZodReadonly<T>
declare const index_ZodReadonly: typeof ZodReadonly
type index_ZodReadonlyDef<T extends ZodTypeAny = ZodTypeAny> = ZodReadonlyDef<T>
type index_ZodRecord<Key extends KeySchema = ZodString, Value extends ZodTypeAny = ZodTypeAny> = ZodRecord<Key, Value>
declare const index_ZodRecord: typeof ZodRecord
type index_ZodRecordDef<Key extends KeySchema = ZodString, Value extends ZodTypeAny = ZodTypeAny> = ZodRecordDef<Key, Value>
type index_ZodSet<Value extends ZodTypeAny = ZodTypeAny> = ZodSet<Value>
declare const index_ZodSet: typeof ZodSet
type index_ZodSetDef<Value extends ZodTypeAny = ZodTypeAny> = ZodSetDef<Value>
type index_ZodString = ZodString
declare const index_ZodString: typeof ZodString
type index_ZodStringCheck = ZodStringCheck
type index_ZodStringDef = ZodStringDef
type index_ZodSymbol = ZodSymbol
declare const index_ZodSymbol: typeof ZodSymbol
type index_ZodSymbolDef = ZodSymbolDef
type index_ZodTooBigIssue = ZodTooBigIssue
type index_ZodTooSmallIssue = ZodTooSmallIssue
type index_ZodTuple<T extends [ZodTypeAny, ...ZodTypeAny[]] | [] = [ZodTypeAny, ...ZodTypeAny[]], Rest extends ZodTypeAny | null = null> = ZodTuple<T, Rest>
declare const index_ZodTuple: typeof ZodTuple
type index_ZodTupleDef<T extends ZodTupleItems | [] = ZodTupleItems, Rest extends ZodTypeAny | null = null> = ZodTupleDef<T, Rest>
type index_ZodTupleItems = ZodTupleItems
type index_ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> = ZodType<Output, Def, Input>
declare const index_ZodType: typeof ZodType
type index_ZodTypeAny = ZodTypeAny
type index_ZodTypeDef = ZodTypeDef
type index_ZodUndefined = ZodUndefined
declare const index_ZodUndefined: typeof ZodUndefined
type index_ZodUndefinedDef = ZodUndefinedDef
type index_ZodUnion<T extends ZodUnionOptions> = ZodUnion<T>
declare const index_ZodUnion: typeof ZodUnion
type index_ZodUnionDef<T extends ZodUnionOptions = Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>> = ZodUnionDef<T>
type index_ZodUnionOptions = ZodUnionOptions
type index_ZodUnknown = ZodUnknown
declare const index_ZodUnknown: typeof ZodUnknown
type index_ZodUnknownDef = ZodUnknownDef
type index_ZodUnrecognizedKeysIssue = ZodUnrecognizedKeysIssue
type index_ZodVoid = ZodVoid
declare const index_ZodVoid: typeof ZodVoid
type index_ZodVoidDef = ZodVoidDef
declare const index_addIssueToContext: typeof addIssueToContext
type index_arrayOutputType<T extends ZodTypeAny, Cardinality extends ArrayCardinality = 'many'> = arrayOutputType<T, Cardinality>
type index_baseObjectInputType<Shape extends ZodRawShape> = baseObjectInputType<Shape>
type index_baseObjectOutputType<Shape extends ZodRawShape> = baseObjectOutputType<Shape>
declare const index_coerce: typeof coerce
declare const index_custom: typeof custom
declare const index_datetimeRegex: typeof datetimeRegex
type index_deoptional<T extends ZodTypeAny> = deoptional<T>
declare const index_getErrorMap: typeof getErrorMap
declare const index_getParsedType: typeof getParsedType
type index_inferFlattenedErrors<T extends ZodType<any, any, any>, U = string> = inferFlattenedErrors<T, U>
type index_inferFormattedError<T extends ZodType<any, any, any>, U = string> = inferFormattedError<T, U>
type index_input<T extends ZodType<any, any, any>> = input<T>
declare const index_isAborted: typeof isAborted
declare const index_isAsync: typeof isAsync
declare const index_isDirty: typeof isDirty
declare const index_isValid: typeof isValid
declare const index_late: typeof late
declare const index_makeIssue: typeof makeIssue
type index_mergeTypes<A, B> = mergeTypes<A, B>
type index_noUnrecognized<Obj extends object, Shape extends object> = noUnrecognized<Obj, Shape>
type index_objectInputType<Shape extends ZodRawShape, Catchall extends ZodTypeAny, UnknownKeys extends UnknownKeysParam = UnknownKeysParam> = objectInputType<
  Shape,
  Catchall,
  UnknownKeys
>
type index_objectOutputType<Shape extends ZodRawShape, Catchall extends ZodTypeAny, UnknownKeys extends UnknownKeysParam = UnknownKeysParam> = objectOutputType<
  Shape,
  Catchall,
  UnknownKeys
>
declare const index_objectUtil: typeof objectUtil
declare const index_oboolean: typeof oboolean
declare const index_onumber: typeof onumber
declare const index_ostring: typeof ostring
type index_output<T extends ZodType<any, any, any>> = output<T>
declare const index_quotelessJson: typeof quotelessJson
declare const index_setErrorMap: typeof setErrorMap
type index_typeToFlattenedError<T, U = string> = typeToFlattenedError<T, U>
type index_typecast<A, T> = typecast<A, T>
declare const index_util: typeof util
declare namespace index {
  export {
    type index_AnyZodObject as AnyZodObject,
    type index_AnyZodTuple as AnyZodTuple,
    type index_ArrayCardinality as ArrayCardinality,
    type index_ArrayKeys as ArrayKeys,
    type index_AssertArray as AssertArray,
    type index_AsyncParseReturnType as AsyncParseReturnType,
    type index_BRAND as BRAND,
    type index_CatchallInput as CatchallInput,
    type index_CatchallOutput as CatchallOutput,
    type index_CustomErrorParams as CustomErrorParams,
    index_DIRTY as DIRTY,
    type index_DenormalizedError as DenormalizedError,
    index_EMPTY_PATH as EMPTY_PATH,
    type index_Effect as Effect,
    type index_EnumLike as EnumLike,
    type index_EnumValues as EnumValues,
    type index_ErrorMapCtx as ErrorMapCtx,
    type index_FilterEnum as FilterEnum,
    index_INVALID as INVALID,
    type index_Indices as Indices,
    type index_InnerTypeOfFunction as InnerTypeOfFunction,
    type index_InputTypeOfTuple as InputTypeOfTuple,
    type index_InputTypeOfTupleWithRest as InputTypeOfTupleWithRest,
    type index_IpVersion as IpVersion,
    type index_IssueData as IssueData,
    type index_KeySchema as KeySchema,
    index_NEVER as NEVER,
    index_OK as OK,
    type index_ObjectPair as ObjectPair,
    type index_OuterTypeOfFunction as OuterTypeOfFunction,
    type index_OutputTypeOfTuple as OutputTypeOfTuple,
    type index_OutputTypeOfTupleWithRest as OutputTypeOfTupleWithRest,
    type index_ParseContext as ParseContext,
    type index_ParseInput as ParseInput,
    type index_ParseParams as ParseParams,
    type index_ParsePath as ParsePath,
    type index_ParsePathComponent as ParsePathComponent,
    type index_ParseResult as ParseResult,
    type index_ParseReturnType as ParseReturnType,
    index_ParseStatus as ParseStatus,
    type index_PassthroughType as PassthroughType,
    type index_PreprocessEffect as PreprocessEffect,
    type index_Primitive as Primitive,
    type index_ProcessedCreateParams as ProcessedCreateParams,
    type index_RawCreateParams as RawCreateParams,
    type index_RecordType as RecordType,
    type index_Refinement as Refinement,
    type index_RefinementCtx as RefinementCtx,
    type index_RefinementEffect as RefinementEffect,
    type index_SafeParseError as SafeParseError,
    type index_SafeParseReturnType as SafeParseReturnType,
    type index_SafeParseSuccess as SafeParseSuccess,
    type index_Scalars as Scalars,
    ZodType as Schema,
    type index_SomeZodObject as SomeZodObject,
    type index_StringValidation as StringValidation,
    type index_SuperRefinement as SuperRefinement,
    type index_SyncParseReturnType as SyncParseReturnType,
    type index_TransformEffect as TransformEffect,
    type index_TypeOf as TypeOf,
    type index_UnknownKeysParam as UnknownKeysParam,
    type index_Values as Values,
    type index_Writeable as Writeable,
    index_ZodAny as ZodAny,
    type index_ZodAnyDef as ZodAnyDef,
    index_ZodArray as ZodArray,
    type index_ZodArrayDef as ZodArrayDef,
    index_ZodBigInt as ZodBigInt,
    type index_ZodBigIntCheck as ZodBigIntCheck,
    type index_ZodBigIntDef as ZodBigIntDef,
    index_ZodBoolean as ZodBoolean,
    type index_ZodBooleanDef as ZodBooleanDef,
    index_ZodBranded as ZodBranded,
    type index_ZodBrandedDef as ZodBrandedDef,
    index_ZodCatch as ZodCatch,
    type index_ZodCatchDef as ZodCatchDef,
    type index_ZodCustomIssue as ZodCustomIssue,
    index_ZodDate as ZodDate,
    type index_ZodDateCheck as ZodDateCheck,
    type index_ZodDateDef as ZodDateDef,
    index_ZodDefault as ZodDefault,
    type index_ZodDefaultDef as ZodDefaultDef,
    index_ZodDiscriminatedUnion as ZodDiscriminatedUnion,
    type index_ZodDiscriminatedUnionDef as ZodDiscriminatedUnionDef,
    type index_ZodDiscriminatedUnionOption as ZodDiscriminatedUnionOption,
    index_ZodEffects as ZodEffects,
    type index_ZodEffectsDef as ZodEffectsDef,
    index_ZodEnum as ZodEnum,
    type index_ZodEnumDef as ZodEnumDef,
    index_ZodError as ZodError,
    type index_ZodErrorMap as ZodErrorMap,
    type index_ZodFirstPartySchemaTypes as ZodFirstPartySchemaTypes,
    index_ZodFirstPartyTypeKind as ZodFirstPartyTypeKind,
    type index_ZodFormattedError as ZodFormattedError,
    index_ZodFunction as ZodFunction,
    type index_ZodFunctionDef as ZodFunctionDef,
    index_ZodIntersection as ZodIntersection,
    type index_ZodIntersectionDef as ZodIntersectionDef,
    type index_ZodInvalidArgumentsIssue as ZodInvalidArgumentsIssue,
    type index_ZodInvalidDateIssue as ZodInvalidDateIssue,
    type index_ZodInvalidEnumValueIssue as ZodInvalidEnumValueIssue,
    type index_ZodInvalidIntersectionTypesIssue as ZodInvalidIntersectionTypesIssue,
    type index_ZodInvalidLiteralIssue as ZodInvalidLiteralIssue,
    type index_ZodInvalidReturnTypeIssue as ZodInvalidReturnTypeIssue,
    type index_ZodInvalidStringIssue as ZodInvalidStringIssue,
    type index_ZodInvalidTypeIssue as ZodInvalidTypeIssue,
    type index_ZodInvalidUnionDiscriminatorIssue as ZodInvalidUnionDiscriminatorIssue,
    type index_ZodInvalidUnionIssue as ZodInvalidUnionIssue,
    type index_ZodIssue as ZodIssue,
    type index_ZodIssueBase as ZodIssueBase,
    type index_ZodIssueCode as ZodIssueCode,
    type index_ZodIssueOptionalMessage as ZodIssueOptionalMessage,
    index_ZodLazy as ZodLazy,
    type index_ZodLazyDef as ZodLazyDef,
    index_ZodLiteral as ZodLiteral,
    type index_ZodLiteralDef as ZodLiteralDef,
    index_ZodMap as ZodMap,
    type index_ZodMapDef as ZodMapDef,
    type index_ZodMeta as ZodMeta,
    index_ZodNaN as ZodNaN,
    type index_ZodNaNDef as ZodNaNDef,
    index_ZodNativeEnum as ZodNativeEnum,
    type index_ZodNativeEnumDef as ZodNativeEnumDef,
    index_ZodNever as ZodNever,
    type index_ZodNeverDef as ZodNeverDef,
    type index_ZodNonEmptyArray as ZodNonEmptyArray,
    type index_ZodNotFiniteIssue as ZodNotFiniteIssue,
    type index_ZodNotMultipleOfIssue as ZodNotMultipleOfIssue,
    index_ZodNull as ZodNull,
    type index_ZodNullDef as ZodNullDef,
    index_ZodNullable as ZodNullable,
    type index_ZodNullableDef as ZodNullableDef,
    type index_ZodNullableType as ZodNullableType,
    index_ZodNumber as ZodNumber,
    type index_ZodNumberCheck as ZodNumberCheck,
    type index_ZodNumberDef as ZodNumberDef,
    index_ZodObject as ZodObject,
    type index_ZodObjectDef as ZodObjectDef,
    index_ZodOptional as ZodOptional,
    type index_ZodOptionalDef as ZodOptionalDef,
    type index_ZodOptionalType as ZodOptionalType,
    type index_ZodParsedType as ZodParsedType,
    index_ZodPipeline as ZodPipeline,
    type index_ZodPipelineDef as ZodPipelineDef,
    index_ZodPromise as ZodPromise,
    type index_ZodPromiseDef as ZodPromiseDef,
    type index_ZodRawShape as ZodRawShape,
    index_ZodReadonly as ZodReadonly,
    type index_ZodReadonlyDef as ZodReadonlyDef,
    index_ZodRecord as ZodRecord,
    type index_ZodRecordDef as ZodRecordDef,
    ZodType as ZodSchema,
    index_ZodSet as ZodSet,
    type index_ZodSetDef as ZodSetDef,
    index_ZodString as ZodString,
    type index_ZodStringCheck as ZodStringCheck,
    type index_ZodStringDef as ZodStringDef,
    index_ZodSymbol as ZodSymbol,
    type index_ZodSymbolDef as ZodSymbolDef,
    type index_ZodTooBigIssue as ZodTooBigIssue,
    type index_ZodTooSmallIssue as ZodTooSmallIssue,
    ZodEffects as ZodTransformer,
    index_ZodTuple as ZodTuple,
    type index_ZodTupleDef as ZodTupleDef,
    type index_ZodTupleItems as ZodTupleItems,
    index_ZodType as ZodType,
    type index_ZodTypeAny as ZodTypeAny,
    type index_ZodTypeDef as ZodTypeDef,
    index_ZodUndefined as ZodUndefined,
    type index_ZodUndefinedDef as ZodUndefinedDef,
    index_ZodUnion as ZodUnion,
    type index_ZodUnionDef as ZodUnionDef,
    type index_ZodUnionOptions as ZodUnionOptions,
    index_ZodUnknown as ZodUnknown,
    type index_ZodUnknownDef as ZodUnknownDef,
    type index_ZodUnrecognizedKeysIssue as ZodUnrecognizedKeysIssue,
    index_ZodVoid as ZodVoid,
    type index_ZodVoidDef as ZodVoidDef,
    index_addIssueToContext as addIssueToContext,
    anyType as any,
    arrayType as array,
    type index_arrayOutputType as arrayOutputType,
    type index_baseObjectInputType as baseObjectInputType,
    type index_baseObjectOutputType as baseObjectOutputType,
    bigIntType as bigint,
    booleanType as boolean,
    index_coerce as coerce,
    index_custom as custom,
    dateType as date,
    index_datetimeRegex as datetimeRegex,
    errorMap as defaultErrorMap,
    type index_deoptional as deoptional,
    discriminatedUnionType as discriminatedUnion,
    effectsType as effect,
    enumType as enum,
    functionType as function,
    index_getErrorMap as getErrorMap,
    index_getParsedType as getParsedType,
    type TypeOf as infer,
    type index_inferFlattenedErrors as inferFlattenedErrors,
    type index_inferFormattedError as inferFormattedError,
    type index_input as input,
    instanceOfType as instanceof,
    intersectionType as intersection,
    index_isAborted as isAborted,
    index_isAsync as isAsync,
    index_isDirty as isDirty,
    index_isValid as isValid,
    index_late as late,
    lazyType as lazy,
    literalType as literal,
    index_makeIssue as makeIssue,
    mapType as map,
    type index_mergeTypes as mergeTypes,
    nanType as nan,
    nativeEnumType as nativeEnum,
    neverType as never,
    type index_noUnrecognized as noUnrecognized,
    nullType as null,
    nullableType as nullable,
    numberType as number,
    objectType as object,
    type index_objectInputType as objectInputType,
    type index_objectOutputType as objectOutputType,
    index_objectUtil as objectUtil,
    index_oboolean as oboolean,
    index_onumber as onumber,
    optionalType as optional,
    index_ostring as ostring,
    type index_output as output,
    pipelineType as pipeline,
    preprocessType as preprocess,
    promiseType as promise,
    index_quotelessJson as quotelessJson,
    recordType as record,
    setType as set,
    index_setErrorMap as setErrorMap,
    strictObjectType as strictObject,
    stringType as string,
    symbolType as symbol,
    effectsType as transformer,
    tupleType as tuple,
    type index_typeToFlattenedError as typeToFlattenedError,
    type index_typecast as typecast,
    undefinedType as undefined,
    unionType as union,
    unknownType as unknown,
    index_util as util,
    voidType as void
  }
}

// ## Enumeration

/**
 * How phrasing content is aligned
 * ({@link https://drafts.csswg.org/css-text/ | [CSSTEXT]}).
 *
 * * `'left'`: See the
 *   {@link https://drafts.csswg.org/css-text/#valdef-text-align-left | left}
 *   value of the `text-align` CSS property
 * * `'right'`: See the
 *   {@link https://drafts.csswg.org/css-text/#valdef-text-align-right | right}
 *   value of the `text-align` CSS property
 * * `'center'`: See the
 *   {@link https://drafts.csswg.org/css-text/#valdef-text-align-center | center}
 *   value of the `text-align` CSS property
 * * `null`: phrasing content is aligned as defined by the host environment
 *
 * Used in GFM tables.
 */
type AlignType = 'center' | 'left' | 'right' | null

/**
 * Explicitness of a reference.
 *
 * `'shortcut'`: the reference is implicit, its identifier inferred from its
 *   content
 * `'collapsed'`: the reference is explicit, its identifier inferred from its
 *   content
 * `'full'`: the reference is explicit, its identifier explicitly set
 */
type ReferenceType = 'shortcut' | 'collapsed' | 'full'

// ## Mixin

/**
 * Node with a fallback.
 */
interface Alternative {
  /**
   * Equivalent content for environments that cannot represent the node as
   * intended.
   */
  alt?: string | null | undefined
}

/**
 * Internal relation from one node to another.
 *
 * Whether the value of `identifier` is expected to be a unique identifier or
 * not depends on the type of node including the Association.
 * An example of this is that they should be unique on {@link Definition},
 * whereas multiple {@link LinkReference}s can be non-unique to be associated
 * with one definition.
 */
interface Association {
  /**
   * Relation of association.
   *
   * `identifier` is a source value: character escapes and character
   * references are not parsed.
   *
   * It can match another node.
   *
   * Its value must be normalized.
   * To normalize a value, collapse markdown whitespace (`[\t\n\r ]+`) to a space,
   * trim the optional initial and/or final space, and perform Unicode-aware
   * case-folding.
   */
  identifier: string

  /**
   * Relation of association, in parsed form.
   *
   * `label` is a `string` value: it works just like `title` on {@link Link}
   * or a `lang` on {@link Code}: character escapes and character references
   * are parsed.
   *
   * It can match another node.
   */
  label?: string | null | undefined
}

/**
 * Marker that is associated to another node.
 */
interface Reference extends Association {
  /**
   * Explicitness of the reference.
   */
  referenceType: ReferenceType
}

/**
 * Reference to resource.
 */
interface Resource {
  /**
   * URL to the referenced resource.
   */
  url: string
  /**
   * Advisory information for the resource, such as would be appropriate for
   * a tooltip.
   */
  title?: string | null | undefined
}

// ## Interfaces

/**
 * Info associated with mdast nodes by the ecosystem.
 *
 * This space is guaranteed to never be specified by unist or mdast.
 * But you can use it in utilities and plugins to store data.
 *
 * This type can be augmented to register custom data.
 * For example:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface Data {
 *     // `someNode.data.myId` is typed as `number | undefined`
 *     myId?: number | undefined
 *   }
 * }
 * ```
 */
interface Data$7 extends Data$8 {}

// ## Content maps

/**
 * Union of registered mdast nodes that can occur where block content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link BlockContentMap}.
 * They will be automatically added here.
 */
type BlockContent = BlockContentMap[keyof BlockContentMap]

/**
 * Registry of all mdast nodes that can occur where {@link BlockContent} is
 * expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface BlockContentMap {
 *     // Allow using MDX ESM nodes defined by `remark-mdx`.
 *     mdxjsEsm: MdxjsEsm;
 *   }
 * }
 * ```
 *
 * For a union of all block content, see {@link RootContent}.
 */
interface BlockContentMap {
  blockquote: Blockquote
  code: Code
  heading: Heading$1
  html: Html
  list: List
  paragraph: Paragraph
  table: Table
  thematicBreak: ThematicBreak
}

/**
 * Union of registered mdast nodes that can occur where definition content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link DefinitionContentMap}.
 * They will be automatically added here.
 */
type DefinitionContent = DefinitionContentMap[keyof DefinitionContentMap]

/**
 * Registry of all mdast nodes that can occur where {@link DefinitionContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface DefinitionContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all definition content, see {@link RootContent}.
 */
interface DefinitionContentMap {
  definition: Definition
  footnoteDefinition: FootnoteDefinition
}

/**
 * Union of registered mdast nodes that can occur where list content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link ListContentMap}.
 * They will be automatically added here.
 */
type ListContent = ListContentMap[keyof ListContentMap]

/**
 * Registry of all mdast nodes that can occur where {@link ListContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface ListContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all list content, see {@link RootContent}.
 */
interface ListContentMap {
  listItem: ListItem
}

/**
 * Union of registered mdast nodes that can occur where phrasing content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link PhrasingContentMap}.
 * They will be automatically added here.
 */
type PhrasingContent = PhrasingContentMap[keyof PhrasingContentMap]

/**
 * Registry of all mdast nodes that can occur where {@link PhrasingContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface PhrasingContentMap {
 *     // Allow using MDX JSX (text) nodes defined by `remark-mdx`.
 *     mdxJsxTextElement: MDXJSXTextElement;
 *   }
 * }
 * ```
 *
 * For a union of all phrasing content, see {@link RootContent}.
 */
interface PhrasingContentMap {
  break: Break
  delete: Delete
  emphasis: Emphasis
  footnoteReference: FootnoteReference
  html: Html
  image: Image$1
  imageReference: ImageReference
  inlineCode: InlineCode
  link: Link
  linkReference: LinkReference
  strong: Strong
  text: Text$1
}

/**
 * Union of registered mdast nodes that can occur in {@link Root}.
 *
 * To register custom mdast nodes, add them to {@link RootContentMap}.
 * They will be automatically added here.
 */
type RootContent$1 = RootContentMap$1[keyof RootContentMap$1]

/**
 * Registry of all mdast nodes that can occur as children of {@link Root}.
 *
 * > **Note**: {@link Root} does not need to be an entire document.
 * > it can also be a fragment.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface RootContentMap {
 *     // Allow using toml nodes defined by `remark-frontmatter`.
 *     toml: TOML;
 *   }
 * }
 * ```
 *
 * For a union of all {@link Root} children, see {@link RootContent}.
 */
interface RootContentMap$1 {
  blockquote: Blockquote
  break: Break
  code: Code
  definition: Definition
  delete: Delete
  emphasis: Emphasis
  footnoteDefinition: FootnoteDefinition
  footnoteReference: FootnoteReference
  heading: Heading$1
  html: Html
  image: Image$1
  imageReference: ImageReference
  inlineCode: InlineCode
  link: Link
  linkReference: LinkReference
  list: List
  listItem: ListItem
  paragraph: Paragraph
  strong: Strong
  table: Table
  tableCell: TableCell
  tableRow: TableRow
  text: Text$1
  thematicBreak: ThematicBreak
  yaml: Yaml
}

/**
 * Union of registered mdast nodes that can occur where row content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link RowContentMap}.
 * They will be automatically added here.
 */
type RowContent = RowContentMap[keyof RowContentMap]

/**
 * Registry of all mdast nodes that can occur where {@link RowContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface RowContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all row content, see {@link RootContent}.
 */
interface RowContentMap {
  tableCell: TableCell
}

/**
 * Union of registered mdast nodes that can occur where table content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link TableContentMap}.
 * They will be automatically added here.
 */
type TableContent = TableContentMap[keyof TableContentMap]

/**
 * Registry of all mdast nodes that can occur where {@link TableContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface TableContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all table content, see {@link RootContent}.
 */
interface TableContentMap {
  tableRow: TableRow
}

// ## Abstract nodes

/**
 * Abstract mdast node that contains the smallest possible value.
 *
 * This interface is supposed to be extended if you make custom mdast nodes.
 *
 * For a union of all registered mdast literals, see {@link Literals}.
 */
interface Literal$1 extends Node$4 {
  /**
   * Plain-text value.
   */
  value: string
}

/**
 * Abstract mdast node.
 *
 * This interface is supposed to be extended.
 * If you can use {@link Literal} or {@link Parent}, you should.
 * But for example in markdown, a thematic break (`***`) is neither literal nor
 * parent, but still a node.
 *
 * To register custom mdast nodes, add them to {@link RootContentMap} and other
 * places where relevant (such as {@link ElementContentMap}).
 *
 * For a union of all registered mdast nodes, see {@link Nodes}.
 */
interface Node$4 extends Node$5 {
  /**
   * Info from the ecosystem.
   */
  data?: Data$7 | undefined
}

/**
 * Abstract mdast node that contains other mdast nodes (*children*).
 *
 * This interface is supposed to be extended if you make custom mdast nodes.
 *
 * For a union of all registered mdast parents, see {@link Parents}.
 */
interface Parent$2 extends Node$4 {
  /**
   * List of children.
   */
  children: RootContent$1[]
}

// ## Concrete nodes

/**
 * Markdown block quote.
 */
interface Blockquote extends Parent$2 {
  /**
   * Node type of mdast block quote.
   */
  type: 'blockquote'
  /**
   * Children of block quote.
   */
  children: Array<BlockContent | DefinitionContent>
  /**
   * Data associated with the mdast block quote.
   */
  data?: BlockquoteData | undefined
}

/**
 * Info associated with mdast block quote nodes by the ecosystem.
 */
interface BlockquoteData extends Data$7 {}

/**
 * Markdown break.
 */
interface Break extends Node$4 {
  /**
   * Node type of mdast break.
   */
  type: 'break'
  /**
   * Data associated with the mdast break.
   */
  data?: BreakData | undefined
}

/**
 * Info associated with mdast break nodes by the ecosystem.
 */
interface BreakData extends Data$7 {}

/**
 * Markdown code (flow) (block).
 */
interface Code extends Literal$1 {
  /**
   * Node type of mdast code (flow).
   */
  type: 'code'
  /**
   * Language of computer code being marked up.
   */
  lang?: string | null | undefined
  /**
   * Custom information relating to the node.
   *
   * If the lang field is present, a meta field can be present.
   */
  meta?: string | null | undefined
  /**
   * Data associated with the mdast code (flow).
   */
  data?: CodeData | undefined
}

/**
 * Info associated with mdast code (flow) (block) nodes by the ecosystem.
 */
interface CodeData extends Data$7 {}

/**
 * Markdown definition.
 */
interface Definition extends Node$4, Association, Resource {
  /**
   * Node type of mdast definition.
   */
  type: 'definition'
  /**
   * Data associated with the mdast definition.
   */
  data?: DefinitionData | undefined
}

/**
 * Info associated with mdast definition nodes by the ecosystem.
 */
interface DefinitionData extends Data$7 {}

/**
 * Markdown GFM delete (strikethrough).
 */
interface Delete extends Parent$2 {
  /**
   * Node type of mdast GFM delete.
   */
  type: 'delete'
  /**
   * Children of GFM delete.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast GFM delete.
   */
  data?: DeleteData | undefined
}

/**
 * Info associated with mdast GFM delete nodes by the ecosystem.
 */
interface DeleteData extends Data$7 {}

/**
 * Markdown emphasis.
 */
interface Emphasis extends Parent$2 {
  /**
   * Node type of mdast emphasis.
   */
  type: 'emphasis'
  /**
   * Children of emphasis.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast emphasis.
   */
  data?: EmphasisData | undefined
}

/**
 * Info associated with mdast emphasis nodes by the ecosystem.
 */
interface EmphasisData extends Data$7 {}

/**
 * Markdown GFM footnote definition.
 */
interface FootnoteDefinition extends Parent$2, Association {
  /**
   * Node type of mdast GFM footnote definition.
   */
  type: 'footnoteDefinition'
  /**
   * Children of GFM footnote definition.
   */
  children: Array<BlockContent | DefinitionContent>
  /**
   * Data associated with the mdast GFM footnote definition.
   */
  data?: FootnoteDefinitionData | undefined
}

/**
 * Info associated with mdast GFM footnote definition nodes by the ecosystem.
 */
interface FootnoteDefinitionData extends Data$7 {}

/**
 * Markdown GFM footnote reference.
 */
interface FootnoteReference extends Association, Node$4 {
  /**
   * Node type of mdast GFM footnote reference.
   */
  type: 'footnoteReference'
  /**
   * Data associated with the mdast GFM footnote reference.
   */
  data?: FootnoteReferenceData | undefined
}

/**
 * Info associated with mdast GFM footnote reference nodes by the ecosystem.
 */
interface FootnoteReferenceData extends Data$7 {}

/**
 * Markdown heading.
 */
interface Heading$1 extends Parent$2 {
  /**
   * Node type of mdast heading.
   */
  type: 'heading'
  /**
   * Heading rank.
   *
   * A value of `1` is said to be the highest rank and `6` the lowest.
   */
  depth: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Children of heading.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast heading.
   */
  data?: HeadingData | undefined
}

/**
 * Info associated with mdast heading nodes by the ecosystem.
 */
interface HeadingData extends Data$7 {}

/**
 * Markdown HTML.
 */
interface Html extends Literal$1 {
  /**
   * Node type of mdast HTML.
   */
  type: 'html'
  /**
   * Data associated with the mdast HTML.
   */
  data?: HtmlData | undefined
}

/**
 * Info associated with mdast HTML nodes by the ecosystem.
 */
interface HtmlData extends Data$7 {}

/**
 * Markdown image.
 */
interface Image$1 extends Alternative, Node$4, Resource {
  /**
   * Node type of mdast image.
   */
  type: 'image'
  /**
   * Data associated with the mdast image.
   */
  data?: ImageData | undefined
}

/**
 * Info associated with mdast image nodes by the ecosystem.
 */
interface ImageData extends Data$7 {}

/**
 * Markdown image reference.
 */
interface ImageReference extends Alternative, Node$4, Reference {
  /**
   * Node type of mdast image reference.
   */
  type: 'imageReference'
  /**
   * Data associated with the mdast image reference.
   */
  data?: ImageReferenceData | undefined
}

/**
 * Info associated with mdast image reference nodes by the ecosystem.
 */
interface ImageReferenceData extends Data$7 {}

/**
 * Markdown code (text) (inline).
 */
interface InlineCode extends Literal$1 {
  /**
   * Node type of mdast code (text).
   */
  type: 'inlineCode'
  /**
   * Data associated with the mdast code (text).
   */
  data?: InlineCodeData | undefined
}

/**
 * Info associated with mdast code (text) (inline) nodes by the ecosystem.
 */
interface InlineCodeData extends Data$7 {}

/**
 * Markdown link.
 */
interface Link extends Parent$2, Resource {
  /**
   * Node type of mdast link.
   */
  type: 'link'
  /**
   * Children of link.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast link.
   */
  data?: LinkData | undefined
}

/**
 * Info associated with mdast link nodes by the ecosystem.
 */
interface LinkData extends Data$7 {}

/**
 * Markdown link reference.
 */
interface LinkReference extends Parent$2, Reference {
  /**
   * Node type of mdast link reference.
   */
  type: 'linkReference'
  /**
   * Children of link reference.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast link reference.
   */
  data?: LinkReferenceData | undefined
}

/**
 * Info associated with mdast link reference nodes by the ecosystem.
 */
interface LinkReferenceData extends Data$7 {}

/**
 * Markdown list.
 */
interface List extends Parent$2 {
  /**
   * Node type of mdast list.
   */
  type: 'list'
  /**
   * Whether the items have been intentionally ordered (when `true`), or that
   * the order of items is not important (when `false` or not present).
   */
  ordered?: boolean | null | undefined
  /**
   * The starting number of the list, when the `ordered` field is `true`.
   */
  start?: number | null | undefined
  /**
   * Whether one or more of the children are separated with a blank line from
   * its siblings (when `true`), or not (when `false` or not present).
   */
  spread?: boolean | null | undefined
  /**
   * Children of list.
   */
  children: ListContent[]
  /**
   * Data associated with the mdast list.
   */
  data?: ListData | undefined
}

/**
 * Info associated with mdast list nodes by the ecosystem.
 */
interface ListData extends Data$7 {}

/**
 * Markdown list item.
 */
interface ListItem extends Parent$2 {
  /**
   * Node type of mdast list item.
   */
  type: 'listItem'
  /**
   * Whether the item is a tasklist item (when `boolean`).
   *
   * When `true`, the item is complete.
   * When `false`, the item is incomplete.
   */
  checked?: boolean | null | undefined
  /**
   * Whether one or more of the children are separated with a blank line from
   * its siblings (when `true`), or not (when `false` or not present).
   */
  spread?: boolean | null | undefined
  /**
   * Children of list item.
   */
  children: Array<BlockContent | DefinitionContent>
  /**
   * Data associated with the mdast list item.
   */
  data?: ListItemData | undefined
}

/**
 * Info associated with mdast list item nodes by the ecosystem.
 */
interface ListItemData extends Data$7 {}

/**
 * Markdown paragraph.
 */
interface Paragraph extends Parent$2 {
  /**
   * Node type of mdast paragraph.
   */
  type: 'paragraph'
  /**
   * Children of paragraph.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast paragraph.
   */
  data?: ParagraphData | undefined
}

/**
 * Info associated with mdast paragraph nodes by the ecosystem.
 */
interface ParagraphData extends Data$7 {}

/**
 * Document fragment or a whole document.
 *
 * Should be used as the root of a tree and must not be used as a child.
 */
interface Root$1 extends Parent$2 {
  /**
   * Node type of mdast root.
   */
  type: 'root'
  /**
   * Data associated with the mdast root.
   */
  data?: RootData$1 | undefined
}

/**
 * Info associated with mdast root nodes by the ecosystem.
 */
interface RootData$1 extends Data$7 {}

/**
 * Markdown strong.
 */
interface Strong extends Parent$2 {
  /**
   * Node type of mdast strong.
   */
  type: 'strong'
  /**
   * Children of strong.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast strong.
   */
  data?: StrongData | undefined
}

/**
 * Info associated with mdast strong nodes by the ecosystem.
 */
interface StrongData extends Data$7 {}

/**
 * Markdown GFM table.
 */
interface Table extends Parent$2 {
  /**
   * Node type of mdast GFM table.
   */
  type: 'table'
  /**
   * How cells in columns are aligned.
   */
  align?: AlignType[] | null | undefined
  /**
   * Children of GFM table.
   */
  children: TableContent[]
  /**
   * Data associated with the mdast GFM table.
   */
  data?: TableData | undefined
}

/**
 * Info associated with mdast GFM table nodes by the ecosystem.
 */
interface TableData extends Data$7 {}

/**
 * Markdown GFM table row.
 */
interface TableRow extends Parent$2 {
  /**
   * Node type of mdast GFM table row.
   */
  type: 'tableRow'
  /**
   * Children of GFM table row.
   */
  children: RowContent[]
  /**
   * Data associated with the mdast GFM table row.
   */
  data?: TableRowData | undefined
}

/**
 * Info associated with mdast GFM table row nodes by the ecosystem.
 */
interface TableRowData extends Data$7 {}

/**
 * Markdown GFM table cell.
 */
interface TableCell extends Parent$2 {
  /**
   * Node type of mdast GFM table cell.
   */
  type: 'tableCell'
  /**
   * Children of GFM table cell.
   */
  children: PhrasingContent[]
  /**
   * Data associated with the mdast GFM table cell.
   */
  data?: TableCellData | undefined
}

/**
 * Info associated with mdast GFM table cell nodes by the ecosystem.
 */
interface TableCellData extends Data$7 {}

/**
 * Markdown text.
 */
interface Text$1 extends Literal$1 {
  /**
   * Node type of mdast text.
   */
  type: 'text'
  /**
   * Data associated with the mdast text.
   */
  data?: TextData$1 | undefined
}

/**
 * Info associated with mdast text nodes by the ecosystem.
 */
interface TextData$1 extends Data$7 {}

/**
 * Markdown thematic break (horizontal rule).
 */
interface ThematicBreak extends Node$4 {
  /**
   * Node type of mdast thematic break.
   */
  type: 'thematicBreak'
  /**
   * Data associated with the mdast thematic break.
   */
  data?: ThematicBreakData | undefined
}

/**
 * Info associated with mdast thematic break nodes by the ecosystem.
 */
interface ThematicBreakData extends Data$7 {}

/**
 * Markdown YAML.
 */
interface Yaml extends Literal$1 {
  /**
   * Node type of mdast YAML.
   */
  type: 'yaml'
  /**
   * Data associated with the mdast YAML.
   */
  data?: YamlData | undefined
}

/**
 * Info associated with mdast YAML nodes by the ecosystem.
 */
interface YamlData extends Data$7 {}

type Node$3 = unist.Node
type Parent$1 = unist.Parent
/**
 * Object to check for equivalence.
 *
 * Note: `Node` is included as it is common but is not indexable.
 */
type Props = Record<string, unknown> | Node$3
/**
 * Check for an arbitrary node.
 */
type Test$2 = Array<Props | TestFunction | string> | Props | TestFunction | string | null | undefined
/**
 * Check if a node passes a test.
 */
type TestFunction = (this: unknown, node: Node$3, index?: number | undefined, parent?: Parent$1 | undefined) => boolean | undefined | void

type Test$1 = Test$2

type Heading = Heading$1
type Test = Test$1
type Rank = Heading['depth']
/**
 * Search configuration.
 */
type SearchOptions$1 = {
  /**
   * Maximum heading depth to include in the table of contents (default: `6`).
   *
   * This is inclusive: when set to `3`, level three headings are included
   * (those with three hashes, `###`).
   */
  maxDepth?: Rank | null | undefined
  /**
   * Minimum heading depth to include in the table of contents (default: `1`).
   *
   * This is inclusive: when set to `3`, level three headings are included
   * (those with three hashes, `###`).
   */
  minDepth?: Rank | null | undefined
  /**
   * Headings to skip, wrapped in `new RegExp('^(' + value + ')$', 'i')`
   * (default: `undefined`).
   *
   * Any heading matching this expression will not be present in the table of
   * contents.
   */
  skip?: string | null | undefined
  /**
   * Allow headings to be children of certain node types (default: the to `toc`
   * given `tree`, to only allow top-level headings) (default:
   * `d => d === tree`).
   *
   * Internally, uses `unist-util-is` to check, so `parents` can be any
   * `is`-compatible test.
   */
  parents?: Test
}

/**
 * Build configuration.
 */
type ContentsOptions$1 = {
  /**
   * Whether to compile list items tightly (default: `false`).
   */
  tight?: boolean | null | undefined
  /**
   * Whether to compile list items as an ordered list, otherwise they are
   * unordered (default: `false`).
   */
  ordered?: boolean | null | undefined
  /**
   * Add a prefix to links to headings in the table of contents (default:
   * `undefined`).
   *
   * Useful for example when later going from mdast to hast and sanitizing with
   * `hast-util-sanitize`.
   */
  prefix?: string | null | undefined
}

type SearchOptions = SearchOptions$1
type ContentsOptions = ContentsOptions$1
type Options$6 = ContentsOptions & ExtraOptions & SearchOptions
/**
 * Extra configuration fields.
 */
type ExtraOptions = {
  /**
   * Heading to look for, wrapped in `new RegExp('^(' + value + ')$', 'i')`
   * (default: `undefined`).
   */
  heading?: string | null | undefined
}

type Options$5 = Options$6

/**
 * Options for table of contents
 * extraction
 */
interface TocOptions extends Options$5 {
  /**
   * keep the original tree
   */
  original?: boolean
}
/**
 * Entry for a table of contents
 * with title, url and items
 */
interface TocEntry {
  /**
   * Title of the entry
   */
  title: string
  /**
   * URL that can be used to reach
   * the content
   */
  url: string
  /**
   * Nested items
   */
  items: TocEntry[]
}
/**
 * Tree for table of contents
 */
interface TocTree {
  /**
   *  Index of the node right after the table of contents heading, `-1` if no
   *  heading was found, `undefined` if no `heading` was given.
   */
  index?: number
  /**
   *  Index of the first node after `heading` that is not part of its section,
   *  `-1` if no heading was found, `undefined` if no `heading` was given, same
   *  as `index` if there are no nodes between `heading` and the first heading
   *  in the table of contents.
   */
  endIndex?: number
  /**
   *  List representing the generated table of contents, `undefined` if no table
   *  of contents could be created, either because no heading was found or
   *  because no following headings were found.
   */
  map?: List
}

/**
 * Options for flattened path
 * extraction
 */
interface PathOptions {
  /**
   * removes `index` from the path
   * for subfolders
   *
   * @default true
   */
  removeIndex?: boolean
}

/**
 * Message.
 */
declare class VFileMessage extends Error {
  constructor(reason: string, options?: Options$4 | null | undefined)
  constructor(reason: string, parent: Node$2 | NodeLike$1 | null | undefined, origin?: string | null | undefined)
  constructor(reason: string, place: Point | Position | null | undefined, origin?: string | null | undefined)
  constructor(reason: string, origin?: string | null | undefined)
  constructor(cause: Error | VFileMessage, parent: Node$2 | NodeLike$1 | null | undefined, origin?: string | null | undefined)
  constructor(cause: Error | VFileMessage, place: Point | Position | null | undefined, origin?: string | null | undefined)
  constructor(cause: Error | VFileMessage, origin?: string | null | undefined)
  /**
   * Stack of ancestor nodes surrounding the message.
   *
   * @type {Array<Node> | undefined}
   */
  ancestors: Array<Node$2> | undefined
  /**
   * Starting column of message.
   *
   * @type {number | undefined}
   */
  column: number | undefined
  /**
   * State of problem.
   *
   * * `true` — error, file not usable
   * * `false` — warning, change may be needed
   * * `undefined` — change likely not needed
   *
   * @type {boolean | null | undefined}
   */
  fatal: boolean | null | undefined
  /**
   * Path of a file (used throughout the `VFile` ecosystem).
   *
   * @type {string | undefined}
   */
  file: string | undefined
  /**
   * Starting line of error.
   *
   * @type {number | undefined}
   */
  line: number | undefined
  /**
   * Place of message.
   *
   * @type {Point | Position | undefined}
   */
  place: Point | Position | undefined
  /**
   * Reason for message, should use markdown.
   *
   * @type {string}
   */
  reason: string
  /**
   * Category of message (example: `'my-rule'`).
   *
   * @type {string | undefined}
   */
  ruleId: string | undefined
  /**
   * Namespace of message (example: `'my-package'`).
   *
   * @type {string | undefined}
   */
  source: string | undefined
  /**
   * Specify the source value that’s being reported, which is deemed
   * incorrect.
   *
   * @type {string | undefined}
   */
  actual: string | undefined
  /**
   * Suggest acceptable values that can be used instead of `actual`.
   *
   * @type {Array<string> | undefined}
   */
  expected: Array<string> | undefined
  /**
   * Long form description of the message (you should use markdown).
   *
   * @type {string | undefined}
   */
  note: string | undefined
  /**
   * Link to docs for the message.
   *
   * > 👉 **Note**: this must be an absolute URL that can be passed as `x`
   * > to `new URL(x)`.
   *
   * @type {string | undefined}
   */
  url: string | undefined
}
type Node$2 = unist.Node
type Point = unist.Point
type Position = unist.Position
type NodeLike$1 = object & {
  type: string
  position?: Position | undefined
}
/**
 * Configuration.
 */
type Options$4 = {
  /**
   * Stack of (inclusive) ancestor nodes surrounding the message (optional).
   */
  ancestors?: Array<Node$2> | null | undefined
  /**
   * Original error cause of the message (optional).
   */
  cause?: Error | null | undefined
  /**
   * Place of message (optional).
   */
  place?: Point | Position | null | undefined
  /**
   * Category of message (optional, example: `'my-rule'`).
   */
  ruleId?: string | null | undefined
  /**
   * Namespace of who sent the message (optional, example: `'my-package'`).
   */
  source?: string | null | undefined
}

type Options$3 = Options$4

// See: <https://github.com/sindresorhus/type-fest/blob/main/source/empty-object.d.ts>
declare const emptyObjectSymbol$4: unique symbol

/**
 * Things that can be passed to the constructor.
 */
type Compatible$2 = Options$2 | URL | VFile | Value$2

/**
 * Raw source map.
 *
 * See:
 * <https://github.com/mozilla/source-map/blob/60adcb0/source-map.d.ts#L15-L23>.
 */
interface Map$1 {
  /**
   * The generated file this source map is associated with.
   */
  file: string
  /**
   * A string of base64 VLQs which contain the actual mappings.
   */
  mappings: string
  /**
   * An array of identifiers which can be referenced by individual mappings.
   */
  names: Array<string>
  /**
   * An array of contents of the original source files.
   */
  sourcesContent?: Array<string> | undefined
  /**
   * The URL root from which all sources are relative.
   */
  sourceRoot?: string | undefined
  /**
   * An array of URLs to the original source files.
   */
  sources: Array<string>
  /**
   * Which version of the source map spec this map is following.
   */
  version: number
}

/**
 * This map registers the type of the `data` key of a `VFile`.
 *
 * This type can be augmented to register custom `data` types.
 *
 * @example
 * declare module 'vfile' {
 *   interface DataMap {
 *     // `file.data.name` is typed as `string`
 *     name: string
 *   }
 * }
 */
interface DataMap$2 {
  [emptyObjectSymbol$4]?: never
}

/**
 * Custom info.
 *
 * Known attributes can be added to {@linkcode DataMap}
 */
type Data$6 = Record<string, unknown> & Partial<DataMap$2>

/**
 * Configuration.
 */
interface Options$2 {
  /**
   * Arbitrary fields that will be shallow copied over to the new file.
   */
  [key: string]: unknown
  /**
   * Set `basename` (name).
   */
  basename?: string | null | undefined
  /**
   * Set `cwd` (working directory).
   */
  cwd?: string | null | undefined
  /**
   * Set `data` (associated info).
   */
  data?: Data$6 | null | undefined
  /**
   * Set `dirname` (path w/o basename).
   */
  dirname?: string | null | undefined
  /**
   * Set `extname` (extension with dot).
   */
  extname?: string | null | undefined
  /**
   * Set `history` (paths the file moved between).
   */
  history?: Array<string> | null | undefined
  /**
   * Set `path` (current path).
   */
  path?: URL | string | null | undefined
  /**
   * Set `stem` (name without extension).
   */
  stem?: string | null | undefined
  /**
   * Set `value` (the contents of the file).
   */
  value?: Value$2 | null | undefined
}

/**
 * Contents of the file.
 *
 * Can either be text or a `Uint8Array` structure.
 */
type Value$2 = Uint8Array | string

declare class VFile {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Uint8Array` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
  constructor(value?: Compatible$2 | null | undefined)
  /**
   * Base of `path` (default: `process.cwd()` or `'/'` in browsers).
   *
   * @type {string}
   */
  cwd: string
  /**
   * Place to store custom info (default: `{}`).
   *
   * It’s OK to store custom data directly on the file but moving it to
   * `data` is recommended.
   *
   * @type {Data}
   */
  data: Data$6
  /**
   * List of file paths the file moved between.
   *
   * The first is the original path and the last is the current path.
   *
   * @type {Array<string>}
   */
  history: Array<string>
  /**
   * List of messages associated with the file.
   *
   * @type {Array<VFileMessage>}
   */
  messages: Array<VFileMessage>
  /**
   * Raw value.
   *
   * @type {Value}
   */
  value: Value$2
  /**
   * Source map.
   *
   * This type is equivalent to the `RawSourceMap` type from the `source-map`
   * module.
   *
   * @type {Map | null | undefined}
   */
  map: Map$1 | null | undefined
  /**
   * Custom, non-string, compiled, representation.
   *
   * This is used by unified to store non-string results.
   * One example is when turning markdown into React nodes.
   *
   * @type {unknown}
   */
  result: unknown
  /**
   * Whether a file was saved to disk.
   *
   * This is used by vfile reporters.
   *
   * @type {boolean}
   */
  stored: boolean
  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} basename
   *   Basename.
   * @returns {undefined}
   *   Nothing.
   */
  set basename(basename: string)
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename(): string | undefined
  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {URL | string} path
   *   Path.
   * @returns {undefined}
   *   Nothing.
   */
  set path(path: string | URL)
  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   *   Path.
   */
  get path(): string
  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} dirname
   *   Dirname.
   * @returns {undefined}
   *   Nothing.
   */
  set dirname(dirname: string | undefined)
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname(): string | undefined
  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} extname
   *   Extname.
   * @returns {undefined}
   *   Nothing.
   */
  set extname(extname: string | undefined)
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname(): string | undefined
  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} stem
   *   Stem.
   * @returns {undefined}
   *   Nothing.
   */
  set stem(stem: string)
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem(): string | undefined
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(reason: string, options?: Options$3 | null | undefined): never
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(reason: string, parent: Node$5 | NodeLike | null | undefined, origin?: string | null | undefined): never
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(reason: string, place: Point$1 | Position$1 | null | undefined, origin?: string | null | undefined): never
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(reason: string, origin?: string | null | undefined): never
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(cause: Error | VFileMessage, parent: Node$5 | NodeLike | null | undefined, origin?: string | null | undefined): never
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(cause: Error | VFileMessage, place: Point$1 | Position$1 | null | undefined, origin?: string | null | undefined): never
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(cause: Error | VFileMessage, origin?: string | null | undefined): never
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(reason: string, options?: Options$3 | null | undefined): VFileMessage
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(reason: string, parent: Node$5 | NodeLike | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(reason: string, place: Point$1 | Position$1 | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(reason: string, origin?: string | null | undefined): VFileMessage
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(cause: Error | VFileMessage, parent: Node$5 | NodeLike | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(cause: Error | VFileMessage, place: Point$1 | Position$1 | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(cause: Error | VFileMessage, origin?: string | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(reason: string, options?: Options$3 | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(reason: string, parent: Node$5 | NodeLike | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(reason: string, place: Point$1 | Position$1 | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(reason: string, origin?: string | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(cause: Error | VFileMessage, parent: Node$5 | NodeLike | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(cause: Error | VFileMessage, place: Point$1 | Position$1 | null | undefined, origin?: string | null | undefined): VFileMessage
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(cause: Error | VFileMessage, origin?: string | null | undefined): VFileMessage
  /**
   * Serialize the file.
   *
   * > **Note**: which encodings are supported depends on the engine.
   * > For info on Node.js, see:
   * > <https://nodejs.org/api/util.html#whatwg-supported-encodings>.
   *
   * @param {string | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Uint8Array`
   *   (default: `'utf-8'`).
   * @returns {string}
   *   Serialized file.
   */
  toString(encoding?: string | null | undefined): string
}
type NodeLike = object & {
  type: string
  position?: Position$1 | undefined
}

// See: <https://github.com/sindresorhus/type-fest/blob/main/source/empty-object.d.ts>
declare const emptyObjectSymbol$3: unique symbol

/**
 * Things that can be passed to the constructor.
 */
type Compatible$1 = Options$1 | URL | VFile | Value$1

/**
 * This map registers the type of the `data` key of a `VFile`.
 *
 * This type can be augmented to register custom `data` types.
 *
 * @example
 * declare module 'vfile' {
 *   interface DataMap {
 *     // `file.data.name` is typed as `string`
 *     name: string
 *   }
 * }
 */
interface DataMap$1 {
  [emptyObjectSymbol$3]?: never
}

/**
 * Custom info.
 *
 * Known attributes can be added to {@linkcode DataMap}
 */
type Data$5 = Record<string, unknown> & Partial<DataMap$1>

/**
 * Configuration.
 */
interface Options$1 {
  /**
   * Arbitrary fields that will be shallow copied over to the new file.
   */
  [key: string]: unknown
  /**
   * Set `basename` (name).
   */
  basename?: string | null | undefined
  /**
   * Set `cwd` (working directory).
   */
  cwd?: string | null | undefined
  /**
   * Set `data` (associated info).
   */
  data?: Data$5 | null | undefined
  /**
   * Set `dirname` (path w/o basename).
   */
  dirname?: string | null | undefined
  /**
   * Set `extname` (extension with dot).
   */
  extname?: string | null | undefined
  /**
   * Set `history` (paths the file moved between).
   */
  history?: Array<string> | null | undefined
  /**
   * Set `path` (current path).
   */
  path?: URL | string | null | undefined
  /**
   * Set `stem` (name without extension).
   */
  stem?: string | null | undefined
  /**
   * Set `value` (the contents of the file).
   */
  value?: Value$1 | null | undefined
}

/**
 * Contents of the file.
 *
 * Can either be text or a `Uint8Array` structure.
 */
type Value$1 = Uint8Array | string

// See: <https://github.com/sindresorhus/type-fest/blob/main/source/empty-object.d.ts>
declare const emptyObjectSymbol$2: unique symbol

/**
 * Interface of known results from compilers.
 *
 * Normally, compilers result in text ({@linkcode Value} of `vfile`).
 * When you compile to something else, such as a React node (as in,
 * `rehype-react`), you can augment this interface to include that type.
 *
 * ```ts
 * import type {ReactNode} from 'somewhere'
 *
 * declare module 'unified' {
 *   interface CompileResultMap {
 *     // Register a new result (value is used, key should match it).
 *     ReactNode: ReactNode
 *   }
 * }
 *
 * export {} // You may not need this, but it makes sure the file is a module.
 * ```
 *
 * Use {@linkcode CompileResults} to access the values.
 */
interface CompileResultMap$1 {
  // Note: if `Value` from `VFile` is changed, this should too.
  Uint8Array: Uint8Array
  string: string
}

/**
 * Interface of known data that can be supported by all plugins.
 *
 * Typically, options can be given to a specific plugin, but sometimes it makes
 * sense to have information shared with several plugins.
 * For example, a list of HTML elements that are self-closing, which is needed
 * during all phases.
 *
 * To type this, do something like:
 *
 * ```ts
 * declare module 'unified' {
 *   interface Data {
 *     htmlVoidElements?: Array<string> | undefined
 *   }
 * }
 *
 * export {} // You may not need this, but it makes sure the file is a module.
 * ```
 */
interface Data$4 {
  settings?: Settings$2 | undefined
}

/**
 * Interface of known extra options, that can be supported by parser and
 * compilers.
 *
 * This exists so that users can use packages such as `remark`, which configure
 * both parsers and compilers (in this case `remark-parse` and
 * `remark-stringify`), and still provide options for them.
 *
 * When you make parsers or compilers, that could be packaged up together,
 * you should support `this.data('settings')` as input and merge it with
 * explicitly passed `options`.
 * Then, to type it, using `remark-stringify` as an example, do something like:
 *
 * ```ts
 * declare module 'unified' {
 *   interface Settings {
 *     bullet: '*' | '+' | '-'
 *     // …
 *   }
 * }
 *
 * export {} // You may not need this, but it makes sure the file is a module.
 * ```
 */
interface Settings$2 {
  [emptyObjectSymbol$2]?: never
}

/**
 * Ware.
 */
type Middleware = (...input: Array<any>) => any
/**
 * Pipeline.
 */
type Pipeline$2 = {
  /**
   *   Run the pipeline.
   */
  run: Run
  /**
   *   Add middleware.
   */
  use: Use
}
/**
 * Call all middleware.
 *
 * Calls `done` on completion with either an error or the output of the
 * last middleware.
 *
 * > 👉 **Note**: as the length of input defines whether async functions get a
 * > `next` function,
 * > it’s recommended to keep `input` at one value normally.
 */
type Run = (...input: Array<any>) => void
/**
 * Add middleware.
 */
type Use = (fn: Middleware) => Pipeline$2

type Pipeline$1 = Pipeline$2

// See: <https://github.com/sindresorhus/type-fest/blob/main/source/empty-object.d.ts>
declare const emptyObjectSymbol$1: unique symbol

/**
 * Interface of known data that can be supported by all plugins.
 *
 * Typically, options can be given to a specific plugin, but sometimes it makes
 * sense to have information shared with several plugins.
 * For example, a list of HTML elements that are self-closing, which is needed
 * during all phases.
 *
 * To type this, do something like:
 *
 * ```ts
 * declare module 'unified' {
 *   interface Data {
 *     htmlVoidElements?: Array<string> | undefined
 *   }
 * }
 *
 * export {} // You may not need this, but it makes sure the file is a module.
 * ```
 */
interface Data$3 {
  settings?: Settings$1 | undefined
}

/**
 * Interface of known extra options, that can be supported by parser and
 * compilers.
 *
 * This exists so that users can use packages such as `remark`, which configure
 * both parsers and compilers (in this case `remark-parse` and
 * `remark-stringify`), and still provide options for them.
 *
 * When you make parsers or compilers, that could be packaged up together,
 * you should support `this.data('settings')` as input and merge it with
 * explicitly passed `options`.
 * Then, to type it, using `remark-stringify` as an example, do something like:
 *
 * ```ts
 * declare module 'unified' {
 *   interface Settings {
 *     bullet: '*' | '+' | '-'
 *     // …
 *   }
 * }
 *
 * export {} // You may not need this, but it makes sure the file is a module.
 * ```
 */
interface Settings$1 {
  [emptyObjectSymbol$1]?: never
}

declare const CallableInstance: new <Parameters extends unknown[], Result>(property: string | symbol) => (...parameters: Parameters) => Result

/**
 * @template {Node | undefined} [ParseTree=undefined]
 *   Output of `parse` (optional).
 * @template {Node | undefined} [HeadTree=undefined]
 *   Input for `run` (optional).
 * @template {Node | undefined} [TailTree=undefined]
 *   Output for `run` (optional).
 * @template {Node | undefined} [CompileTree=undefined]
 *   Input of `stringify` (optional).
 * @template {CompileResults | undefined} [CompileResult=undefined]
 *   Output of `stringify` (optional).
 * @extends {CallableInstance<[], Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>>}
 */
declare class Processor<
  ParseTree extends unist.Node | undefined = undefined,
  HeadTree extends unist.Node | undefined = undefined,
  TailTree extends unist.Node | undefined = undefined,
  CompileTree extends unist.Node | undefined = undefined,
  CompileResult extends CompileResults | undefined = undefined
> extends CallableInstance<[], Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>> {
  /**
   * Create a processor.
   */
  constructor()
  /**
   * Compiler to use (deprecated).
   *
   * @deprecated
   *   Use `compiler` instead.
   * @type {(
   *   Compiler<
   *     CompileTree extends undefined ? Node : CompileTree,
   *     CompileResult extends undefined ? CompileResults : CompileResult
   *   > |
   *   undefined
   * )}
   */
  Compiler: Compiler<CompileTree extends undefined ? Node$1 : CompileTree, CompileResult extends undefined ? CompileResults : CompileResult> | undefined
  /**
   * Parser to use (deprecated).
   *
   * @deprecated
   *   Use `parser` instead.
   * @type {(
   *   Parser<ParseTree extends undefined ? Node : ParseTree> |
   *   undefined
   * )}
   */
  Parser: Parser<ParseTree extends undefined ? Node$1 : ParseTree> | undefined
  /**
   * Internal list of configured plugins.
   *
   * @deprecated
   *   This is a private internal property and should not be used.
   * @type {Array<PluginTuple<Array<unknown>>>}
   */
  attachers: Array<[plugin: Plugin<unknown[], undefined, undefined>, ...parameters: unknown[]]>
  /**
   * Compiler to use.
   *
   * @type {(
   *   Compiler<
   *     CompileTree extends undefined ? Node : CompileTree,
   *     CompileResult extends undefined ? CompileResults : CompileResult
   *   > |
   *   undefined
   * )}
   */
  compiler: Compiler<CompileTree extends undefined ? Node$1 : CompileTree, CompileResult extends undefined ? CompileResults : CompileResult> | undefined
  /**
   * Internal state to track where we are while freezing.
   *
   * @deprecated
   *   This is a private internal property and should not be used.
   * @type {number}
   */
  freezeIndex: number
  /**
   * Internal state to track whether we’re frozen.
   *
   * @deprecated
   *   This is a private internal property and should not be used.
   * @type {boolean | undefined}
   */
  frozen: boolean | undefined
  /**
   * Internal state.
   *
   * @deprecated
   *   This is a private internal property and should not be used.
   * @type {Data}
   */
  namespace: Data$2
  /**
   * Parser to use.
   *
   * @type {(
   *   Parser<ParseTree extends undefined ? Node : ParseTree> |
   *   undefined
   * )}
   */
  parser: Parser<ParseTree extends undefined ? Node$1 : ParseTree> | undefined
  /**
   * Internal list of configured transformers.
   *
   * @deprecated
   *   This is a private internal property and should not be used.
   * @type {Pipeline}
   */
  transformers: Pipeline
  /**
   * Copy a processor.
   *
   * @deprecated
   *   This is a private internal method and should not be used.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   New *unfrozen* processor ({@linkcode Processor}) that is
   *   configured to work the same as its ancestor.
   *   When the descendant processor is configured in the future it does not
   *   affect the ancestral processor.
   */
  copy(): Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data<Key extends keyof Data$3>(): Data$2
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data<Key extends keyof Data$3>(dataset: Data$2): Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data<Key extends keyof Data$3>(key: Key): Data$3[Key]
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data<Key extends keyof Data$3>(key: Key, value: Data$3[Key]): Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  /**
   * Freeze a processor.
   *
   * Frozen processors are meant to be extended and not to be configured
   * directly.
   *
   * When a processor is frozen it cannot be unfrozen.
   * New processors working the same way can be created by calling the
   * processor.
   *
   * It’s possible to freeze processors explicitly by calling `.freeze()`.
   * Processors freeze automatically when `.parse()`, `.run()`, `.runSync()`,
   * `.stringify()`, `.process()`, or `.processSync()` are called.
   *
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   The current processor.
   */
  freeze(): Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  /**
   * Parse text to a syntax tree.
   *
   * > **Note**: `parse` freezes the processor if not already *frozen*.
   *
   * > **Note**: `parse` performs the parse phase, not the run phase or other
   * > phases.
   *
   * @param {Compatible | undefined} [file]
   *   file to parse (optional); typically `string` or `VFile`; any value
   *   accepted as `x` in `new VFile(x)`.
   * @returns {ParseTree extends undefined ? Node : ParseTree}
   *   Syntax tree representing `file`.
   */
  parse(file?: Compatible | undefined): ParseTree extends undefined ? Node$1 : ParseTree
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(file: Compatible | undefined, done: ProcessCallback<VFileWithOutput<CompileResult>>): undefined
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(file?: Compatible | undefined): Promise<VFileWithOutput<CompileResult>>
  /**
   * Process the given file as configured on the processor.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `processSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `processSync` performs the parse, run, and stringify phases.
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`; any value accepted as
   *   `x` in `new VFile(x)`.
   * @returns {VFileWithOutput<CompileResult>}
   *   The processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  processSync(file?: Compatible | undefined): VFileWithOutput<CompileResult>
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(tree: HeadTree extends undefined ? Node$1 : HeadTree, done: RunCallback<TailTree extends undefined ? Node$1 : TailTree>): undefined
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(
    tree: HeadTree extends undefined ? Node$1 : HeadTree,
    file: Compatible | undefined,
    done: RunCallback<TailTree extends undefined ? Node$1 : TailTree>
  ): undefined
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(tree: HeadTree extends undefined ? Node$1 : HeadTree, file?: Compatible | undefined): Promise<TailTree extends undefined ? Node$1 : TailTree>
  /**
   * Run *transformers* on a syntax tree.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `runSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `runSync` performs the run phase, not other phases.
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {TailTree extends undefined ? Node : TailTree}
   *   Transformed tree.
   */
  runSync(tree: HeadTree extends undefined ? Node$1 : HeadTree, file?: Compatible | undefined): TailTree extends undefined ? Node$1 : TailTree
  /**
   * Compile a syntax tree.
   *
   * > **Note**: `stringify` freezes the processor if not already *frozen*.
   *
   * > **Note**: `stringify` performs the stringify phase, not the run phase
   * > or other phases.
   *
   * @param {CompileTree extends undefined ? Node : CompileTree} tree
   *   Tree to compile.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {CompileResult extends undefined ? Value : CompileResult}
   *   Textual representation of the tree (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most compilers
   *   > return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  stringify(tree: CompileTree extends undefined ? Node$1 : CompileTree, file?: Compatible | undefined): CompileResult extends undefined ? Value : CompileResult
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use<Parameters_1 extends unknown[] = [], Input extends string | unist.Node | undefined = undefined, Output = Input>(
    preset?: Preset | null | undefined
  ): Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use<Parameters_1 extends unknown[] = [], Input extends string | unist.Node | undefined = undefined, Output = Input>(
    list: PluggableList
  ): Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use<Parameters_1 extends unknown[] = [], Input extends string | unist.Node | undefined = undefined, Output = Input>(
    plugin: Plugin<Parameters_1, Input, Output>,
    ...parameters: Parameters_1 | [boolean]
  ): UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>
}
type Pipeline = Pipeline$1
type Node$1 = unist.Node
type Compatible = Compatible$1
type Value = Value$1
type CompileResultMap = CompileResultMap$1
type Data$2 = Data$4
type Settings = Settings$2
/**
 * Acceptable results from compilers.
 *
 * To register custom results, add them to
 * {@linkcode CompileResultMap }.
 */
type CompileResults = CompileResultMap[keyof CompileResultMap]
/**
 * A **compiler** handles the compiling of a syntax tree to something else
 * (in most cases, text) (TypeScript type).
 *
 * It is used in the stringify phase and called with a {@linkcode Node }
 * and {@linkcode VFile } representation of the document to compile.
 * It should return the textual representation of the given tree (typically
 * `string`).
 *
 * > **Note**: unified typically compiles by serializing: most compilers
 * > return `string` (or `Uint8Array`).
 * > Some compilers, such as the one configured with
 * > [`rehype-react`][rehype-react], return other values (in this case, a
 * > React tree).
 * > If you’re using a compiler that doesn’t serialize, expect different
 * > result values.
 * >
 * > To register custom results in TypeScript, add them to
 * > {@linkcode CompileResultMap }.
 *
 * [rehype-react]: https://github.com/rehypejs/rehype-react
 */
type Compiler<Tree extends unist.Node = unist.Node, Result extends CompileResults = CompileResults> = (tree: Tree, file: VFile) => Result
/**
 * A **parser** handles the parsing of text to a syntax tree.
 *
 * It is used in the parse phase and is called with a `string` and
 * {@linkcode VFile } of the document to parse.
 * It must return the syntax tree representation of the given file
 * ({@linkcode Node }).
 */
type Parser<Tree extends unist.Node = unist.Node> = (document: string, file: VFile) => Tree
/**
 * Union of the different ways to add plugins and settings.
 */
type Pluggable = Plugin<Array<any>, any, any> | PluginTuple<Array<any>, any, any> | Preset
/**
 * List of plugins and presets.
 */
type PluggableList = Array<Pluggable>
/**
 * Single plugin.
 *
 * Plugins configure the processors they are applied on in the following
 * ways:
 *
 * *   they change the processor, such as the parser, the compiler, or by
 *   configuring data
 * *   they specify how to handle trees and files
 *
 * In practice, they are functions that can receive options and configure the
 * processor (`this`).
 *
 * > **Note**: plugins are called when the processor is *frozen*, not when
 * > they are applied.
 */
type Plugin<PluginParameters extends unknown[] = [], Input extends string | unist.Node | undefined = unist.Node, Output = Input> = (
  this: Processor,
  ...parameters: PluginParameters
) => Input extends string
  ? Output extends Node$1 | undefined
    ? undefined | void
    : never
  : Output extends CompileResults
    ? Input extends Node$1 | undefined
      ? undefined | void
      : never
    : Transformer<Input extends Node$1 ? Input : Node$1, Output extends Node$1 ? Output : Node$1> | undefined | void
/**
 * Tuple of a plugin and its configuration.
 *
 * The first item is a plugin, the rest are its parameters.
 */
type PluginTuple<TupleParameters extends unknown[] = [], Input extends string | unist.Node | undefined = undefined, Output = undefined> = [
  plugin: Plugin<TupleParameters, Input, Output>,
  ...parameters: TupleParameters
]
/**
 * Sharable configuration.
 *
 * They can contain plugins and settings.
 */
type Preset = {
  /**
   * List of plugins and presets (optional).
   */
  plugins?: PluggableList | undefined
  /**
   * Shared settings for parsers and compilers (optional).
   */
  settings?: Settings | undefined
}
/**
 * Callback called when the process is done.
 *
 * Called with either an error or a result.
 */
type ProcessCallback<File extends VFile = VFile> = (error?: Error | undefined, file?: File | undefined) => undefined
/**
 * Callback called when transformers are done.
 *
 * Called with either an error or results.
 */
type RunCallback<Tree extends unist.Node = unist.Node> = (error?: Error | undefined, tree?: Tree | undefined, file?: VFile | undefined) => undefined
/**
 * Callback passed to transforms.
 *
 * If the signature of a `transformer` accepts a third argument, the
 * transformer may perform asynchronous operations, and must call it.
 */
type TransformCallback<Output extends unist.Node = unist.Node> = (error?: Error | undefined, tree?: Output | undefined, file?: VFile | undefined) => undefined
/**
 * Transformers handle syntax trees and files.
 *
 * They are functions that are called each time a syntax tree and file are
 * passed through the run phase.
 * When an error occurs in them (either because it’s thrown, returned,
 * rejected, or passed to `next`), the process stops.
 *
 * The run phase is handled by [`trough`][trough], see its documentation for
 * the exact semantics of these functions.
 *
 * > **Note**: you should likely ignore `next`: don’t accept it.
 * > it supports callback-style async work.
 * > But promises are likely easier to reason about.
 *
 * [trough]: https://github.com/wooorm/trough#function-fninput-next
 */
type Transformer<Input extends unist.Node = unist.Node, Output extends unist.Node = Input> = (
  tree: Input,
  file: VFile,
  next: TransformCallback<Output>
) =>
  | Promise<Output | undefined | void>
  | Promise<never> // For some reason this is needed separately.
  | Output
  | Error
  | undefined
  | void
/**
 * Create a processor based on the input/output of a {@link Plugin plugin}.
 */
type UsePlugin<
  ParseTree extends unist.Node | undefined,
  HeadTree extends unist.Node | undefined,
  TailTree extends unist.Node | undefined,
  CompileTree extends unist.Node | undefined,
  CompileResult extends CompileResults | undefined,
  Input extends string | unist.Node | undefined,
  Output
> = Input extends string
  ? Output extends Node$1 | undefined
    ? Processor<Output extends undefined ? ParseTree : Output, HeadTree, TailTree, CompileTree, CompileResult>
    : Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
  : Output extends CompileResults
    ? Input extends Node$1 | undefined
      ? Processor<ParseTree, HeadTree, TailTree, Input extends undefined ? CompileTree : Input, Output extends undefined ? CompileResult : Output>
      : Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
    : Input extends Node$1 | undefined
      ? Output extends Node$1 | undefined
        ? Processor<ParseTree, HeadTree extends undefined ? Input : HeadTree, Output extends undefined ? TailTree : Output, CompileTree, CompileResult>
        : Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
      : Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>
/**
 * Type to generate a {@linkcode VFile } corresponding to a compiler result.
 *
 * If a result that is not acceptable on a `VFile` is used, that will
 * be stored on the `result` field of {@linkcode VFile }.
 */
type VFileWithOutput<Result extends CompileResults | undefined> = Result extends Value | undefined
  ? VFile
  : VFile & {
      result: Result
    }

// See: <https://github.com/sindresorhus/type-fest/blob/main/source/empty-object.d.ts>
declare const emptyObjectSymbol: unique symbol

/**
 * This map registers the type of the `data` key of a `VFile`.
 *
 * This type can be augmented to register custom `data` types.
 *
 * @example
 * declare module 'vfile' {
 *   interface DataMap {
 *     // `file.data.name` is typed as `string`
 *     name: string
 *   }
 * }
 */
interface DataMap {
  [emptyObjectSymbol]?: never
}

/**
 * Custom info.
 *
 * Known attributes can be added to {@linkcode DataMap}
 */
type Data$1 = Record<string, unknown> & Partial<DataMap>

type Promisable<T> = T | Promise<T>
/**
 * Markdown options
 */
interface MarkdownOptions {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
  rehypePlugins?: PluggableList
}
/**
 * MDX compiler options
 */
interface MdxOptions extends Omit<CompileOptions, 'outputFormat'> {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Output format to generate.
   * @default 'function-body'
   */
  outputFormat?: CompileOptions['outputFormat']
  /**
   * Minify the output code.
   * @default true
   */
  minify?: boolean
}
declare module 'vfile' {
  interface DataMap {
    /**
     * original data loaded from file
     */
    data: unknown
    /**
     * content without frontmatter
     */
    content: string
    /**
     * content plain text
     */
    plain: string
  }
}
/**
 * File data loader
 */
interface Loader {
  /**
   * File test regexp
   * @example /\.md$/
   */
  test: RegExp
  /**
   * Load file data from file.value
   * @param file vfile
   */
  load: (file: VFile) => Promisable<Data$1>
}
/**
 * Output options
 */
interface Output {
  /**
   * The output directory of the data files (relative to config file).
   * @default '.velite'
   */
  data: string
  /**
   * The directory of the assets (relative to config file),
   * should be served statically by the app
   * `--clean` will automatically clear this directory
   * @default 'public/static'
   */
  assets: string
  /**
   * The public base path of the assets
   * @default '/static/'
   * @example
   * '/' -> '/image.png'
   * '/static/' -> '/static/image.png'
   * './static/' -> './static/image.png'
   * 'https://cdn.example.com/' -> 'https://cdn.example.com/image.png'
   */
  base: '/' | `/${string}/` | `.${string}/` | `${string}:${string}/`
  /**
   * This option determines the name of each output asset.
   * The asset will be written to the directory specified in the `output.assets` option.
   * You can use `[name]`, `[hash]` and `[ext]` template strings with specify length.
   * @default '[name]-[hash:8].[ext]'
   */
  name: string
  /**
   * Whether to clean the output directories before build
   * @default false
   */
  clean: boolean
  /**
   * Output entry file format
   * @default 'esm'
   */
  format: 'esm' | 'cjs'
}
/**
 * Collection options
 */
interface Collection {
  /**
   * Collection name (singular), for types generation
   * @example
   * 'Post'
   */
  name: string
  /**
   * Collection glob pattern, based on `root`
   * @example
   * 'posts/*.md'
   * ['posts/*.md', '!posts/index.md']
   */
  pattern: string | string[]
  /**
   * Whether the schema is single
   * @default false
   */
  single?: boolean
  /**
   * Collection schema
   * @see {@link https://zod.dev}
   * @example
   * s.object({
   *   title: s.string(), // from frontmatter
   *   description: s.string().optional(), // from frontmatter
   *   excerpt: s.string() // from markdown body,
   *   content: s.string() // from markdown body
   * })
   */
  schema: ZodType
}
/**
 * All collections
 */
interface Collections {
  [name: string]: Collection
}
/**
 * Collection Type
 */
type CollectionType<T extends Collections, P extends keyof T> = T[P]['single'] extends true ? T[P]['schema']['_output'] : Array<T[P]['schema']['_output']>
/**
 * All collections result
 */
type Result<T extends Collections> = {
  [P in keyof T]: CollectionType<T, P>
}
/**
 * Hook context
 */
type Context = {
  /**
   * Resolved config
   */
  config: Config
}
/**
 * This interface for plugins extra user config
 * @example
 * declare module 'velite' {
 *   interface PluginConfig {
 *     myPlugin: MyPluginConfig
 *   }
 * }
 */
interface PluginConfig {}
/**
 * Velite user configuration
 */
interface UserConfig<T extends Collections = Collections> extends Partial<PluginConfig> {
  /**
   * The root directory of the contents (relative to config file).
   * @default 'content'
   */
  root?: string
  /**
   * If true, throws error and terminates process if any schema validation fails.
   *
   * @default false
   */
  strict?: boolean
  /**
   * Output configuration
   */
  output?: Partial<Output>
  /**
   * All collections
   */
  collections: T
  /**
   * Custom file loaders, will be merged with built-in loaders (matter, yaml, json)
   * @default []
   */
  loaders?: Loader[]
  /**
   * Global Markdown options
   */
  markdown?: MarkdownOptions
  /**
   * Global MDX options
   */
  mdx?: MdxOptions
  /**
   * Data prepare hook, before write to file
   * @description
   * You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files.
   * return false to prevent the default output to a file if you wanted
   * @param data loaded data
   */
  prepare?: (data: Result<T>, context: Context) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   * @param data loaded data
   */
  complete?: (data: Result<T>, context: Context) => Promisable<void>
}
/**
 * Build Config
 */
interface Config extends Readonly<UserConfig> {
  /**
   * Resolved config file path
   */
  readonly configPath: string
  /**
   * Dependencies of the config file
   */
  readonly configImports: string[]
  /**
   * Global cache (need refresh in rebuild)
   * memory level cache is enough for Velite. and it's easy & efficient.
   * maybe we can use other cache way in the future if needed.
   * but for now, we just need a simple cache.
   */
  readonly cache: Map<string, any>
  /**
   * The root directory of the contents (relative to config file).
   */
  readonly root: string
  /**
   * Output configuration
   */
  readonly output: Output
  /**
   * File loaders
   */
  readonly loaders: Loader[]
}
/**
 * Define a collection (identity function for type inference)
 */
declare const defineCollection: <T extends Collection>(collection: T) => T
/**
 * Define a loader (identity function for type inference)
 */
declare const defineLoader: <T extends Loader>(loader: T) => T
/**
 * Define a schema (identity function for type inference)
 */
declare const defineSchema: <T extends () => ZodType>(fn: T) => T
/**
 * Define config (identity function for type inference)
 */
declare const defineConfig: <T extends Collections>(config: UserConfig<T>) => UserConfig<T>

interface ExcerptOptions {
  /**
   * Excerpt length.
   * @default 260
   */
  length?: number
}

/**
 * Document metadata.
 */
interface Metadata {
  /**
   * Reading time in minutes.
   */
  readingTime: number
  /**
   * Word count.
   */
  wordCount: number
}

// ## Interfaces

/**
 * Info associated with hast nodes by the ecosystem.
 *
 * This space is guaranteed to never be specified by unist or hast.
 * But you can use it in utilities and plugins to store data.
 *
 * This type can be augmented to register custom data.
 * For example:
 *
 * ```ts
 * declare module 'hast' {
 *   interface Data {
 *     // `someNode.data.myId` is typed as `number | undefined`
 *     myId?: number | undefined
 *   }
 * }
 * ```
 */
interface Data extends Data$8 {}

/**
 * Info associated with an element.
 */
interface Properties {
  [PropertyName: string]: boolean | number | string | null | undefined | Array<string | number>
}

// ## Content maps

/**
 * Union of registered hast nodes that can occur in {@link Element}.
 *
 * To register mote custom hast nodes, add them to {@link ElementContentMap}.
 * They will be automatically added here.
 */
type ElementContent = ElementContentMap[keyof ElementContentMap]

/**
 * Registry of all hast nodes that can occur as children of {@link Element}.
 *
 * For a union of all {@link Element} children, see {@link ElementContent}.
 */
interface ElementContentMap {
  comment: Comment
  element: Element
  text: Text
}

/**
 * Union of registered hast nodes that can occur in {@link Root}.
 *
 * To register custom hast nodes, add them to {@link RootContentMap}.
 * They will be automatically added here.
 */
type RootContent = RootContentMap[keyof RootContentMap]

/**
 * Registry of all hast nodes that can occur as children of {@link Root}.
 *
 * > 👉 **Note**: {@link Root} does not need to be an entire document.
 * > it can also be a fragment.
 *
 * For a union of all {@link Root} children, see {@link RootContent}.
 */
interface RootContentMap {
  comment: Comment
  doctype: Doctype
  element: Element
  text: Text
}

/**
 * Union of registered hast nodes.
 *
 * To register custom hast nodes, add them to {@link RootContentMap} and other
 * places where relevant.
 * They will be automatically added here.
 */
type Nodes = Root | RootContent

// ## Abstract nodes

/**
 * Abstract hast node.
 *
 * This interface is supposed to be extended.
 * If you can use {@link Literal} or {@link Parent}, you should.
 * But for example in HTML, a `Doctype` is neither literal nor parent, but
 * still a node.
 *
 * To register custom hast nodes, add them to {@link RootContentMap} and other
 * places where relevant (such as {@link ElementContentMap}).
 *
 * For a union of all registered hast nodes, see {@link Nodes}.
 */
interface Node extends Node$5 {
  /**
   * Info from the ecosystem.
   */
  data?: Data | undefined
}

/**
 * Abstract hast node that contains the smallest possible value.
 *
 * This interface is supposed to be extended if you make custom hast nodes.
 *
 * For a union of all registered hast literals, see {@link Literals}.
 */
interface Literal extends Node {
  /**
   * Plain-text value.
   */
  value: string
}

/**
 * Abstract hast node that contains other hast nodes (*children*).
 *
 * This interface is supposed to be extended if you make custom hast nodes.
 *
 * For a union of all registered hast parents, see {@link Parents}.
 */
interface Parent extends Node {
  /**
   * List of children.
   */
  children: RootContent[]
}

// ## Concrete nodes

/**
 * HTML comment.
 */
interface Comment extends Literal {
  /**
   * Node type of HTML comments in hast.
   */
  type: 'comment'
  /**
   * Data associated with the comment.
   */
  data?: CommentData | undefined
}

/**
 * Info associated with hast comments by the ecosystem.
 */
interface CommentData extends Data {}

/**
 * HTML document type.
 */
interface Doctype extends Node$5 {
  /**
   * Node type of HTML document types in hast.
   */
  type: 'doctype'
  /**
   * Data associated with the doctype.
   */
  data?: DoctypeData | undefined
}

/**
 * Info associated with hast doctypes by the ecosystem.
 */
interface DoctypeData extends Data {}

/**
 * HTML element.
 */
interface Element extends Parent {
  /**
   * Node type of elements.
   */
  type: 'element'
  /**
   * Tag name (such as `'body'`) of the element.
   */
  tagName: string
  /**
   * Info associated with the element.
   */
  properties: Properties
  /**
   * Children of element.
   */
  children: ElementContent[]
  /**
   * When the `tagName` field is `'template'`, a `content` field can be
   * present.
   */
  content?: Root | undefined
  /**
   * Data associated with the element.
   */
  data?: ElementData | undefined
}

/**
 * Info associated with hast elements by the ecosystem.
 */
interface ElementData extends Data {}

/**
 * Document fragment or a whole document.
 *
 * Should be used as the root of a tree and must not be used as a child.
 *
 * Can also be used as the value for the content field on a `'template'` element.
 */
interface Root extends Parent {
  /**
   * Node type of hast root.
   */
  type: 'root'
  /**
   * Children of root.
   */
  children: RootContent[]
  /**
   * Data associated with the hast root.
   */
  data?: RootData | undefined
}

/**
 * Info associated with hast root nodes by the ecosystem.
 */
interface RootData extends Data {}

/**
 * HTML character data (plain text).
 */
interface Text extends Literal {
  /**
   * Node type of HTML character data (plain text) in hast.
   */
  type: 'text'
  /**
   * Data associated with the text.
   */
  data?: TextData | undefined
}

/**
 * Info associated with hast texts by the ecosystem.
 */
interface TextData extends Data {}

/**
 * Image object with metadata & blur image
 */
interface Image {
  /**
   * public url of the image
   */
  src: string
  /**
   * image width
   */
  width: number
  /**
   * image height
   */
  height: number
  /**
   * blurDataURL of the image
   */
  blurDataURL: string
  /**
   * blur image width
   */
  blurWidth: number
  /**
   * blur image height
   */
  blurHeight: number
}
declare const assets: Map<string, string>
/**
 * validate if a url is a relative path
 * @param url url to validate
 * @returns true if the url is a relative path
 */
declare const isRelativePath: (url: string) => boolean
/**
 * get public directory
 * @param buffer image buffer
 * @returns image object with blurDataURL
 */
declare const getImageMetadata: (buffer: Buffer) => Promise<Omit<Image, 'src'> | undefined>
/**
 * process referenced asset of a file
 * @param input relative path of the asset
 * @param from source file path
 * @param filename output filename template
 * @param baseUrl output public base url
 * @param isImage process as image and return image object with blurDataURL
 * @returns reference public url or image object
 */
declare const processAsset: <T extends true | undefined = undefined>(
  input: string,
  from: string,
  filename: string,
  baseUrl: string,
  isImage?: T
) => Promise<T extends true ? Image : string>
type CopyLinkedFilesOptions = Omit<Output, 'data' | 'clean'>
/**
 * rehype (markdown) plugin to copy linked files to public path and replace their urls with public urls
 */
declare const rehypeCopyLinkedFiles: (options: CopyLinkedFilesOptions) => (tree: Root, file: VFile) => Promise<void>
/**
 * remark (mdx) plugin to copy linked files to public path and replace their urls with public urls
 */
declare const remarkCopyLinkedFiles: (options: CopyLinkedFilesOptions) => (tree: Root$1, file: VFile) => Promise<void>

interface ImageOptions {
  /**
   * root path for absolute path, if provided, the value will be processed as an absolute path
   * @default undefined
   */
  absoluteRoot?: string
}

interface FileOptions {
  /**
   * allow non-relative path, if true, the value will be returned directly, if false, the value will be processed as a relative path
   * @default true
   */
  allowNonRelativePath?: boolean
}

declare const s: {
  isodate: () => ZodEffects<ZodEffects<ZodString, string, string>, string, string>
  unique: (by?: string) => ZodEffects<ZodString, string, string>
  slug: (by?: string, reserved?: string[]) => ZodEffects<ZodEffects<ZodString, string, string>, string, string>
  file: ({ allowNonRelativePath }?: FileOptions) => ZodEffects<ZodString, string, string>
  image: ({ absoluteRoot }?: ImageOptions) => ZodEffects<ZodString, Image, string>
  metadata: () => ZodEffects<ZodType<string | undefined, ZodTypeDef, string | undefined>, Metadata, string | undefined>
  excerpt: ({ length }?: ExcerptOptions) => ZodEffects<ZodType<string | undefined, ZodTypeDef, string | undefined>, string, string | undefined>
  markdown: (options?: MarkdownOptions) => ZodEffects<ZodType<string | undefined, ZodTypeDef, string | undefined>, string, string | undefined>
  mdx: (options?: MdxOptions) => ZodEffects<ZodType<string | undefined, ZodTypeDef, string | undefined>, string, string | undefined>
  path: (options?: PathOptions) => ZodEffects<ZodType<string | undefined, ZodTypeDef, string | undefined>, string, string | undefined>
  raw: () => ZodEffects<ZodType<string | undefined, ZodTypeDef, string | undefined>, string, string | undefined>
  toc: <T extends TocOptions>(
    options?: T
  ) => ZodEffects<
    ZodType<string | undefined, ZodTypeDef, string | undefined>,
    T extends {
      original: true
    }
      ? TocTree
      : TocEntry[],
    string | undefined
  >
  setErrorMap(map: ZodErrorMap): void
  getErrorMap(): ZodErrorMap
  defaultErrorMap: ZodErrorMap
  addIssueToContext(ctx: ParseContext, issueData: IssueData): void
  makeIssue: (params: { data: any; path: (string | number)[]; errorMaps: ZodErrorMap[]; issueData: IssueData }) => ZodIssue
  EMPTY_PATH: ParsePath
  ParseStatus: typeof ParseStatus
  INVALID: INVALID
  DIRTY: <T>(value: T) => DIRTY<T>
  OK: <T>(value: T) => OK<T>
  isAborted: (x: ParseReturnType<any>) => x is INVALID
  isDirty: <T>(x: ParseReturnType<T>) => x is OK<T> | DIRTY<T>
  isValid: <T>(x: ParseReturnType<T>) => x is OK<T>
  isAsync: <T>(x: ParseReturnType<T>) => x is AsyncParseReturnType<T>
  util: typeof util
  objectUtil: typeof objectUtil
  ZodParsedType: {
    string: 'string'
    number: 'number'
    bigint: 'bigint'
    boolean: 'boolean'
    symbol: 'symbol'
    undefined: 'undefined'
    object: 'object'
    function: 'function'
    map: 'map'
    nan: 'nan'
    integer: 'integer'
    float: 'float'
    date: 'date'
    null: 'null'
    array: 'array'
    unknown: 'unknown'
    promise: 'promise'
    void: 'void'
    never: 'never'
    set: 'set'
  }
  getParsedType: (data: any) => ZodParsedType
  datetimeRegex(args: { precision?: number | null; offset?: boolean; local?: boolean }): RegExp
  custom<T>(
    check?: (data: any) => any,
    params?:
      | string
      | (Partial<util.Omit<ZodCustomIssue, 'code'>> & {
          fatal?: boolean
        })
      | ((input: any) => Partial<util.Omit<ZodCustomIssue, 'code'>> & {
          fatal?: boolean
        }),
    fatal?: boolean
  ): ZodType<T, ZodTypeDef, T>
  ZodType: typeof ZodType
  ZodString: typeof ZodString
  ZodNumber: typeof ZodNumber
  ZodBigInt: typeof ZodBigInt
  ZodBoolean: typeof ZodBoolean
  ZodDate: typeof ZodDate
  ZodSymbol: typeof ZodSymbol
  ZodUndefined: typeof ZodUndefined
  ZodNull: typeof ZodNull
  ZodAny: typeof ZodAny
  ZodUnknown: typeof ZodUnknown
  ZodNever: typeof ZodNever
  ZodVoid: typeof ZodVoid
  ZodArray: typeof ZodArray
  ZodObject: typeof ZodObject
  ZodUnion: typeof ZodUnion
  ZodDiscriminatedUnion: typeof ZodDiscriminatedUnion
  ZodIntersection: typeof ZodIntersection
  ZodTuple: typeof ZodTuple
  ZodRecord: typeof ZodRecord
  ZodMap: typeof ZodMap
  ZodSet: typeof ZodSet
  ZodFunction: typeof ZodFunction
  ZodLazy: typeof ZodLazy
  ZodLiteral: typeof ZodLiteral
  ZodEnum: typeof ZodEnum
  ZodNativeEnum: typeof ZodNativeEnum
  ZodPromise: typeof ZodPromise
  ZodEffects: typeof ZodEffects
  ZodTransformer: typeof ZodEffects
  ZodOptional: typeof ZodOptional
  ZodNullable: typeof ZodNullable
  ZodDefault: typeof ZodDefault
  ZodCatch: typeof ZodCatch
  ZodNaN: typeof ZodNaN
  BRAND: typeof BRAND
  ZodBranded: typeof ZodBranded
  ZodPipeline: typeof ZodPipeline
  ZodReadonly: typeof ZodReadonly
  Schema: typeof ZodType
  ZodSchema: typeof ZodType
  late: {
    object: <T extends ZodRawShape>(shape: () => T, params?: RawCreateParams) => ZodObject<T, 'strip'>
  }
  ZodFirstPartyTypeKind: typeof ZodFirstPartyTypeKind
  coerce: {
    string: (typeof ZodString)['create']
    number: (typeof ZodNumber)['create']
    boolean: (typeof ZodBoolean)['create']
    bigint: (typeof ZodBigInt)['create']
    date: (typeof ZodDate)['create']
  }
  any: (params?: RawCreateParams) => ZodAny
  array: <T extends ZodTypeAny>(schema: T, params?: RawCreateParams) => ZodArray<T>
  bigint: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodBigInt
  boolean: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodBoolean
  date: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodDate
  discriminatedUnion: typeof ZodDiscriminatedUnion.create
  effect: <I extends ZodTypeAny>(schema: I, effect: Effect<I['_output']>, params?: RawCreateParams) => ZodEffects<I, I['_output']>
  enum: {
    <U extends string, T extends Readonly<[U, ...U[]]>>(values: T, params?: RawCreateParams): ZodEnum<Writeable<T>>
    <U extends string, T extends [U, ...U[]]>(values: T, params?: RawCreateParams): ZodEnum<T>
  }
  function: typeof ZodFunction.create
  instanceof: <T extends abstract new (..._: any[]) => {}>(
    cls: T,
    params?: Partial<util.Omit<ZodCustomIssue, 'code'>> & {
      fatal?: boolean
    }
  ) => ZodType<InstanceType<T>, ZodTypeDef, InstanceType<T>>
  intersection: <T extends ZodTypeAny, U extends ZodTypeAny>(left: T, right: U, params?: RawCreateParams) => ZodIntersection<T, U>
  lazy: <T extends ZodTypeAny>(getter: () => T, params?: RawCreateParams) => ZodLazy<T>
  literal: <T extends Primitive>(value: T, params?: RawCreateParams) => ZodLiteral<T>
  map: <Key extends ZodTypeAny = ZodTypeAny, Value extends ZodTypeAny = ZodTypeAny>(
    keyType: Key,
    valueType: Value,
    params?: RawCreateParams
  ) => ZodMap<Key, Value>
  nan: (params?: RawCreateParams) => ZodNaN
  nativeEnum: <T extends EnumLike>(values: T, params?: RawCreateParams) => ZodNativeEnum<T>
  never: (params?: RawCreateParams) => ZodNever
  null: (params?: RawCreateParams) => ZodNull
  nullable: <T extends ZodTypeAny>(type: T, params?: RawCreateParams) => ZodNullable<T>
  number: (
    params?: RawCreateParams & {
      coerce?: boolean
    }
  ) => ZodNumber
  object: <T extends ZodRawShape>(
    shape: T,
    params?: RawCreateParams
  ) => ZodObject<T, 'strip', ZodTypeAny, objectOutputType<T, ZodTypeAny, 'strip'>, objectInputType<T, ZodTypeAny, 'strip'>>
  oboolean: () => ZodOptional<ZodBoolean>
  onumber: () => ZodOptional<ZodNumber>
  optional: <T extends ZodTypeAny>(type: T, params?: RawCreateParams) => ZodOptional<T>
  ostring: () => ZodOptional<ZodString>
  pipeline: typeof ZodPipeline.create
  preprocess: <I extends ZodTypeAny>(
    preprocess: (arg: unknown, ctx: RefinementCtx) => unknown,
    schema: I,
    params?: RawCreateParams
  ) => ZodEffects<I, I['_output'], unknown>
  promise: <T extends ZodTypeAny>(schema: T, params?: RawCreateParams) => ZodPromise<T>
  record: typeof ZodRecord.create
  set: <Value extends ZodTypeAny = ZodTypeAny>(valueType: Value, params?: RawCreateParams) => ZodSet<Value>
  strictObject: <T extends ZodRawShape>(shape: T, params?: RawCreateParams) => ZodObject<T, 'strict'>
  string: (
    params?: RawCreateParams & {
      coerce?: true
    }
  ) => ZodString
  symbol: (params?: RawCreateParams) => ZodSymbol
  transformer: <I extends ZodTypeAny>(schema: I, effect: Effect<I['_output']>, params?: RawCreateParams) => ZodEffects<I, I['_output']>
  tuple: <T extends [ZodTypeAny, ...ZodTypeAny[]] | []>(schemas: T, params?: RawCreateParams) => ZodTuple<T, null>
  undefined: (params?: RawCreateParams) => ZodUndefined
  union: <T extends Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>>(types: T, params?: RawCreateParams) => ZodUnion<T>
  unknown: (params?: RawCreateParams) => ZodUnknown
  void: (params?: RawCreateParams) => ZodVoid
  NEVER: never
  ZodIssueCode: {
    invalid_type: 'invalid_type'
    invalid_literal: 'invalid_literal'
    custom: 'custom'
    invalid_union: 'invalid_union'
    invalid_union_discriminator: 'invalid_union_discriminator'
    invalid_enum_value: 'invalid_enum_value'
    unrecognized_keys: 'unrecognized_keys'
    invalid_arguments: 'invalid_arguments'
    invalid_return_type: 'invalid_return_type'
    invalid_date: 'invalid_date'
    invalid_string: 'invalid_string'
    too_small: 'too_small'
    too_big: 'too_big'
    invalid_intersection_types: 'invalid_intersection_types'
    not_multiple_of: 'not_multiple_of'
    not_finite: 'not_finite'
  }
  quotelessJson: (obj: any) => string
  ZodError: typeof ZodError
}

declare class VeliteFile extends VFile {
  config: Config
  private _mdast
  private _hast
  private _plain
  constructor({ path, config }: { path: string; config: Config })
  /**
   * Get parsed records from file
   */
  get records(): unknown
  /**
   * Get content of file
   */
  get content(): string | undefined
  /**
   * Get mdast object from cache
   */
  get mdast(): Root$1 | undefined
  /**
   * Get hast object from cache
   */
  get hast(): Nodes | undefined
  /**
   * Get plain text of content from cache
   */
  get plain(): string | undefined
  /**
   * Get meta object from cache
   * @param path file path
   * @returns resolved meta object if exists
   */
  static get(path: string): VeliteFile | undefined
  /**
   * Create meta object from file path
   * @param options meta options
   * @returns resolved meta object
   */
  static create({ path, config }: { path: string; config: Config }): Promise<VeliteFile>
}

declare module './schemas' {
  interface ZodMeta extends VeliteFile {}
}
/**
 * Build options
 */
interface Options {
  /**
   * Specify config file path, relative to cwd
   * if not specified, will try to find `velite.config.{js,ts,mjs,mts,cjs,cts}` in cwd or parent directories
   */
  config?: string
  /**
   * Clean output directories before build
   * @default false
   */
  clean?: boolean
  /**
   * Watch files and rebuild on changes
   * @default false
   */
  watch?: boolean
  /**
   * Log level
   * @default 'info'
   */
  logLevel?: LogLevel
  /**
   * If true, throws error and terminates process if any schema validation fails.
   * @default false
   */
  strict?: boolean
}
/**
 * Build contents
 * @param options build options
 */
declare const build: (options?: Options) => Promise<Record<string, unknown>>

export {
  type Collection,
  type CollectionType,
  type Collections,
  type Config,
  type Context,
  type CopyLinkedFilesOptions,
  type Image,
  type Loader,
  type LogLevel,
  type MarkdownOptions,
  type MdxOptions,
  type Options,
  type Output,
  type PluginConfig,
  type Result,
  ZodType as Schema,
  type UserConfig,
  VeliteFile,
  type ZodMeta,
  ZodType,
  assets,
  build,
  defineCollection,
  defineConfig,
  defineLoader,
  defineSchema,
  getImageMetadata,
  type TypeOf as infer,
  isRelativePath,
  logger,
  processAsset,
  rehypeCopyLinkedFiles,
  remarkCopyLinkedFiles,
  s,
  index as z
}
