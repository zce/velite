import { readFile } from 'fs/promises'
import { createRequire } from 'module'
import { join, relative } from 'path'

import {
  asciiAlpha,
  asciiAlphanumeric,
  asciiControl,
  blankLine,
  classifyCharacter,
  combineExtensions,
  convert,
  custom,
  esm_default,
  EXIT,
  factorySpace,
  find,
  fromMarkdown,
  getImageMetadata,
  html,
  htmlVoidElements,
  isRelativePath,
  markdownLineEnding,
  markdownLineEndingOrSpace,
  markdownSpace,
  normalizeIdentifier,
  ok,
  processAsset,
  raw,
  rehypeCopyLinkedFiles,
  remarkCopyLinkedFiles,
  resolveAll,
  splice,
  stringify,
  stringify2,
  stringType,
  svg,
  toHast,
  toString,
  unicodePunctuation,
  unicodeWhitespace,
  VFile,
  visit,
  visitParents,
  zod_exports,
  zwitch
} from './chunk-TIR7LQKK.js'
import { __commonJS, __toESM } from './chunk-ZWVIC74Y.js'

export {
  VeliteFile,
  assets,
  build,
  defineCollection,
  defineConfig,
  defineLoader,
  defineSchema,
  getImageMetadata,
  isRelativePath,
  logger,
  processAsset,
  rehypeCopyLinkedFiles,
  remarkCopyLinkedFiles,
  zod_exports as z
} from './chunk-TIR7LQKK.js'

createRequire(import.meta.url)

// node_modules/.pnpm/extend@3.0.2/node_modules/extend/index.js
var require_extend = __commonJS({
  'node_modules/.pnpm/extend@3.0.2/node_modules/extend/index.js'(exports, module) {
    var hasOwn = Object.prototype.hasOwnProperty
    var toStr = Object.prototype.toString
    var defineProperty = Object.defineProperty
    var gOPD = Object.getOwnPropertyDescriptor
    var isArray = function isArray2(arr) {
      if (typeof Array.isArray === 'function') {
        return Array.isArray(arr)
      }
      return toStr.call(arr) === '[object Array]'
    }
    var isPlainObject2 = function isPlainObject3(obj) {
      if (!obj || toStr.call(obj) !== '[object Object]') {
        return false
      }
      var hasOwnConstructor = hasOwn.call(obj, 'constructor')
      var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf')
      if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
        return false
      }
      var key2
      for (key2 in obj) {
      }
      return typeof key2 === 'undefined' || hasOwn.call(obj, key2)
    }
    var setProperty = function setProperty2(target, options) {
      if (defineProperty && options.name === '__proto__') {
        defineProperty(target, options.name, {
          enumerable: true,
          configurable: true,
          value: options.newValue,
          writable: true
        })
      } else {
        target[options.name] = options.newValue
      }
    }
    var getProperty = function getProperty2(obj, name) {
      if (name === '__proto__') {
        if (!hasOwn.call(obj, name)) {
          return void 0
        } else if (gOPD) {
          return gOPD(obj, name).value
        }
      }
      return obj[name]
    }
    module.exports = function extend2() {
      var options, name, src, copy, copyIsArray, clone
      var target = arguments[0]
      var i = 1
      var length = arguments.length
      var deep = false
      if (typeof target === 'boolean') {
        deep = target
        target = arguments[1] || {}
        i = 2
      }
      if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
        target = {}
      }
      for (; i < length; ++i) {
        options = arguments[i]
        if (options != null) {
          for (name in options) {
            src = getProperty(target, name)
            copy = getProperty(options, name)
            if (target !== copy) {
              if (deep && copy && (isPlainObject2(copy) || (copyIsArray = isArray(copy)))) {
                if (copyIsArray) {
                  copyIsArray = false
                  clone = src && isArray(src) ? src : []
                } else {
                  clone = src && isPlainObject2(src) ? src : {}
                }
                setProperty(target, { name, newValue: extend2(deep, clone, copy) })
              } else if (typeof copy !== 'undefined') {
                setProperty(target, { name, newValue: copy })
              }
            }
          }
        }
      }
      return target
    }
  }
})

// src/schemas/excerpt.ts
var excerpt = ({ length = 260 } = {}) =>
  custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta, addIssue }) => {
    value = value ?? meta.plain
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return ''
    }
    return value.slice(0, length)
  })

// src/schemas/file.ts
var file = ({ allowNonRelativePath = true } = {}) =>
  stringType().transform(async (value, { meta, addIssue }) => {
    try {
      if (allowNonRelativePath && !isRelativePath(value)) return value
      const { output } = meta.config
      return await processAsset(value, meta.path, output.name, output.base)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addIssue({ fatal: true, code: 'custom', message })
      return null
    }
  })
var image = ({ absoluteRoot } = {}) =>
  stringType().transform(async (value, { meta, addIssue }) => {
    try {
      if (absoluteRoot && /^\//.test(value)) {
        const buffer = await readFile(join(absoluteRoot, value))
        const metadata2 = await getImageMetadata(buffer)
        if (metadata2 == null) throw new Error(`Failed to get image metadata: ${value}`)
        return { src: value, ...metadata2 }
      }
      const { output } = meta.config
      return await processAsset(value, meta.path, output.name, output.base, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addIssue({ fatal: true, code: 'custom', message })
      return null
    }
  })

// src/schemas/isodate.ts
var isodate = () =>
  stringType()
    .refine(value => !isNaN(Date.parse(value)), 'Invalid date string')
    .transform(value => new Date(value).toISOString())

// node_modules/.pnpm/rehype-raw@7.0.0/node_modules/rehype-raw/lib/index.js
function rehypeRaw(options) {
  return function (tree, file2) {
    const result =
      /** @type {Root} */
      raw(tree, { ...options, file: file2 })
    return result
  }
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/core.js
var defaultSubsetRegex = /["&'<>`]/g
var surrogatePairsRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g
var controlCharactersRegex =
  // eslint-disable-next-line no-control-regex, unicorn/no-hex-escape
  /[\x01-\t\v\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g
var regexEscapeRegex = /[|\\{}()[\]^$+*?.]/g
var subsetToRegexCache = /* @__PURE__ */ new WeakMap()
function core(value, options) {
  value = value.replace(options.subset ? charactersToExpressionCached(options.subset) : defaultSubsetRegex, basic)
  if (options.subset || options.escapeOnly) {
    return value
  }
  return value.replace(surrogatePairsRegex, surrogate).replace(controlCharactersRegex, basic)
  function surrogate(pair, index, all3) {
    return options.format((pair.charCodeAt(0) - 55296) * 1024 + pair.charCodeAt(1) - 56320 + 65536, all3.charCodeAt(index + 2), options)
  }
  function basic(character, index, all3) {
    return options.format(character.charCodeAt(0), all3.charCodeAt(index + 1), options)
  }
}
function charactersToExpressionCached(subset) {
  let cached = subsetToRegexCache.get(subset)
  if (!cached) {
    cached = charactersToExpression(subset)
    subsetToRegexCache.set(subset, cached)
  }
  return cached
}
function charactersToExpression(subset) {
  const groups = []
  let index = -1
  while (++index < subset.length) {
    groups.push(subset[index].replace(regexEscapeRegex, '\\$&'))
  }
  return new RegExp('(?:' + groups.join('|') + ')', 'g')
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/to-hexadecimal.js
var hexadecimalRegex = /[\dA-Fa-f]/
function toHexadecimal(code3, next, omit) {
  const value = '&#x' + code3.toString(16).toUpperCase()
  return omit && next && !hexadecimalRegex.test(String.fromCharCode(next)) ? value : value + ';'
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/to-decimal.js
var decimalRegex = /\d/
function toDecimal(code3, next, omit) {
  const value = '&#' + String(code3)
  return omit && next && !decimalRegex.test(String.fromCharCode(next)) ? value : value + ';'
}

// node_modules/.pnpm/character-entities-legacy@3.0.0/node_modules/character-entities-legacy/index.js
var characterEntitiesLegacy = [
  'AElig',
  'AMP',
  'Aacute',
  'Acirc',
  'Agrave',
  'Aring',
  'Atilde',
  'Auml',
  'COPY',
  'Ccedil',
  'ETH',
  'Eacute',
  'Ecirc',
  'Egrave',
  'Euml',
  'GT',
  'Iacute',
  'Icirc',
  'Igrave',
  'Iuml',
  'LT',
  'Ntilde',
  'Oacute',
  'Ocirc',
  'Ograve',
  'Oslash',
  'Otilde',
  'Ouml',
  'QUOT',
  'REG',
  'THORN',
  'Uacute',
  'Ucirc',
  'Ugrave',
  'Uuml',
  'Yacute',
  'aacute',
  'acirc',
  'acute',
  'aelig',
  'agrave',
  'amp',
  'aring',
  'atilde',
  'auml',
  'brvbar',
  'ccedil',
  'cedil',
  'cent',
  'copy',
  'curren',
  'deg',
  'divide',
  'eacute',
  'ecirc',
  'egrave',
  'eth',
  'euml',
  'frac12',
  'frac14',
  'frac34',
  'gt',
  'iacute',
  'icirc',
  'iexcl',
  'igrave',
  'iquest',
  'iuml',
  'laquo',
  'lt',
  'macr',
  'micro',
  'middot',
  'nbsp',
  'not',
  'ntilde',
  'oacute',
  'ocirc',
  'ograve',
  'ordf',
  'ordm',
  'oslash',
  'otilde',
  'ouml',
  'para',
  'plusmn',
  'pound',
  'quot',
  'raquo',
  'reg',
  'sect',
  'shy',
  'sup1',
  'sup2',
  'sup3',
  'szlig',
  'thorn',
  'times',
  'uacute',
  'ucirc',
  'ugrave',
  'uml',
  'uuml',
  'yacute',
  'yen',
  'yuml'
]

// node_modules/.pnpm/character-entities-html4@2.1.0/node_modules/character-entities-html4/index.js
var characterEntitiesHtml4 = {
  nbsp: '\xA0',
  iexcl: '\xA1',
  cent: '\xA2',
  pound: '\xA3',
  curren: '\xA4',
  yen: '\xA5',
  brvbar: '\xA6',
  sect: '\xA7',
  uml: '\xA8',
  copy: '\xA9',
  ordf: '\xAA',
  laquo: '\xAB',
  not: '\xAC',
  shy: '\xAD',
  reg: '\xAE',
  macr: '\xAF',
  deg: '\xB0',
  plusmn: '\xB1',
  sup2: '\xB2',
  sup3: '\xB3',
  acute: '\xB4',
  micro: '\xB5',
  para: '\xB6',
  middot: '\xB7',
  cedil: '\xB8',
  sup1: '\xB9',
  ordm: '\xBA',
  raquo: '\xBB',
  frac14: '\xBC',
  frac12: '\xBD',
  frac34: '\xBE',
  iquest: '\xBF',
  Agrave: '\xC0',
  Aacute: '\xC1',
  Acirc: '\xC2',
  Atilde: '\xC3',
  Auml: '\xC4',
  Aring: '\xC5',
  AElig: '\xC6',
  Ccedil: '\xC7',
  Egrave: '\xC8',
  Eacute: '\xC9',
  Ecirc: '\xCA',
  Euml: '\xCB',
  Igrave: '\xCC',
  Iacute: '\xCD',
  Icirc: '\xCE',
  Iuml: '\xCF',
  ETH: '\xD0',
  Ntilde: '\xD1',
  Ograve: '\xD2',
  Oacute: '\xD3',
  Ocirc: '\xD4',
  Otilde: '\xD5',
  Ouml: '\xD6',
  times: '\xD7',
  Oslash: '\xD8',
  Ugrave: '\xD9',
  Uacute: '\xDA',
  Ucirc: '\xDB',
  Uuml: '\xDC',
  Yacute: '\xDD',
  THORN: '\xDE',
  szlig: '\xDF',
  agrave: '\xE0',
  aacute: '\xE1',
  acirc: '\xE2',
  atilde: '\xE3',
  auml: '\xE4',
  aring: '\xE5',
  aelig: '\xE6',
  ccedil: '\xE7',
  egrave: '\xE8',
  eacute: '\xE9',
  ecirc: '\xEA',
  euml: '\xEB',
  igrave: '\xEC',
  iacute: '\xED',
  icirc: '\xEE',
  iuml: '\xEF',
  eth: '\xF0',
  ntilde: '\xF1',
  ograve: '\xF2',
  oacute: '\xF3',
  ocirc: '\xF4',
  otilde: '\xF5',
  ouml: '\xF6',
  divide: '\xF7',
  oslash: '\xF8',
  ugrave: '\xF9',
  uacute: '\xFA',
  ucirc: '\xFB',
  uuml: '\xFC',
  yacute: '\xFD',
  thorn: '\xFE',
  yuml: '\xFF',
  fnof: '\u0192',
  Alpha: '\u0391',
  Beta: '\u0392',
  Gamma: '\u0393',
  Delta: '\u0394',
  Epsilon: '\u0395',
  Zeta: '\u0396',
  Eta: '\u0397',
  Theta: '\u0398',
  Iota: '\u0399',
  Kappa: '\u039A',
  Lambda: '\u039B',
  Mu: '\u039C',
  Nu: '\u039D',
  Xi: '\u039E',
  Omicron: '\u039F',
  Pi: '\u03A0',
  Rho: '\u03A1',
  Sigma: '\u03A3',
  Tau: '\u03A4',
  Upsilon: '\u03A5',
  Phi: '\u03A6',
  Chi: '\u03A7',
  Psi: '\u03A8',
  Omega: '\u03A9',
  alpha: '\u03B1',
  beta: '\u03B2',
  gamma: '\u03B3',
  delta: '\u03B4',
  epsilon: '\u03B5',
  zeta: '\u03B6',
  eta: '\u03B7',
  theta: '\u03B8',
  iota: '\u03B9',
  kappa: '\u03BA',
  lambda: '\u03BB',
  mu: '\u03BC',
  nu: '\u03BD',
  xi: '\u03BE',
  omicron: '\u03BF',
  pi: '\u03C0',
  rho: '\u03C1',
  sigmaf: '\u03C2',
  sigma: '\u03C3',
  tau: '\u03C4',
  upsilon: '\u03C5',
  phi: '\u03C6',
  chi: '\u03C7',
  psi: '\u03C8',
  omega: '\u03C9',
  thetasym: '\u03D1',
  upsih: '\u03D2',
  piv: '\u03D6',
  bull: '\u2022',
  hellip: '\u2026',
  prime: '\u2032',
  Prime: '\u2033',
  oline: '\u203E',
  frasl: '\u2044',
  weierp: '\u2118',
  image: '\u2111',
  real: '\u211C',
  trade: '\u2122',
  alefsym: '\u2135',
  larr: '\u2190',
  uarr: '\u2191',
  rarr: '\u2192',
  darr: '\u2193',
  harr: '\u2194',
  crarr: '\u21B5',
  lArr: '\u21D0',
  uArr: '\u21D1',
  rArr: '\u21D2',
  dArr: '\u21D3',
  hArr: '\u21D4',
  forall: '\u2200',
  part: '\u2202',
  exist: '\u2203',
  empty: '\u2205',
  nabla: '\u2207',
  isin: '\u2208',
  notin: '\u2209',
  ni: '\u220B',
  prod: '\u220F',
  sum: '\u2211',
  minus: '\u2212',
  lowast: '\u2217',
  radic: '\u221A',
  prop: '\u221D',
  infin: '\u221E',
  ang: '\u2220',
  and: '\u2227',
  or: '\u2228',
  cap: '\u2229',
  cup: '\u222A',
  int: '\u222B',
  there4: '\u2234',
  sim: '\u223C',
  cong: '\u2245',
  asymp: '\u2248',
  ne: '\u2260',
  equiv: '\u2261',
  le: '\u2264',
  ge: '\u2265',
  sub: '\u2282',
  sup: '\u2283',
  nsub: '\u2284',
  sube: '\u2286',
  supe: '\u2287',
  oplus: '\u2295',
  otimes: '\u2297',
  perp: '\u22A5',
  sdot: '\u22C5',
  lceil: '\u2308',
  rceil: '\u2309',
  lfloor: '\u230A',
  rfloor: '\u230B',
  lang: '\u2329',
  rang: '\u232A',
  loz: '\u25CA',
  spades: '\u2660',
  clubs: '\u2663',
  hearts: '\u2665',
  diams: '\u2666',
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  OElig: '\u0152',
  oelig: '\u0153',
  Scaron: '\u0160',
  scaron: '\u0161',
  Yuml: '\u0178',
  circ: '\u02C6',
  tilde: '\u02DC',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  zwnj: '\u200C',
  zwj: '\u200D',
  lrm: '\u200E',
  rlm: '\u200F',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  sbquo: '\u201A',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bdquo: '\u201E',
  dagger: '\u2020',
  Dagger: '\u2021',
  permil: '\u2030',
  lsaquo: '\u2039',
  rsaquo: '\u203A',
  euro: '\u20AC'
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/constant/dangerous.js
var dangerous = ['cent', 'copy', 'divide', 'gt', 'lt', 'not', 'para', 'times']

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/to-named.js
var own = {}.hasOwnProperty
var characters = {}
var key
for (key in characterEntitiesHtml4) {
  if (own.call(characterEntitiesHtml4, key)) {
    characters[characterEntitiesHtml4[key]] = key
  }
}
var notAlphanumericRegex = /[^\dA-Za-z]/
function toNamed(code3, next, omit, attribute) {
  const character = String.fromCharCode(code3)
  if (own.call(characters, character)) {
    const name = characters[character]
    const value = '&' + name
    if (
      omit &&
      characterEntitiesLegacy.includes(name) &&
      !dangerous.includes(name) &&
      (!attribute || (next && next !== 61 && notAlphanumericRegex.test(String.fromCharCode(next))))
    ) {
      return value
    }
    return value + ';'
  }
  return ''
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/util/format-smart.js
function formatSmart(code3, next, options) {
  let numeric = toHexadecimal(code3, next, options.omitOptionalSemicolons)
  let named
  if (options.useNamedReferences || options.useShortestReferences) {
    named = toNamed(code3, next, options.omitOptionalSemicolons, options.attribute)
  }
  if ((options.useShortestReferences || !named) && options.useShortestReferences) {
    const decimal = toDecimal(code3, next, options.omitOptionalSemicolons)
    if (decimal.length < numeric.length) {
      numeric = decimal
    }
  }
  return named && (!options.useShortestReferences || named.length < numeric.length) ? named : numeric
}

// node_modules/.pnpm/stringify-entities@4.0.4/node_modules/stringify-entities/lib/index.js
function stringifyEntities(value, options) {
  return core(value, Object.assign({ format: formatSmart }, options))
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/comment.js
var htmlCommentRegex = /^>|^->|<!--|-->|--!>|<!-$/g
var bogusCommentEntitySubset = ['>']
var commentEntitySubset = ['<', '>']
function comment(node, _1, _2, state) {
  return state.settings.bogusComments
    ? '<?' +
        stringifyEntities(
          node.value,
          Object.assign({}, state.settings.characterReferences, {
            subset: bogusCommentEntitySubset
          })
        ) +
        '>'
    : '<!--' + node.value.replace(htmlCommentRegex, encode) + '-->'
  function encode($0) {
    return stringifyEntities(
      $0,
      Object.assign({}, state.settings.characterReferences, {
        subset: commentEntitySubset
      })
    )
  }
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/doctype.js
function doctype(_1, _2, _3, state) {
  return '<!' + (state.settings.upperDoctype ? 'DOCTYPE' : 'doctype') + (state.settings.tightDoctype ? '' : ' ') + 'html>'
}

// node_modules/.pnpm/ccount@2.0.1/node_modules/ccount/index.js
function ccount(value, character) {
  const source = String(value)
  if (typeof character !== 'string') {
    throw new TypeError('Expected character')
  }
  let count = 0
  let index = source.indexOf(character)
  while (index !== -1) {
    count++
    index = source.indexOf(character, index + character.length)
  }
  return count
}

// node_modules/.pnpm/hast-util-whitespace@3.0.0/node_modules/hast-util-whitespace/lib/index.js
var re = /[ \t\n\f\r]/g
function whitespace(thing) {
  return typeof thing === 'object' ? (thing.type === 'text' ? empty(thing.value) : false) : empty(thing)
}
function empty(value) {
  return value.replace(re, '') === ''
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/util/siblings.js
var siblingAfter = siblings(1)
var siblingBefore = siblings(-1)
var emptyChildren = []
function siblings(increment) {
  return sibling
  function sibling(parent, index, includeWhitespace) {
    const siblings2 = parent ? parent.children : emptyChildren
    let offset = (index || 0) + increment
    let next = siblings2[offset]
    if (!includeWhitespace) {
      while (next && whitespace(next)) {
        offset += increment
        next = siblings2[offset]
      }
    }
    return next
  }
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/omission.js
var own2 = {}.hasOwnProperty
function omission(handlers) {
  return omit
  function omit(node, index, parent) {
    return own2.call(handlers, node.tagName) && handlers[node.tagName](node, index, parent)
  }
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/closing.js
var closing = omission({
  body,
  caption: headOrColgroupOrCaption,
  colgroup: headOrColgroupOrCaption,
  dd,
  dt,
  head: headOrColgroupOrCaption,
  html: html2,
  li,
  optgroup,
  option,
  p,
  rp: rubyElement,
  rt: rubyElement,
  tbody,
  td: cells,
  tfoot,
  th: cells,
  thead,
  tr
})
function headOrColgroupOrCaption(_, index, parent) {
  const next = siblingAfter(parent, index, true)
  return !next || (next.type !== 'comment' && !(next.type === 'text' && whitespace(next.value.charAt(0))))
}
function html2(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || next.type !== 'comment'
}
function body(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || next.type !== 'comment'
}
function p(_, index, parent) {
  const next = siblingAfter(parent, index)
  return next
    ? next.type === 'element' &&
        (next.tagName === 'address' ||
          next.tagName === 'article' ||
          next.tagName === 'aside' ||
          next.tagName === 'blockquote' ||
          next.tagName === 'details' ||
          next.tagName === 'div' ||
          next.tagName === 'dl' ||
          next.tagName === 'fieldset' ||
          next.tagName === 'figcaption' ||
          next.tagName === 'figure' ||
          next.tagName === 'footer' ||
          next.tagName === 'form' ||
          next.tagName === 'h1' ||
          next.tagName === 'h2' ||
          next.tagName === 'h3' ||
          next.tagName === 'h4' ||
          next.tagName === 'h5' ||
          next.tagName === 'h6' ||
          next.tagName === 'header' ||
          next.tagName === 'hgroup' ||
          next.tagName === 'hr' ||
          next.tagName === 'main' ||
          next.tagName === 'menu' ||
          next.tagName === 'nav' ||
          next.tagName === 'ol' ||
          next.tagName === 'p' ||
          next.tagName === 'pre' ||
          next.tagName === 'section' ||
          next.tagName === 'table' ||
          next.tagName === 'ul')
    : !parent || // Confusing parent.
        !(
          parent.type === 'element' &&
          (parent.tagName === 'a' ||
            parent.tagName === 'audio' ||
            parent.tagName === 'del' ||
            parent.tagName === 'ins' ||
            parent.tagName === 'map' ||
            parent.tagName === 'noscript' ||
            parent.tagName === 'video')
        )
}
function li(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && next.tagName === 'li')
}
function dt(_, index, parent) {
  const next = siblingAfter(parent, index)
  return Boolean(next && next.type === 'element' && (next.tagName === 'dt' || next.tagName === 'dd'))
}
function dd(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && (next.tagName === 'dt' || next.tagName === 'dd'))
}
function rubyElement(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && (next.tagName === 'rp' || next.tagName === 'rt'))
}
function optgroup(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && next.tagName === 'optgroup')
}
function option(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && (next.tagName === 'option' || next.tagName === 'optgroup'))
}
function thead(_, index, parent) {
  const next = siblingAfter(parent, index)
  return Boolean(next && next.type === 'element' && (next.tagName === 'tbody' || next.tagName === 'tfoot'))
}
function tbody(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && (next.tagName === 'tbody' || next.tagName === 'tfoot'))
}
function tfoot(_, index, parent) {
  return !siblingAfter(parent, index)
}
function tr(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && next.tagName === 'tr')
}
function cells(_, index, parent) {
  const next = siblingAfter(parent, index)
  return !next || (next.type === 'element' && (next.tagName === 'td' || next.tagName === 'th'))
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/omission/opening.js
var opening = omission({
  body: body2,
  colgroup,
  head,
  html: html3,
  tbody: tbody2
})
function html3(node) {
  const head2 = siblingAfter(node, -1)
  return !head2 || head2.type !== 'comment'
}
function head(node) {
  const seen = /* @__PURE__ */ new Set()
  for (const child2 of node.children) {
    if (child2.type === 'element' && (child2.tagName === 'base' || child2.tagName === 'title')) {
      if (seen.has(child2.tagName)) return false
      seen.add(child2.tagName)
    }
  }
  const child = node.children[0]
  return !child || child.type === 'element'
}
function body2(node) {
  const head2 = siblingAfter(node, -1, true)
  return (
    !head2 ||
    (head2.type !== 'comment' &&
      !(head2.type === 'text' && whitespace(head2.value.charAt(0))) &&
      !(
        head2.type === 'element' &&
        (head2.tagName === 'meta' || head2.tagName === 'link' || head2.tagName === 'script' || head2.tagName === 'style' || head2.tagName === 'template')
      ))
  )
}
function colgroup(node, index, parent) {
  const previous2 = siblingBefore(parent, index)
  const head2 = siblingAfter(node, -1, true)
  if (
    parent &&
    previous2 &&
    previous2.type === 'element' &&
    previous2.tagName === 'colgroup' &&
    closing(previous2, parent.children.indexOf(previous2), parent)
  ) {
    return false
  }
  return Boolean(head2 && head2.type === 'element' && head2.tagName === 'col')
}
function tbody2(node, index, parent) {
  const previous2 = siblingBefore(parent, index)
  const head2 = siblingAfter(node, -1)
  if (
    parent &&
    previous2 &&
    previous2.type === 'element' &&
    (previous2.tagName === 'thead' || previous2.tagName === 'tbody') &&
    closing(previous2, parent.children.indexOf(previous2), parent)
  ) {
    return false
  }
  return Boolean(head2 && head2.type === 'element' && head2.tagName === 'tr')
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/element.js
var constants = {
  // See: <https://html.spec.whatwg.org/#attribute-name-state>.
  name: [
    ['	\n\f\r &/=>'.split(''), '	\n\f\r "&\'/=>`'.split('')],
    [
      `\0	
\f\r "&'/<=>`.split(''),
      '\0	\n\f\r "&\'/<=>`'.split('')
    ]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(unquoted)-state>.
  unquoted: [
    ['	\n\f\r &>'.split(''), '\0	\n\f\r "&\'<=>`'.split('')],
    ['\0	\n\f\r "&\'<=>`'.split(''), '\0	\n\f\r "&\'<=>`'.split('')]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(single-quoted)-state>.
  single: [
    ["&'".split(''), '"&\'`'.split('')],
    ["\0&'".split(''), '\0"&\'`'.split('')]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(double-quoted)-state>.
  double: [
    ['"&'.split(''), '"&\'`'.split('')],
    ['\0"&'.split(''), '\0"&\'`'.split('')]
  ]
}
function element(node, index, parent, state) {
  const schema = state.schema
  const omit = schema.space === 'svg' ? false : state.settings.omitOptionalTags
  let selfClosing = schema.space === 'svg' ? state.settings.closeEmptyElements : state.settings.voids.includes(node.tagName.toLowerCase())
  const parts = []
  let last
  if (schema.space === 'html' && node.tagName === 'svg') {
    state.schema = svg
  }
  const attributes = serializeAttributes(state, node.properties)
  const content = state.all(schema.space === 'html' && node.tagName === 'template' ? node.content : node)
  state.schema = schema
  if (content) selfClosing = false
  if (attributes || !omit || !opening(node, index, parent)) {
    parts.push('<', node.tagName, attributes ? ' ' + attributes : '')
    if (selfClosing && (schema.space === 'svg' || state.settings.closeSelfClosing)) {
      last = attributes.charAt(attributes.length - 1)
      if (!state.settings.tightSelfClosing || last === '/' || (last && last !== '"' && last !== "'")) {
        parts.push(' ')
      }
      parts.push('/')
    }
    parts.push('>')
  }
  parts.push(content)
  if (!selfClosing && (!omit || !closing(node, index, parent))) {
    parts.push('</' + node.tagName + '>')
  }
  return parts.join('')
}
function serializeAttributes(state, properties) {
  const values = []
  let index = -1
  let key2
  if (properties) {
    for (key2 in properties) {
      if (properties[key2] !== null && properties[key2] !== void 0) {
        const value = serializeAttribute(state, key2, properties[key2])
        if (value) values.push(value)
      }
    }
  }
  while (++index < values.length) {
    const last = state.settings.tightAttributes ? values[index].charAt(values[index].length - 1) : void 0
    if (index !== values.length - 1 && last !== '"' && last !== "'") {
      values[index] += ' '
    }
  }
  return values.join('')
}
function serializeAttribute(state, key2, value) {
  const info = find(state.schema, key2)
  const x = state.settings.allowParseErrors && state.schema.space === 'html' ? 0 : 1
  const y = state.settings.allowDangerousCharacters ? 0 : 1
  let quote = state.quote
  let result
  if (info.overloadedBoolean && (value === info.attribute || value === '')) {
    value = true
  } else if ((info.boolean || info.overloadedBoolean) && (typeof value !== 'string' || value === info.attribute || value === '')) {
    value = Boolean(value)
  }
  if (value === null || value === void 0 || value === false || (typeof value === 'number' && Number.isNaN(value))) {
    return ''
  }
  const name = stringifyEntities(
    info.attribute,
    Object.assign({}, state.settings.characterReferences, {
      // Always encode without parse errors in non-HTML.
      subset: constants.name[x][y]
    })
  )
  if (value === true) return name
  value = Array.isArray(value)
    ? (info.commaSeparated ? stringify : stringify2)(value, {
        padLeft: !state.settings.tightCommaSeparatedLists
      })
    : String(value)
  if (state.settings.collapseEmptyAttributes && !value) return name
  if (state.settings.preferUnquoted) {
    result = stringifyEntities(
      value,
      Object.assign({}, state.settings.characterReferences, {
        attribute: true,
        subset: constants.unquoted[x][y]
      })
    )
  }
  if (result !== value) {
    if (state.settings.quoteSmart && ccount(value, quote) > ccount(value, state.alternative)) {
      quote = state.alternative
    }
    result =
      quote +
      stringifyEntities(
        value,
        Object.assign({}, state.settings.characterReferences, {
          // Always encode without parse errors in non-HTML.
          subset: (quote === "'" ? constants.single : constants.double)[x][y],
          attribute: true
        })
      ) +
      quote
  }
  return name + (result ? '=' + result : result)
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/text.js
var textEntitySubset = ['<', '&']
function text(node, _, parent, state) {
  return parent && parent.type === 'element' && (parent.tagName === 'script' || parent.tagName === 'style')
    ? node.value
    : stringifyEntities(
        node.value,
        Object.assign({}, state.settings.characterReferences, {
          subset: textEntitySubset
        })
      )
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/raw.js
function raw2(node, index, parent, state) {
  return state.settings.allowDangerousHtml ? node.value : text(node, index, parent, state)
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/root.js
function root(node, _1, _2, state) {
  return state.all(node)
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/handle/index.js
var handle = zwitch('type', {
  invalid,
  unknown,
  handlers: { comment, doctype, element, raw: raw2, root, text }
})
function invalid(node) {
  throw new Error('Expected node, not `' + node + '`')
}
function unknown(node_) {
  const node =
    /** @type {Nodes} */
    node_
  throw new Error('Cannot compile unknown node `' + node.type + '`')
}

// node_modules/.pnpm/hast-util-to-html@9.0.5/node_modules/hast-util-to-html/lib/index.js
var emptyOptions = {}
var emptyCharacterReferences = {}
var emptyChildren2 = []
function toHtml(tree, options) {
  const options_ = options || emptyOptions
  const quote = options_.quote || '"'
  const alternative = quote === '"' ? "'" : '"'
  if (quote !== '"' && quote !== "'") {
    throw new Error('Invalid quote `' + quote + '`, expected `\'` or `"`')
  }
  const state = {
    one,
    all,
    settings: {
      omitOptionalTags: options_.omitOptionalTags || false,
      allowParseErrors: options_.allowParseErrors || false,
      allowDangerousCharacters: options_.allowDangerousCharacters || false,
      quoteSmart: options_.quoteSmart || false,
      preferUnquoted: options_.preferUnquoted || false,
      tightAttributes: options_.tightAttributes || false,
      upperDoctype: options_.upperDoctype || false,
      tightDoctype: options_.tightDoctype || false,
      bogusComments: options_.bogusComments || false,
      tightCommaSeparatedLists: options_.tightCommaSeparatedLists || false,
      tightSelfClosing: options_.tightSelfClosing || false,
      collapseEmptyAttributes: options_.collapseEmptyAttributes || false,
      allowDangerousHtml: options_.allowDangerousHtml || false,
      voids: options_.voids || htmlVoidElements,
      characterReferences: options_.characterReferences || emptyCharacterReferences,
      closeSelfClosing: options_.closeSelfClosing || false,
      closeEmptyElements: options_.closeEmptyElements || false
    },
    schema: options_.space === 'svg' ? svg : html,
    quote,
    alternative
  }
  return state.one(Array.isArray(tree) ? { type: 'root', children: tree } : tree, void 0, void 0)
}
function one(node, index, parent) {
  return handle(node, index, parent, this)
}
function all(parent) {
  const results = []
  const children = (parent && parent.children) || emptyChildren2
  let index = -1
  while (++index < children.length) {
    results[index] = this.one(children[index], index, parent)
  }
  return results.join('')
}

// node_modules/.pnpm/rehype-stringify@10.0.1/node_modules/rehype-stringify/lib/index.js
function rehypeStringify(options) {
  const self = this
  const settings = { ...self.data('settings'), ...options }
  self.compiler = compiler
  function compiler(tree) {
    return toHtml(tree, settings)
  }
}

// node_modules/.pnpm/escape-string-regexp@5.0.0/node_modules/escape-string-regexp/index.js
function escapeStringRegexp(string) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string')
  }
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

// node_modules/.pnpm/mdast-util-find-and-replace@3.0.2/node_modules/mdast-util-find-and-replace/lib/index.js
function findAndReplace(tree, list2, options) {
  const settings = options || {}
  const ignored = convert(settings.ignore || [])
  const pairs = toPairs(list2)
  let pairIndex = -1
  while (++pairIndex < pairs.length) {
    visitParents(tree, 'text', visitor)
  }
  function visitor(node, parents) {
    let index = -1
    let grandparent
    while (++index < parents.length) {
      const parent = parents[index]
      const siblings2 = grandparent ? grandparent.children : void 0
      if (ignored(parent, siblings2 ? siblings2.indexOf(parent) : void 0, grandparent)) {
        return
      }
      grandparent = parent
    }
    if (grandparent) {
      return handler(node, parents)
    }
  }
  function handler(node, parents) {
    const parent = parents[parents.length - 1]
    const find2 = pairs[pairIndex][0]
    const replace2 = pairs[pairIndex][1]
    let start = 0
    const siblings2 = parent.children
    const index = siblings2.indexOf(node)
    let change = false
    let nodes = []
    find2.lastIndex = 0
    let match = find2.exec(node.value)
    while (match) {
      const position = match.index
      const matchObject = {
        index: match.index,
        input: match.input,
        stack: [...parents, node]
      }
      let value = replace2(...match, matchObject)
      if (typeof value === 'string') {
        value = value.length > 0 ? { type: 'text', value } : void 0
      }
      if (value === false) {
        find2.lastIndex = position + 1
      } else {
        if (start !== position) {
          nodes.push({
            type: 'text',
            value: node.value.slice(start, position)
          })
        }
        if (Array.isArray(value)) {
          nodes.push(...value)
        } else if (value) {
          nodes.push(value)
        }
        start = position + match[0].length
        change = true
      }
      if (!find2.global) {
        break
      }
      match = find2.exec(node.value)
    }
    if (change) {
      if (start < node.value.length) {
        nodes.push({ type: 'text', value: node.value.slice(start) })
      }
      parent.children.splice(index, 1, ...nodes)
    } else {
      nodes = [node]
    }
    return index + nodes.length
  }
}
function toPairs(tupleOrList) {
  const result = []
  if (!Array.isArray(tupleOrList)) {
    throw new TypeError('Expected find and replace tuple or list of tuples')
  }
  const list2 = !tupleOrList[0] || Array.isArray(tupleOrList[0]) ? tupleOrList : [tupleOrList]
  let index = -1
  while (++index < list2.length) {
    const tuple = list2[index]
    result.push([toExpression(tuple[0]), toFunction(tuple[1])])
  }
  return result
}
function toExpression(find2) {
  return typeof find2 === 'string' ? new RegExp(escapeStringRegexp(find2), 'g') : find2
}
function toFunction(replace2) {
  return typeof replace2 === 'function'
    ? replace2
    : function () {
        return replace2
      }
}

// node_modules/.pnpm/mdast-util-gfm-autolink-literal@2.0.1/node_modules/mdast-util-gfm-autolink-literal/lib/index.js
var inConstruct = 'phrasing'
var notInConstruct = ['autolink', 'link', 'image', 'label']
function gfmAutolinkLiteralFromMarkdown() {
  return {
    transforms: [transformGfmAutolinkLiterals],
    enter: {
      literalAutolink: enterLiteralAutolink,
      literalAutolinkEmail: enterLiteralAutolinkValue,
      literalAutolinkHttp: enterLiteralAutolinkValue,
      literalAutolinkWww: enterLiteralAutolinkValue
    },
    exit: {
      literalAutolink: exitLiteralAutolink,
      literalAutolinkEmail: exitLiteralAutolinkEmail,
      literalAutolinkHttp: exitLiteralAutolinkHttp,
      literalAutolinkWww: exitLiteralAutolinkWww
    }
  }
}
function gfmAutolinkLiteralToMarkdown() {
  return {
    unsafe: [
      {
        character: '@',
        before: '[+\\-.\\w]',
        after: '[\\-.\\w]',
        inConstruct,
        notInConstruct
      },
      {
        character: '.',
        before: '[Ww]',
        after: '[\\-.\\w]',
        inConstruct,
        notInConstruct
      },
      {
        character: ':',
        before: '[ps]',
        after: '\\/',
        inConstruct,
        notInConstruct
      }
    ]
  }
}
function enterLiteralAutolink(token) {
  this.enter({ type: 'link', title: null, url: '', children: [] }, token)
}
function enterLiteralAutolinkValue(token) {
  this.config.enter.autolinkProtocol.call(this, token)
}
function exitLiteralAutolinkHttp(token) {
  this.config.exit.autolinkProtocol.call(this, token)
}
function exitLiteralAutolinkWww(token) {
  this.config.exit.data.call(this, token)
  const node = this.stack[this.stack.length - 1]
  ok(node.type === 'link')
  node.url = 'http://' + this.sliceSerialize(token)
}
function exitLiteralAutolinkEmail(token) {
  this.config.exit.autolinkEmail.call(this, token)
}
function exitLiteralAutolink(token) {
  this.exit(token)
}
function transformGfmAutolinkLiterals(tree) {
  findAndReplace(
    tree,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, findUrl],
      [new RegExp('(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)', 'gu'), findEmail]
    ],
    { ignore: ['link', 'linkReference'] }
  )
}
function findUrl(_, protocol, domain2, path3, match) {
  let prefix = ''
  if (!previous(match)) {
    return false
  }
  if (/^w/i.test(protocol)) {
    domain2 = protocol + domain2
    protocol = ''
    prefix = 'http://'
  }
  if (!isCorrectDomain(domain2)) {
    return false
  }
  const parts = splitUrl(domain2 + path3)
  if (!parts[0]) return false
  const result = {
    type: 'link',
    title: null,
    url: prefix + protocol + parts[0],
    children: [{ type: 'text', value: protocol + parts[0] }]
  }
  if (parts[1]) {
    return [result, { type: 'text', value: parts[1] }]
  }
  return result
}
function findEmail(_, atext, label, match) {
  if (
    // Not an expected previous character.
    !previous(match, true) || // Label ends in not allowed character.
    /[-\d_]$/.test(label)
  ) {
    return false
  }
  return {
    type: 'link',
    title: null,
    url: 'mailto:' + atext + '@' + label,
    children: [{ type: 'text', value: atext + '@' + label }]
  }
}
function isCorrectDomain(domain2) {
  const parts = domain2.split('.')
  if (
    parts.length < 2 ||
    (parts[parts.length - 1] && (/_/.test(parts[parts.length - 1]) || !/[a-zA-Z\d]/.test(parts[parts.length - 1]))) ||
    (parts[parts.length - 2] && (/_/.test(parts[parts.length - 2]) || !/[a-zA-Z\d]/.test(parts[parts.length - 2])))
  ) {
    return false
  }
  return true
}
function splitUrl(url) {
  const trailExec = /[!"&'),.:;<>?\]}]+$/.exec(url)
  if (!trailExec) {
    return [url, void 0]
  }
  url = url.slice(0, trailExec.index)
  let trail2 = trailExec[0]
  let closingParenIndex = trail2.indexOf(')')
  const openingParens = ccount(url, '(')
  let closingParens = ccount(url, ')')
  while (closingParenIndex !== -1 && openingParens > closingParens) {
    url += trail2.slice(0, closingParenIndex + 1)
    trail2 = trail2.slice(closingParenIndex + 1)
    closingParenIndex = trail2.indexOf(')')
    closingParens++
  }
  return [url, trail2]
}
function previous(match, email) {
  const code3 = match.input.charCodeAt(match.index - 1)
  return (
    (match.index === 0 || unicodeWhitespace(code3) || unicodePunctuation(code3)) && // If it’s an email, the previous character should not be a slash.
    (!email || code3 !== 47)
  )
}

// node_modules/.pnpm/mdast-util-gfm-footnote@2.1.0/node_modules/mdast-util-gfm-footnote/lib/index.js
footnoteReference.peek = footnoteReferencePeek
function enterFootnoteCallString() {
  this.buffer()
}
function enterFootnoteCall(token) {
  this.enter({ type: 'footnoteReference', identifier: '', label: '' }, token)
}
function enterFootnoteDefinitionLabelString() {
  this.buffer()
}
function enterFootnoteDefinition(token) {
  this.enter({ type: 'footnoteDefinition', identifier: '', label: '', children: [] }, token)
}
function exitFootnoteCallString(token) {
  const label = this.resume()
  const node = this.stack[this.stack.length - 1]
  ok(node.type === 'footnoteReference')
  node.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase()
  node.label = label
}
function exitFootnoteCall(token) {
  this.exit(token)
}
function exitFootnoteDefinitionLabelString(token) {
  const label = this.resume()
  const node = this.stack[this.stack.length - 1]
  ok(node.type === 'footnoteDefinition')
  node.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase()
  node.label = label
}
function exitFootnoteDefinition(token) {
  this.exit(token)
}
function footnoteReferencePeek() {
  return '['
}
function footnoteReference(node, _, state, info) {
  const tracker = state.createTracker(info)
  let value = tracker.move('[^')
  const exit2 = state.enter('footnoteReference')
  const subexit = state.enter('reference')
  value += tracker.move(state.safe(state.associationId(node), { after: ']', before: value }))
  subexit()
  exit2()
  value += tracker.move(']')
  return value
}
function gfmFootnoteFromMarkdown() {
  return {
    enter: {
      gfmFootnoteCallString: enterFootnoteCallString,
      gfmFootnoteCall: enterFootnoteCall,
      gfmFootnoteDefinitionLabelString: enterFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: enterFootnoteDefinition
    },
    exit: {
      gfmFootnoteCallString: exitFootnoteCallString,
      gfmFootnoteCall: exitFootnoteCall,
      gfmFootnoteDefinitionLabelString: exitFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: exitFootnoteDefinition
    }
  }
}
function gfmFootnoteToMarkdown(options) {
  let firstLineBlank = false
  if (options && options.firstLineBlank) {
    firstLineBlank = true
  }
  return {
    handlers: { footnoteDefinition, footnoteReference },
    // This is on by default already.
    unsafe: [{ character: '[', inConstruct: ['label', 'phrasing', 'reference'] }]
  }
  function footnoteDefinition(node, _, state, info) {
    const tracker = state.createTracker(info)
    let value = tracker.move('[^')
    const exit2 = state.enter('footnoteDefinition')
    const subexit = state.enter('label')
    value += tracker.move(state.safe(state.associationId(node), { before: value, after: ']' }))
    subexit()
    value += tracker.move(']:')
    if (node.children && node.children.length > 0) {
      tracker.shift(4)
      value += tracker.move(
        (firstLineBlank ? '\n' : ' ') + state.indentLines(state.containerFlow(node, tracker.current()), firstLineBlank ? mapAll : mapExceptFirst)
      )
    }
    exit2()
    return value
  }
}
function mapExceptFirst(line, index, blank) {
  return index === 0 ? line : mapAll(line, index, blank)
}
function mapAll(line, index, blank) {
  return (blank ? '' : '    ') + line
}

// node_modules/.pnpm/mdast-util-gfm-strikethrough@2.0.0/node_modules/mdast-util-gfm-strikethrough/lib/index.js
var constructsWithoutStrikethrough = ['autolink', 'destinationLiteral', 'destinationRaw', 'reference', 'titleQuote', 'titleApostrophe']
handleDelete.peek = peekDelete
function gfmStrikethroughFromMarkdown() {
  return {
    canContainEols: ['delete'],
    enter: { strikethrough: enterStrikethrough },
    exit: { strikethrough: exitStrikethrough }
  }
}
function gfmStrikethroughToMarkdown() {
  return {
    unsafe: [
      {
        character: '~',
        inConstruct: 'phrasing',
        notInConstruct: constructsWithoutStrikethrough
      }
    ],
    handlers: { delete: handleDelete }
  }
}
function enterStrikethrough(token) {
  this.enter({ type: 'delete', children: [] }, token)
}
function exitStrikethrough(token) {
  this.exit(token)
}
function handleDelete(node, _, state, info) {
  const tracker = state.createTracker(info)
  const exit2 = state.enter('strikethrough')
  let value = tracker.move('~~')
  value += state.containerPhrasing(node, {
    ...tracker.current(),
    before: value,
    after: '~'
  })
  value += tracker.move('~~')
  exit2()
  return value
}
function peekDelete() {
  return '~'
}

// node_modules/.pnpm/markdown-table@3.0.4/node_modules/markdown-table/index.js
function defaultStringLength(value) {
  return value.length
}
function markdownTable(table, options) {
  const settings = options || {}
  const align = (settings.align || []).concat()
  const stringLength = settings.stringLength || defaultStringLength
  const alignments = []
  const cellMatrix = []
  const sizeMatrix = []
  const longestCellByColumn = []
  let mostCellsPerRow = 0
  let rowIndex = -1
  while (++rowIndex < table.length) {
    const row2 = []
    const sizes2 = []
    let columnIndex2 = -1
    if (table[rowIndex].length > mostCellsPerRow) {
      mostCellsPerRow = table[rowIndex].length
    }
    while (++columnIndex2 < table[rowIndex].length) {
      const cell = serialize(table[rowIndex][columnIndex2])
      if (settings.alignDelimiters !== false) {
        const size = stringLength(cell)
        sizes2[columnIndex2] = size
        if (longestCellByColumn[columnIndex2] === void 0 || size > longestCellByColumn[columnIndex2]) {
          longestCellByColumn[columnIndex2] = size
        }
      }
      row2.push(cell)
    }
    cellMatrix[rowIndex] = row2
    sizeMatrix[rowIndex] = sizes2
  }
  let columnIndex = -1
  if (typeof align === 'object' && 'length' in align) {
    while (++columnIndex < mostCellsPerRow) {
      alignments[columnIndex] = toAlignment(align[columnIndex])
    }
  } else {
    const code3 = toAlignment(align)
    while (++columnIndex < mostCellsPerRow) {
      alignments[columnIndex] = code3
    }
  }
  columnIndex = -1
  const row = []
  const sizes = []
  while (++columnIndex < mostCellsPerRow) {
    const code3 = alignments[columnIndex]
    let before = ''
    let after = ''
    if (code3 === 99) {
      before = ':'
      after = ':'
    } else if (code3 === 108) {
      before = ':'
    } else if (code3 === 114) {
      after = ':'
    }
    let size = settings.alignDelimiters === false ? 1 : Math.max(1, longestCellByColumn[columnIndex] - before.length - after.length)
    const cell = before + '-'.repeat(size) + after
    if (settings.alignDelimiters !== false) {
      size = before.length + size + after.length
      if (size > longestCellByColumn[columnIndex]) {
        longestCellByColumn[columnIndex] = size
      }
      sizes[columnIndex] = size
    }
    row[columnIndex] = cell
  }
  cellMatrix.splice(1, 0, row)
  sizeMatrix.splice(1, 0, sizes)
  rowIndex = -1
  const lines = []
  while (++rowIndex < cellMatrix.length) {
    const row2 = cellMatrix[rowIndex]
    const sizes2 = sizeMatrix[rowIndex]
    columnIndex = -1
    const line = []
    while (++columnIndex < mostCellsPerRow) {
      const cell = row2[columnIndex] || ''
      let before = ''
      let after = ''
      if (settings.alignDelimiters !== false) {
        const size = longestCellByColumn[columnIndex] - (sizes2[columnIndex] || 0)
        const code3 = alignments[columnIndex]
        if (code3 === 114) {
          before = ' '.repeat(size)
        } else if (code3 === 99) {
          if (size % 2) {
            before = ' '.repeat(size / 2 + 0.5)
            after = ' '.repeat(size / 2 - 0.5)
          } else {
            before = ' '.repeat(size / 2)
            after = before
          }
        } else {
          after = ' '.repeat(size)
        }
      }
      if (settings.delimiterStart !== false && !columnIndex) {
        line.push('|')
      }
      if (
        settings.padding !== false && // Don’t add the opening space if we’re not aligning and the cell is
        // empty: there will be a closing space.
        !(settings.alignDelimiters === false && cell === '') &&
        (settings.delimiterStart !== false || columnIndex)
      ) {
        line.push(' ')
      }
      if (settings.alignDelimiters !== false) {
        line.push(before)
      }
      line.push(cell)
      if (settings.alignDelimiters !== false) {
        line.push(after)
      }
      if (settings.padding !== false) {
        line.push(' ')
      }
      if (settings.delimiterEnd !== false || columnIndex !== mostCellsPerRow - 1) {
        line.push('|')
      }
    }
    lines.push(settings.delimiterEnd === false ? line.join('').replace(/ +$/, '') : line.join(''))
  }
  return lines.join('\n')
}
function serialize(value) {
  return value === null || value === void 0 ? '' : String(value)
}
function toAlignment(value) {
  const code3 = typeof value === 'string' ? value.codePointAt(0) : 0
  return code3 === 67 || code3 === 99 ? 99 : code3 === 76 || code3 === 108 ? 108 : code3 === 82 || code3 === 114 ? 114 : 0
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/blockquote.js
function blockquote(node, _, state, info) {
  const exit2 = state.enter('blockquote')
  const tracker = state.createTracker(info)
  tracker.move('> ')
  tracker.shift(2)
  const value = state.indentLines(state.containerFlow(node, tracker.current()), map)
  exit2()
  return value
}
function map(line, _, blank) {
  return '>' + (blank ? '' : ' ') + line
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/pattern-in-scope.js
function patternInScope(stack, pattern) {
  return listInScope(stack, pattern.inConstruct, true) && !listInScope(stack, pattern.notInConstruct, false)
}
function listInScope(stack, list2, none) {
  if (typeof list2 === 'string') {
    list2 = [list2]
  }
  if (!list2 || list2.length === 0) {
    return none
  }
  let index = -1
  while (++index < list2.length) {
    if (stack.includes(list2[index])) {
      return true
    }
  }
  return false
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/break.js
function hardBreak(_, _1, state, info) {
  let index = -1
  while (++index < state.unsafe.length) {
    if (state.unsafe[index].character === '\n' && patternInScope(state.stack, state.unsafe[index])) {
      return /[ \t]/.test(info.before) ? '' : ' '
    }
  }
  return '\\\n'
}

// node_modules/.pnpm/longest-streak@3.1.0/node_modules/longest-streak/index.js
function longestStreak(value, substring) {
  const source = String(value)
  let index = source.indexOf(substring)
  let expected = index
  let count = 0
  let max = 0
  if (typeof substring !== 'string') {
    throw new TypeError('Expected substring')
  }
  while (index !== -1) {
    if (index === expected) {
      if (++count > max) {
        max = count
      }
    } else {
      count = 1
    }
    expected = index + substring.length
    index = source.indexOf(substring, expected)
  }
  return max
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-code-as-indented.js
function formatCodeAsIndented(node, state) {
  return Boolean(
    state.options.fences === false &&
      node.value && // If there’s no info…
      !node.lang && // And there’s a non-whitespace character…
      /[^ \r\n]/.test(node.value) && // And the value doesn’t start or end in a blank…
      !/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(node.value)
  )
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-fence.js
function checkFence(state) {
  const marker = state.options.fence || '`'
  if (marker !== '`' && marker !== '~') {
    throw new Error('Cannot serialize code with `' + marker + '` for `options.fence`, expected `` ` `` or `~`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/code.js
function code(node, _, state, info) {
  const marker = checkFence(state)
  const raw4 = node.value || ''
  const suffix = marker === '`' ? 'GraveAccent' : 'Tilde'
  if (formatCodeAsIndented(node, state)) {
    const exit3 = state.enter('codeIndented')
    const value2 = state.indentLines(raw4, map2)
    exit3()
    return value2
  }
  const tracker = state.createTracker(info)
  const sequence = marker.repeat(Math.max(longestStreak(raw4, marker) + 1, 3))
  const exit2 = state.enter('codeFenced')
  let value = tracker.move(sequence)
  if (node.lang) {
    const subexit = state.enter(`codeFencedLang${suffix}`)
    value += tracker.move(
      state.safe(node.lang, {
        before: value,
        after: ' ',
        encode: ['`'],
        ...tracker.current()
      })
    )
    subexit()
  }
  if (node.lang && node.meta) {
    const subexit = state.enter(`codeFencedMeta${suffix}`)
    value += tracker.move(' ')
    value += tracker.move(
      state.safe(node.meta, {
        before: value,
        after: '\n',
        encode: ['`'],
        ...tracker.current()
      })
    )
    subexit()
  }
  value += tracker.move('\n')
  if (raw4) {
    value += tracker.move(raw4 + '\n')
  }
  value += tracker.move(sequence)
  exit2()
  return value
}
function map2(line, _, blank) {
  return (blank ? '' : '    ') + line
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-quote.js
function checkQuote(state) {
  const marker = state.options.quote || '"'
  if (marker !== '"' && marker !== "'") {
    throw new Error('Cannot serialize title with `' + marker + '` for `options.quote`, expected `"`, or `\'`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/definition.js
function definition(node, _, state, info) {
  const quote = checkQuote(state)
  const suffix = quote === '"' ? 'Quote' : 'Apostrophe'
  const exit2 = state.enter('definition')
  let subexit = state.enter('label')
  const tracker = state.createTracker(info)
  let value = tracker.move('[')
  value += tracker.move(
    state.safe(state.associationId(node), {
      before: value,
      after: ']',
      ...tracker.current()
    })
  )
  value += tracker.move(']: ')
  subexit()
  if (
    // If there’s no url, or…
    !node.url || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node.url)
  ) {
    subexit = state.enter('destinationLiteral')
    value += tracker.move('<')
    value += tracker.move(state.safe(node.url, { before: value, after: '>', ...tracker.current() }))
    value += tracker.move('>')
  } else {
    subexit = state.enter('destinationRaw')
    value += tracker.move(
      state.safe(node.url, {
        before: value,
        after: node.title ? ' ' : '\n',
        ...tracker.current()
      })
    )
  }
  subexit()
  if (node.title) {
    subexit = state.enter(`title${suffix}`)
    value += tracker.move(' ' + quote)
    value += tracker.move(
      state.safe(node.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    )
    value += tracker.move(quote)
    subexit()
  }
  exit2()
  return value
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-emphasis.js
function checkEmphasis(state) {
  const marker = state.options.emphasis || '*'
  if (marker !== '*' && marker !== '_') {
    throw new Error('Cannot serialize emphasis with `' + marker + '` for `options.emphasis`, expected `*`, or `_`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/encode-character-reference.js
function encodeCharacterReference(code3) {
  return '&#x' + code3.toString(16).toUpperCase() + ';'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/encode-info.js
function encodeInfo(outside, inside, marker) {
  const outsideKind = classifyCharacter(outside)
  const insideKind = classifyCharacter(inside)
  if (outsideKind === void 0) {
    return insideKind === void 0
      ? // Letter inside:
        // we have to encode *both* letters for `_` as it is looser.
        // it already forms for `*` (and GFMs `~`).
        marker === '_'
        ? { inside: true, outside: true }
        : { inside: false, outside: false }
      : insideKind === 1
        ? // Whitespace inside: encode both (letter, whitespace).
          { inside: true, outside: true }
        : // Punctuation inside: encode outer (letter)
          { inside: false, outside: true }
  }
  if (outsideKind === 1) {
    return insideKind === void 0
      ? // Letter inside: already forms.
        { inside: false, outside: false }
      : insideKind === 1
        ? // Whitespace inside: encode both (whitespace).
          { inside: true, outside: true }
        : // Punctuation inside: already forms.
          { inside: false, outside: false }
  }
  return insideKind === void 0
    ? // Letter inside: already forms.
      { inside: false, outside: false }
    : insideKind === 1
      ? // Whitespace inside: encode inner (whitespace).
        { inside: true, outside: false }
      : // Punctuation inside: already forms.
        { inside: false, outside: false }
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/emphasis.js
emphasis.peek = emphasisPeek
function emphasis(node, _, state, info) {
  const marker = checkEmphasis(state)
  const exit2 = state.enter('emphasis')
  const tracker = state.createTracker(info)
  const before = tracker.move(marker)
  let between = tracker.move(
    state.containerPhrasing(node, {
      after: marker,
      before,
      ...tracker.current()
    })
  )
  const betweenHead = between.charCodeAt(0)
  const open = encodeInfo(info.before.charCodeAt(info.before.length - 1), betweenHead, marker)
  if (open.inside) {
    between = encodeCharacterReference(betweenHead) + between.slice(1)
  }
  const betweenTail = between.charCodeAt(between.length - 1)
  const close = encodeInfo(info.after.charCodeAt(0), betweenTail, marker)
  if (close.inside) {
    between = between.slice(0, -1) + encodeCharacterReference(betweenTail)
  }
  const after = tracker.move(marker)
  exit2()
  state.attentionEncodeSurroundingInfo = {
    after: close.outside,
    before: open.outside
  }
  return before + between + after
}
function emphasisPeek(_, _1, state) {
  return state.options.emphasis || '*'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-heading-as-setext.js
function formatHeadingAsSetext(node, state) {
  let literalWithBreak = false
  visit(node, function (node2) {
    if (('value' in node2 && /\r?\n|\r/.test(node2.value)) || node2.type === 'break') {
      literalWithBreak = true
      return EXIT
    }
  })
  return Boolean((!node.depth || node.depth < 3) && toString(node) && (state.options.setext || literalWithBreak))
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/heading.js
function heading(node, _, state, info) {
  const rank = Math.max(Math.min(6, node.depth || 1), 1)
  const tracker = state.createTracker(info)
  if (formatHeadingAsSetext(node, state)) {
    const exit3 = state.enter('headingSetext')
    const subexit2 = state.enter('phrasing')
    const value2 = state.containerPhrasing(node, {
      ...tracker.current(),
      before: '\n',
      after: '\n'
    })
    subexit2()
    exit3()
    return (
      value2 +
      '\n' +
      (rank === 1 ? '=' : '-').repeat(
        // The whole size…
        value2.length - // Minus the position of the character after the last EOL (or
          // 0 if there is none)…
          (Math.max(value2.lastIndexOf('\r'), value2.lastIndexOf('\n')) + 1)
      )
    )
  }
  const sequence = '#'.repeat(rank)
  const exit2 = state.enter('headingAtx')
  const subexit = state.enter('phrasing')
  tracker.move(sequence + ' ')
  let value = state.containerPhrasing(node, {
    before: '# ',
    after: '\n',
    ...tracker.current()
  })
  if (/^[\t ]/.test(value)) {
    value = encodeCharacterReference(value.charCodeAt(0)) + value.slice(1)
  }
  value = value ? sequence + ' ' + value : sequence
  if (state.options.closeAtx) {
    value += ' ' + sequence
  }
  subexit()
  exit2()
  return value
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/html.js
html4.peek = htmlPeek
function html4(node) {
  return node.value || ''
}
function htmlPeek() {
  return '<'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/image.js
image2.peek = imagePeek
function image2(node, _, state, info) {
  const quote = checkQuote(state)
  const suffix = quote === '"' ? 'Quote' : 'Apostrophe'
  const exit2 = state.enter('image')
  let subexit = state.enter('label')
  const tracker = state.createTracker(info)
  let value = tracker.move('![')
  value += tracker.move(state.safe(node.alt, { before: value, after: ']', ...tracker.current() }))
  value += tracker.move('](')
  subexit()
  if (
    // If there’s no url but there is a title…
    (!node.url && node.title) || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node.url)
  ) {
    subexit = state.enter('destinationLiteral')
    value += tracker.move('<')
    value += tracker.move(state.safe(node.url, { before: value, after: '>', ...tracker.current() }))
    value += tracker.move('>')
  } else {
    subexit = state.enter('destinationRaw')
    value += tracker.move(
      state.safe(node.url, {
        before: value,
        after: node.title ? ' ' : ')',
        ...tracker.current()
      })
    )
  }
  subexit()
  if (node.title) {
    subexit = state.enter(`title${suffix}`)
    value += tracker.move(' ' + quote)
    value += tracker.move(
      state.safe(node.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    )
    value += tracker.move(quote)
    subexit()
  }
  value += tracker.move(')')
  exit2()
  return value
}
function imagePeek() {
  return '!'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/image-reference.js
imageReference.peek = imageReferencePeek
function imageReference(node, _, state, info) {
  const type = node.referenceType
  const exit2 = state.enter('imageReference')
  let subexit = state.enter('label')
  const tracker = state.createTracker(info)
  let value = tracker.move('![')
  const alt = state.safe(node.alt, {
    before: value,
    after: ']',
    ...tracker.current()
  })
  value += tracker.move(alt + '][')
  subexit()
  const stack = state.stack
  state.stack = []
  subexit = state.enter('reference')
  const reference = state.safe(state.associationId(node), {
    before: value,
    after: ']',
    ...tracker.current()
  })
  subexit()
  state.stack = stack
  exit2()
  if (type === 'full' || !alt || alt !== reference) {
    value += tracker.move(reference + ']')
  } else if (type === 'shortcut') {
    value = value.slice(0, -1)
  } else {
    value += tracker.move(']')
  }
  return value
}
function imageReferencePeek() {
  return '!'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/inline-code.js
inlineCode.peek = inlineCodePeek
function inlineCode(node, _, state) {
  let value = node.value || ''
  let sequence = '`'
  let index = -1
  while (new RegExp('(^|[^`])' + sequence + '([^`]|$)').test(value)) {
    sequence += '`'
  }
  if (/[^ \r\n]/.test(value) && ((/^[ \r\n]/.test(value) && /[ \r\n]$/.test(value)) || /^`|`$/.test(value))) {
    value = ' ' + value + ' '
  }
  while (++index < state.unsafe.length) {
    const pattern = state.unsafe[index]
    const expression = state.compilePattern(pattern)
    let match
    if (!pattern.atBreak) continue
    while ((match = expression.exec(value))) {
      let position = match.index
      if (value.charCodeAt(position) === 10 && value.charCodeAt(position - 1) === 13) {
        position--
      }
      value = value.slice(0, position) + ' ' + value.slice(match.index + 1)
    }
  }
  return sequence + value + sequence
}
function inlineCodePeek() {
  return '`'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/format-link-as-autolink.js
function formatLinkAsAutolink(node, state) {
  const raw4 = toString(node)
  return Boolean(
    !state.options.resourceLink && // If there’s a url…
      node.url && // And there’s a no title…
      !node.title && // And the content of `node` is a single text node…
      node.children &&
      node.children.length === 1 &&
      node.children[0].type === 'text' && // And if the url is the same as the content…
      (raw4 === node.url || 'mailto:' + raw4 === node.url) && // And that starts w/ a protocol…
      /^[a-z][a-z+.-]+:/i.test(node.url) && // And that doesn’t contain ASCII control codes (character escapes and
      // references don’t work), space, or angle brackets…
      !/[\0- <>\u007F]/.test(node.url)
  )
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/link.js
link.peek = linkPeek
function link(node, _, state, info) {
  const quote = checkQuote(state)
  const suffix = quote === '"' ? 'Quote' : 'Apostrophe'
  const tracker = state.createTracker(info)
  let exit2
  let subexit
  if (formatLinkAsAutolink(node, state)) {
    const stack = state.stack
    state.stack = []
    exit2 = state.enter('autolink')
    let value2 = tracker.move('<')
    value2 += tracker.move(
      state.containerPhrasing(node, {
        before: value2,
        after: '>',
        ...tracker.current()
      })
    )
    value2 += tracker.move('>')
    exit2()
    state.stack = stack
    return value2
  }
  exit2 = state.enter('link')
  subexit = state.enter('label')
  let value = tracker.move('[')
  value += tracker.move(
    state.containerPhrasing(node, {
      before: value,
      after: '](',
      ...tracker.current()
    })
  )
  value += tracker.move('](')
  subexit()
  if (
    // If there’s no url but there is a title…
    (!node.url && node.title) || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node.url)
  ) {
    subexit = state.enter('destinationLiteral')
    value += tracker.move('<')
    value += tracker.move(state.safe(node.url, { before: value, after: '>', ...tracker.current() }))
    value += tracker.move('>')
  } else {
    subexit = state.enter('destinationRaw')
    value += tracker.move(
      state.safe(node.url, {
        before: value,
        after: node.title ? ' ' : ')',
        ...tracker.current()
      })
    )
  }
  subexit()
  if (node.title) {
    subexit = state.enter(`title${suffix}`)
    value += tracker.move(' ' + quote)
    value += tracker.move(
      state.safe(node.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    )
    value += tracker.move(quote)
    subexit()
  }
  value += tracker.move(')')
  exit2()
  return value
}
function linkPeek(node, _, state) {
  return formatLinkAsAutolink(node, state) ? '<' : '['
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/link-reference.js
linkReference.peek = linkReferencePeek
function linkReference(node, _, state, info) {
  const type = node.referenceType
  const exit2 = state.enter('linkReference')
  let subexit = state.enter('label')
  const tracker = state.createTracker(info)
  let value = tracker.move('[')
  const text4 = state.containerPhrasing(node, {
    before: value,
    after: ']',
    ...tracker.current()
  })
  value += tracker.move(text4 + '][')
  subexit()
  const stack = state.stack
  state.stack = []
  subexit = state.enter('reference')
  const reference = state.safe(state.associationId(node), {
    before: value,
    after: ']',
    ...tracker.current()
  })
  subexit()
  state.stack = stack
  exit2()
  if (type === 'full' || !text4 || text4 !== reference) {
    value += tracker.move(reference + ']')
  } else if (type === 'shortcut') {
    value = value.slice(0, -1)
  } else {
    value += tracker.move(']')
  }
  return value
}
function linkReferencePeek() {
  return '['
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet.js
function checkBullet(state) {
  const marker = state.options.bullet || '*'
  if (marker !== '*' && marker !== '+' && marker !== '-') {
    throw new Error('Cannot serialize items with `' + marker + '` for `options.bullet`, expected `*`, `+`, or `-`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet-other.js
function checkBulletOther(state) {
  const bullet = checkBullet(state)
  const bulletOther = state.options.bulletOther
  if (!bulletOther) {
    return bullet === '*' ? '-' : '*'
  }
  if (bulletOther !== '*' && bulletOther !== '+' && bulletOther !== '-') {
    throw new Error('Cannot serialize items with `' + bulletOther + '` for `options.bulletOther`, expected `*`, `+`, or `-`')
  }
  if (bulletOther === bullet) {
    throw new Error('Expected `bullet` (`' + bullet + '`) and `bulletOther` (`' + bulletOther + '`) to be different')
  }
  return bulletOther
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-bullet-ordered.js
function checkBulletOrdered(state) {
  const marker = state.options.bulletOrdered || '.'
  if (marker !== '.' && marker !== ')') {
    throw new Error('Cannot serialize items with `' + marker + '` for `options.bulletOrdered`, expected `.` or `)`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-rule.js
function checkRule(state) {
  const marker = state.options.rule || '*'
  if (marker !== '*' && marker !== '-' && marker !== '_') {
    throw new Error('Cannot serialize rules with `' + marker + '` for `options.rule`, expected `*`, `-`, or `_`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/list.js
function list(node, parent, state, info) {
  const exit2 = state.enter('list')
  const bulletCurrent = state.bulletCurrent
  let bullet = node.ordered ? checkBulletOrdered(state) : checkBullet(state)
  const bulletOther = node.ordered ? (bullet === '.' ? ')' : '.') : checkBulletOther(state)
  let useDifferentMarker = parent && state.bulletLastUsed ? bullet === state.bulletLastUsed : false
  if (!node.ordered) {
    const firstListItem = node.children ? node.children[0] : void 0
    if (
      // Bullet could be used as a thematic break marker:
      (bullet === '*' || bullet === '-') && // Empty first list item:
      firstListItem &&
      (!firstListItem.children || !firstListItem.children[0]) && // Directly in two other list items:
      state.stack[state.stack.length - 1] === 'list' &&
      state.stack[state.stack.length - 2] === 'listItem' &&
      state.stack[state.stack.length - 3] === 'list' &&
      state.stack[state.stack.length - 4] === 'listItem' && // That are each the first child.
      state.indexStack[state.indexStack.length - 1] === 0 &&
      state.indexStack[state.indexStack.length - 2] === 0 &&
      state.indexStack[state.indexStack.length - 3] === 0
    ) {
      useDifferentMarker = true
    }
    if (checkRule(state) === bullet && firstListItem) {
      let index = -1
      while (++index < node.children.length) {
        const item = node.children[index]
        if (item && item.type === 'listItem' && item.children && item.children[0] && item.children[0].type === 'thematicBreak') {
          useDifferentMarker = true
          break
        }
      }
    }
  }
  if (useDifferentMarker) {
    bullet = bulletOther
  }
  state.bulletCurrent = bullet
  const value = state.containerFlow(node, info)
  state.bulletLastUsed = bullet
  state.bulletCurrent = bulletCurrent
  exit2()
  return value
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-list-item-indent.js
function checkListItemIndent(state) {
  const style = state.options.listItemIndent || 'one'
  if (style !== 'tab' && style !== 'one' && style !== 'mixed') {
    throw new Error('Cannot serialize items with `' + style + '` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`')
  }
  return style
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/list-item.js
function listItem(node, parent, state, info) {
  const listItemIndent = checkListItemIndent(state)
  let bullet = state.bulletCurrent || checkBullet(state)
  if (parent && parent.type === 'list' && parent.ordered) {
    bullet =
      (typeof parent.start === 'number' && parent.start > -1 ? parent.start : 1) +
      (state.options.incrementListMarker === false ? 0 : parent.children.indexOf(node)) +
      bullet
  }
  let size = bullet.length + 1
  if (listItemIndent === 'tab' || (listItemIndent === 'mixed' && ((parent && parent.type === 'list' && parent.spread) || node.spread))) {
    size = Math.ceil(size / 4) * 4
  }
  const tracker = state.createTracker(info)
  tracker.move(bullet + ' '.repeat(size - bullet.length))
  tracker.shift(size)
  const exit2 = state.enter('listItem')
  const value = state.indentLines(state.containerFlow(node, tracker.current()), map3)
  exit2()
  return value
  function map3(line, index, blank) {
    if (index) {
      return (blank ? '' : ' '.repeat(size)) + line
    }
    return (blank ? bullet : bullet + ' '.repeat(size - bullet.length)) + line
  }
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/paragraph.js
function paragraph(node, _, state, info) {
  const exit2 = state.enter('paragraph')
  const subexit = state.enter('phrasing')
  const value = state.containerPhrasing(node, info)
  subexit()
  exit2()
  return value
}

// node_modules/.pnpm/mdast-util-phrasing@4.1.0/node_modules/mdast-util-phrasing/lib/index.js
var phrasing =
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  convert([
    'break',
    'delete',
    'emphasis',
    // To do: next major: removed since footnotes were added to GFM.
    'footnote',
    'footnoteReference',
    'image',
    'imageReference',
    'inlineCode',
    // Enabled by `mdast-util-math`:
    'inlineMath',
    'link',
    'linkReference',
    // Enabled by `mdast-util-mdx`:
    'mdxJsxTextElement',
    // Enabled by `mdast-util-mdx`:
    'mdxTextExpression',
    'strong',
    'text',
    // Enabled by `mdast-util-directive`:
    'textDirective'
  ])

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/root.js
function root2(node, _, state, info) {
  const hasPhrasing = node.children.some(function (d) {
    return phrasing(d)
  })
  const container = hasPhrasing ? state.containerPhrasing : state.containerFlow
  return container.call(state, node, info)
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-strong.js
function checkStrong(state) {
  const marker = state.options.strong || '*'
  if (marker !== '*' && marker !== '_') {
    throw new Error('Cannot serialize strong with `' + marker + '` for `options.strong`, expected `*`, or `_`')
  }
  return marker
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/strong.js
strong.peek = strongPeek
function strong(node, _, state, info) {
  const marker = checkStrong(state)
  const exit2 = state.enter('strong')
  const tracker = state.createTracker(info)
  const before = tracker.move(marker + marker)
  let between = tracker.move(
    state.containerPhrasing(node, {
      after: marker,
      before,
      ...tracker.current()
    })
  )
  const betweenHead = between.charCodeAt(0)
  const open = encodeInfo(info.before.charCodeAt(info.before.length - 1), betweenHead, marker)
  if (open.inside) {
    between = encodeCharacterReference(betweenHead) + between.slice(1)
  }
  const betweenTail = between.charCodeAt(between.length - 1)
  const close = encodeInfo(info.after.charCodeAt(0), betweenTail, marker)
  if (close.inside) {
    between = between.slice(0, -1) + encodeCharacterReference(betweenTail)
  }
  const after = tracker.move(marker + marker)
  exit2()
  state.attentionEncodeSurroundingInfo = {
    after: close.outside,
    before: open.outside
  }
  return before + between + after
}
function strongPeek(_, _1, state) {
  return state.options.strong || '*'
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/text.js
function text2(node, _, state, info) {
  return state.safe(node.value, info)
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/check-rule-repetition.js
function checkRuleRepetition(state) {
  const repetition = state.options.ruleRepetition || 3
  if (repetition < 3) {
    throw new Error('Cannot serialize rules with repetition `' + repetition + '` for `options.ruleRepetition`, expected `3` or more')
  }
  return repetition
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/thematic-break.js
function thematicBreak(_, _1, state) {
  const value = (checkRule(state) + (state.options.ruleSpaces ? ' ' : '')).repeat(checkRuleRepetition(state))
  return state.options.ruleSpaces ? value.slice(0, -1) : value
}

// node_modules/.pnpm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/handle/index.js
var handle2 = {
  blockquote,
  break: hardBreak,
  code,
  definition,
  emphasis,
  hardBreak,
  heading,
  html: html4,
  image: image2,
  imageReference,
  inlineCode,
  link,
  linkReference,
  list,
  listItem,
  paragraph,
  root: root2,
  strong,
  text: text2,
  thematicBreak
}

// node_modules/.pnpm/mdast-util-gfm-table@2.0.0/node_modules/mdast-util-gfm-table/lib/index.js
function gfmTableFromMarkdown() {
  return {
    enter: {
      table: enterTable,
      tableData: enterCell,
      tableHeader: enterCell,
      tableRow: enterRow
    },
    exit: {
      codeText: exitCodeText,
      table: exitTable,
      tableData: exit,
      tableHeader: exit,
      tableRow: exit
    }
  }
}
function enterTable(token) {
  const align = token._align
  ok(align, 'expected `_align` on table')
  this.enter(
    {
      type: 'table',
      align: align.map(function (d) {
        return d === 'none' ? null : d
      }),
      children: []
    },
    token
  )
  this.data.inTable = true
}
function exitTable(token) {
  this.exit(token)
  this.data.inTable = void 0
}
function enterRow(token) {
  this.enter({ type: 'tableRow', children: [] }, token)
}
function exit(token) {
  this.exit(token)
}
function enterCell(token) {
  this.enter({ type: 'tableCell', children: [] }, token)
}
function exitCodeText(token) {
  let value = this.resume()
  if (this.data.inTable) {
    value = value.replace(/\\([\\|])/g, replace)
  }
  const node = this.stack[this.stack.length - 1]
  ok(node.type === 'inlineCode')
  node.value = value
  this.exit(token)
}
function replace($0, $1) {
  return $1 === '|' ? $1 : $0
}
function gfmTableToMarkdown(options) {
  const settings = options || {}
  const padding = settings.tableCellPadding
  const alignDelimiters = settings.tablePipeAlign
  const stringLength = settings.stringLength
  const around = padding ? ' ' : '|'
  return {
    unsafe: [
      { character: '\r', inConstruct: 'tableCell' },
      { character: '\n', inConstruct: 'tableCell' },
      // A pipe, when followed by a tab or space (padding), or a dash or colon
      // (unpadded delimiter row), could result in a table.
      { atBreak: true, character: '|', after: '[	 :-]' },
      // A pipe in a cell must be encoded.
      { character: '|', inConstruct: 'tableCell' },
      // A colon must be followed by a dash, in which case it could start a
      // delimiter row.
      { atBreak: true, character: ':', after: '-' },
      // A delimiter row can also start with a dash, when followed by more
      // dashes, a colon, or a pipe.
      // This is a stricter version than the built in check for lists, thematic
      // breaks, and setex heading underlines though:
      // <https://github.com/syntax-tree/mdast-util-to-markdown/blob/51a2038/lib/unsafe.js#L57>
      { atBreak: true, character: '-', after: '[:|-]' }
    ],
    handlers: {
      inlineCode: inlineCodeWithTable,
      table: handleTable,
      tableCell: handleTableCell,
      tableRow: handleTableRow
    }
  }
  function handleTable(node, _, state, info) {
    return serializeData(handleTableAsData(node, state, info), node.align)
  }
  function handleTableRow(node, _, state, info) {
    const row = handleTableRowAsData(node, state, info)
    const value = serializeData([row])
    return value.slice(0, value.indexOf('\n'))
  }
  function handleTableCell(node, _, state, info) {
    const exit2 = state.enter('tableCell')
    const subexit = state.enter('phrasing')
    const value = state.containerPhrasing(node, {
      ...info,
      before: around,
      after: around
    })
    subexit()
    exit2()
    return value
  }
  function serializeData(matrix, align) {
    return markdownTable(matrix, {
      align,
      // @ts-expect-error: `markdown-table` types should support `null`.
      alignDelimiters,
      // @ts-expect-error: `markdown-table` types should support `null`.
      padding,
      // @ts-expect-error: `markdown-table` types should support `null`.
      stringLength
    })
  }
  function handleTableAsData(node, state, info) {
    const children = node.children
    let index = -1
    const result = []
    const subexit = state.enter('table')
    while (++index < children.length) {
      result[index] = handleTableRowAsData(children[index], state, info)
    }
    subexit()
    return result
  }
  function handleTableRowAsData(node, state, info) {
    const children = node.children
    let index = -1
    const result = []
    const subexit = state.enter('tableRow')
    while (++index < children.length) {
      result[index] = handleTableCell(children[index], node, state, info)
    }
    subexit()
    return result
  }
  function inlineCodeWithTable(node, parent, state) {
    let value = handle2.inlineCode(node, parent, state)
    if (state.stack.includes('tableCell')) {
      value = value.replace(/\|/g, '\\$&')
    }
    return value
  }
}

// node_modules/.pnpm/mdast-util-gfm-task-list-item@2.0.0/node_modules/mdast-util-gfm-task-list-item/lib/index.js
function gfmTaskListItemFromMarkdown() {
  return {
    exit: {
      taskListCheckValueChecked: exitCheck,
      taskListCheckValueUnchecked: exitCheck,
      paragraph: exitParagraphWithTaskListItem
    }
  }
}
function gfmTaskListItemToMarkdown() {
  return {
    unsafe: [{ atBreak: true, character: '-', after: '[:|-]' }],
    handlers: { listItem: listItemWithTaskListItem }
  }
}
function exitCheck(token) {
  const node = this.stack[this.stack.length - 2]
  ok(node.type === 'listItem')
  node.checked = token.type === 'taskListCheckValueChecked'
}
function exitParagraphWithTaskListItem(token) {
  const parent = this.stack[this.stack.length - 2]
  if (parent && parent.type === 'listItem' && typeof parent.checked === 'boolean') {
    const node = this.stack[this.stack.length - 1]
    ok(node.type === 'paragraph')
    const head2 = node.children[0]
    if (head2 && head2.type === 'text') {
      const siblings2 = parent.children
      let index = -1
      let firstParaghraph
      while (++index < siblings2.length) {
        const sibling = siblings2[index]
        if (sibling.type === 'paragraph') {
          firstParaghraph = sibling
          break
        }
      }
      if (firstParaghraph === node) {
        head2.value = head2.value.slice(1)
        if (head2.value.length === 0) {
          node.children.shift()
        } else if (node.position && head2.position && typeof head2.position.start.offset === 'number') {
          head2.position.start.column++
          head2.position.start.offset++
          node.position.start = Object.assign({}, head2.position.start)
        }
      }
    }
  }
  this.exit(token)
}
function listItemWithTaskListItem(node, parent, state, info) {
  const head2 = node.children[0]
  const checkable = typeof node.checked === 'boolean' && head2 && head2.type === 'paragraph'
  const checkbox = '[' + (node.checked ? 'x' : ' ') + '] '
  const tracker = state.createTracker(info)
  if (checkable) {
    tracker.move(checkbox)
  }
  let value = handle2.listItem(node, parent, state, {
    ...info,
    ...tracker.current()
  })
  if (checkable) {
    value = value.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, check)
  }
  return value
  function check($0) {
    return $0 + checkbox
  }
}

// node_modules/.pnpm/mdast-util-gfm@3.1.0/node_modules/mdast-util-gfm/lib/index.js
function gfmFromMarkdown() {
  return [gfmAutolinkLiteralFromMarkdown(), gfmFootnoteFromMarkdown(), gfmStrikethroughFromMarkdown(), gfmTableFromMarkdown(), gfmTaskListItemFromMarkdown()]
}
function gfmToMarkdown(options) {
  return {
    extensions: [
      gfmAutolinkLiteralToMarkdown(),
      gfmFootnoteToMarkdown(options),
      gfmStrikethroughToMarkdown(),
      gfmTableToMarkdown(options),
      gfmTaskListItemToMarkdown()
    ]
  }
}

// node_modules/.pnpm/micromark-extension-gfm-autolink-literal@2.1.0/node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js
var wwwPrefix = {
  tokenize: tokenizeWwwPrefix,
  partial: true
}
var domain = {
  tokenize: tokenizeDomain,
  partial: true
}
var path = {
  tokenize: tokenizePath,
  partial: true
}
var trail = {
  tokenize: tokenizeTrail,
  partial: true
}
var emailDomainDotTrail = {
  tokenize: tokenizeEmailDomainDotTrail,
  partial: true
}
var wwwAutolink = {
  name: 'wwwAutolink',
  tokenize: tokenizeWwwAutolink,
  previous: previousWww
}
var protocolAutolink = {
  name: 'protocolAutolink',
  tokenize: tokenizeProtocolAutolink,
  previous: previousProtocol
}
var emailAutolink = {
  name: 'emailAutolink',
  tokenize: tokenizeEmailAutolink,
  previous: previousEmail
}
var text3 = {}
function gfmAutolinkLiteral() {
  return {
    text: text3
  }
}
var code2 = 48
while (code2 < 123) {
  text3[code2] = emailAutolink
  code2++
  if (code2 === 58) code2 = 65
  else if (code2 === 91) code2 = 97
}
text3[43] = emailAutolink
text3[45] = emailAutolink
text3[46] = emailAutolink
text3[95] = emailAutolink
text3[72] = [emailAutolink, protocolAutolink]
text3[104] = [emailAutolink, protocolAutolink]
text3[87] = [emailAutolink, wwwAutolink]
text3[119] = [emailAutolink, wwwAutolink]
function tokenizeEmailAutolink(effects, ok2, nok) {
  const self = this
  let dot
  let data
  return start
  function start(code3) {
    if (!gfmAtext(code3) || !previousEmail.call(self, self.previous) || previousUnbalanced(self.events)) {
      return nok(code3)
    }
    effects.enter('literalAutolink')
    effects.enter('literalAutolinkEmail')
    return atext(code3)
  }
  function atext(code3) {
    if (gfmAtext(code3)) {
      effects.consume(code3)
      return atext
    }
    if (code3 === 64) {
      effects.consume(code3)
      return emailDomain
    }
    return nok(code3)
  }
  function emailDomain(code3) {
    if (code3 === 46) {
      return effects.check(emailDomainDotTrail, emailDomainAfter, emailDomainDot)(code3)
    }
    if (code3 === 45 || code3 === 95 || asciiAlphanumeric(code3)) {
      data = true
      effects.consume(code3)
      return emailDomain
    }
    return emailDomainAfter(code3)
  }
  function emailDomainDot(code3) {
    effects.consume(code3)
    dot = true
    return emailDomain
  }
  function emailDomainAfter(code3) {
    if (data && dot && asciiAlpha(self.previous)) {
      effects.exit('literalAutolinkEmail')
      effects.exit('literalAutolink')
      return ok2(code3)
    }
    return nok(code3)
  }
}
function tokenizeWwwAutolink(effects, ok2, nok) {
  const self = this
  return wwwStart
  function wwwStart(code3) {
    if ((code3 !== 87 && code3 !== 119) || !previousWww.call(self, self.previous) || previousUnbalanced(self.events)) {
      return nok(code3)
    }
    effects.enter('literalAutolink')
    effects.enter('literalAutolinkWww')
    return effects.check(wwwPrefix, effects.attempt(domain, effects.attempt(path, wwwAfter), nok), nok)(code3)
  }
  function wwwAfter(code3) {
    effects.exit('literalAutolinkWww')
    effects.exit('literalAutolink')
    return ok2(code3)
  }
}
function tokenizeProtocolAutolink(effects, ok2, nok) {
  const self = this
  let buffer = ''
  let seen = false
  return protocolStart
  function protocolStart(code3) {
    if ((code3 === 72 || code3 === 104) && previousProtocol.call(self, self.previous) && !previousUnbalanced(self.events)) {
      effects.enter('literalAutolink')
      effects.enter('literalAutolinkHttp')
      buffer += String.fromCodePoint(code3)
      effects.consume(code3)
      return protocolPrefixInside
    }
    return nok(code3)
  }
  function protocolPrefixInside(code3) {
    if (asciiAlpha(code3) && buffer.length < 5) {
      buffer += String.fromCodePoint(code3)
      effects.consume(code3)
      return protocolPrefixInside
    }
    if (code3 === 58) {
      const protocol = buffer.toLowerCase()
      if (protocol === 'http' || protocol === 'https') {
        effects.consume(code3)
        return protocolSlashesInside
      }
    }
    return nok(code3)
  }
  function protocolSlashesInside(code3) {
    if (code3 === 47) {
      effects.consume(code3)
      if (seen) {
        return afterProtocol
      }
      seen = true
      return protocolSlashesInside
    }
    return nok(code3)
  }
  function afterProtocol(code3) {
    return code3 === null || asciiControl(code3) || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3) || unicodePunctuation(code3)
      ? nok(code3)
      : effects.attempt(domain, effects.attempt(path, protocolAfter), nok)(code3)
  }
  function protocolAfter(code3) {
    effects.exit('literalAutolinkHttp')
    effects.exit('literalAutolink')
    return ok2(code3)
  }
}
function tokenizeWwwPrefix(effects, ok2, nok) {
  let size = 0
  return wwwPrefixInside
  function wwwPrefixInside(code3) {
    if ((code3 === 87 || code3 === 119) && size < 3) {
      size++
      effects.consume(code3)
      return wwwPrefixInside
    }
    if (code3 === 46 && size === 3) {
      effects.consume(code3)
      return wwwPrefixAfter
    }
    return nok(code3)
  }
  function wwwPrefixAfter(code3) {
    return code3 === null ? nok(code3) : ok2(code3)
  }
}
function tokenizeDomain(effects, ok2, nok) {
  let underscoreInLastSegment
  let underscoreInLastLastSegment
  let seen
  return domainInside
  function domainInside(code3) {
    if (code3 === 46 || code3 === 95) {
      return effects.check(trail, domainAfter, domainAtPunctuation)(code3)
    }
    if (code3 === null || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3) || (code3 !== 45 && unicodePunctuation(code3))) {
      return domainAfter(code3)
    }
    seen = true
    effects.consume(code3)
    return domainInside
  }
  function domainAtPunctuation(code3) {
    if (code3 === 95) {
      underscoreInLastSegment = true
    } else {
      underscoreInLastLastSegment = underscoreInLastSegment
      underscoreInLastSegment = void 0
    }
    effects.consume(code3)
    return domainInside
  }
  function domainAfter(code3) {
    if (underscoreInLastLastSegment || underscoreInLastSegment || !seen) {
      return nok(code3)
    }
    return ok2(code3)
  }
}
function tokenizePath(effects, ok2) {
  let sizeOpen = 0
  let sizeClose = 0
  return pathInside
  function pathInside(code3) {
    if (code3 === 40) {
      sizeOpen++
      effects.consume(code3)
      return pathInside
    }
    if (code3 === 41 && sizeClose < sizeOpen) {
      return pathAtPunctuation(code3)
    }
    if (
      code3 === 33 ||
      code3 === 34 ||
      code3 === 38 ||
      code3 === 39 ||
      code3 === 41 ||
      code3 === 42 ||
      code3 === 44 ||
      code3 === 46 ||
      code3 === 58 ||
      code3 === 59 ||
      code3 === 60 ||
      code3 === 63 ||
      code3 === 93 ||
      code3 === 95 ||
      code3 === 126
    ) {
      return effects.check(trail, ok2, pathAtPunctuation)(code3)
    }
    if (code3 === null || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3)) {
      return ok2(code3)
    }
    effects.consume(code3)
    return pathInside
  }
  function pathAtPunctuation(code3) {
    if (code3 === 41) {
      sizeClose++
    }
    effects.consume(code3)
    return pathInside
  }
}
function tokenizeTrail(effects, ok2, nok) {
  return trail2
  function trail2(code3) {
    if (
      code3 === 33 ||
      code3 === 34 ||
      code3 === 39 ||
      code3 === 41 ||
      code3 === 42 ||
      code3 === 44 ||
      code3 === 46 ||
      code3 === 58 ||
      code3 === 59 ||
      code3 === 63 ||
      code3 === 95 ||
      code3 === 126
    ) {
      effects.consume(code3)
      return trail2
    }
    if (code3 === 38) {
      effects.consume(code3)
      return trailCharacterReferenceStart
    }
    if (code3 === 93) {
      effects.consume(code3)
      return trailBracketAfter
    }
    if (
      // `<` is an end.
      code3 === 60 || // So is whitespace.
      code3 === null ||
      markdownLineEndingOrSpace(code3) ||
      unicodeWhitespace(code3)
    ) {
      return ok2(code3)
    }
    return nok(code3)
  }
  function trailBracketAfter(code3) {
    if (code3 === null || code3 === 40 || code3 === 91 || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3)) {
      return ok2(code3)
    }
    return trail2(code3)
  }
  function trailCharacterReferenceStart(code3) {
    return asciiAlpha(code3) ? trailCharacterReferenceInside(code3) : nok(code3)
  }
  function trailCharacterReferenceInside(code3) {
    if (code3 === 59) {
      effects.consume(code3)
      return trail2
    }
    if (asciiAlpha(code3)) {
      effects.consume(code3)
      return trailCharacterReferenceInside
    }
    return nok(code3)
  }
}
function tokenizeEmailDomainDotTrail(effects, ok2, nok) {
  return start
  function start(code3) {
    effects.consume(code3)
    return after
  }
  function after(code3) {
    return asciiAlphanumeric(code3) ? nok(code3) : ok2(code3)
  }
}
function previousWww(code3) {
  return code3 === null || code3 === 40 || code3 === 42 || code3 === 95 || code3 === 91 || code3 === 93 || code3 === 126 || markdownLineEndingOrSpace(code3)
}
function previousProtocol(code3) {
  return !asciiAlpha(code3)
}
function previousEmail(code3) {
  return !(code3 === 47 || gfmAtext(code3))
}
function gfmAtext(code3) {
  return code3 === 43 || code3 === 45 || code3 === 46 || code3 === 95 || asciiAlphanumeric(code3)
}
function previousUnbalanced(events) {
  let index = events.length
  let result = false
  while (index--) {
    const token = events[index][1]
    if ((token.type === 'labelLink' || token.type === 'labelImage') && !token._balanced) {
      result = true
      break
    }
    if (token._gfmAutolinkLiteralWalkedInto) {
      result = false
      break
    }
  }
  if (events.length > 0 && !result) {
    events[events.length - 1][1]._gfmAutolinkLiteralWalkedInto = true
  }
  return result
}

// node_modules/.pnpm/micromark-extension-gfm-footnote@2.1.0/node_modules/micromark-extension-gfm-footnote/lib/syntax.js
var indent = {
  tokenize: tokenizeIndent,
  partial: true
}
function gfmFootnote() {
  return {
    document: {
      [91]: {
        name: 'gfmFootnoteDefinition',
        tokenize: tokenizeDefinitionStart,
        continuation: {
          tokenize: tokenizeDefinitionContinuation
        },
        exit: gfmFootnoteDefinitionEnd
      }
    },
    text: {
      [91]: {
        name: 'gfmFootnoteCall',
        tokenize: tokenizeGfmFootnoteCall
      },
      [93]: {
        name: 'gfmPotentialFootnoteCall',
        add: 'after',
        tokenize: tokenizePotentialGfmFootnoteCall,
        resolveTo: resolveToPotentialGfmFootnoteCall
      }
    }
  }
}
function tokenizePotentialGfmFootnoteCall(effects, ok2, nok) {
  const self = this
  let index = self.events.length
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = [])
  let labelStart
  while (index--) {
    const token = self.events[index][1]
    if (token.type === 'labelImage') {
      labelStart = token
      break
    }
    if (token.type === 'gfmFootnoteCall' || token.type === 'labelLink' || token.type === 'label' || token.type === 'image' || token.type === 'link') {
      break
    }
  }
  return start
  function start(code3) {
    if (!labelStart || !labelStart._balanced) {
      return nok(code3)
    }
    const id = normalizeIdentifier(
      self.sliceSerialize({
        start: labelStart.end,
        end: self.now()
      })
    )
    if (id.codePointAt(0) !== 94 || !defined.includes(id.slice(1))) {
      return nok(code3)
    }
    effects.enter('gfmFootnoteCallLabelMarker')
    effects.consume(code3)
    effects.exit('gfmFootnoteCallLabelMarker')
    return ok2(code3)
  }
}
function resolveToPotentialGfmFootnoteCall(events, context) {
  let index = events.length
  while (index--) {
    if (events[index][1].type === 'labelImage' && events[index][0] === 'enter') {
      events[index][1]
      break
    }
  }
  events[index + 1][1].type = 'data'
  events[index + 3][1].type = 'gfmFootnoteCallLabelMarker'
  const call = {
    type: 'gfmFootnoteCall',
    start: Object.assign({}, events[index + 3][1].start),
    end: Object.assign({}, events[events.length - 1][1].end)
  }
  const marker = {
    type: 'gfmFootnoteCallMarker',
    start: Object.assign({}, events[index + 3][1].end),
    end: Object.assign({}, events[index + 3][1].end)
  }
  marker.end.column++
  marker.end.offset++
  marker.end._bufferIndex++
  const string = {
    type: 'gfmFootnoteCallString',
    start: Object.assign({}, marker.end),
    end: Object.assign({}, events[events.length - 1][1].start)
  }
  const chunk = {
    type: 'chunkString',
    contentType: 'string',
    start: Object.assign({}, string.start),
    end: Object.assign({}, string.end)
  }
  const replacement = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    events[index + 1],
    events[index + 2],
    ['enter', call, context],
    // The `[`
    events[index + 3],
    events[index + 4],
    // The `^`.
    ['enter', marker, context],
    ['exit', marker, context],
    // Everything in between.
    ['enter', string, context],
    ['enter', chunk, context],
    ['exit', chunk, context],
    ['exit', string, context],
    // The ending (`]`, properly parsed and labelled).
    events[events.length - 2],
    events[events.length - 1],
    ['exit', call, context]
  ]
  events.splice(index, events.length - index + 1, ...replacement)
  return events
}
function tokenizeGfmFootnoteCall(effects, ok2, nok) {
  const self = this
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = [])
  let size = 0
  let data
  return start
  function start(code3) {
    effects.enter('gfmFootnoteCall')
    effects.enter('gfmFootnoteCallLabelMarker')
    effects.consume(code3)
    effects.exit('gfmFootnoteCallLabelMarker')
    return callStart
  }
  function callStart(code3) {
    if (code3 !== 94) return nok(code3)
    effects.enter('gfmFootnoteCallMarker')
    effects.consume(code3)
    effects.exit('gfmFootnoteCallMarker')
    effects.enter('gfmFootnoteCallString')
    effects.enter('chunkString').contentType = 'string'
    return callData
  }
  function callData(code3) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      (code3 === 93 && !data) || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code3 === null ||
      code3 === 91 ||
      markdownLineEndingOrSpace(code3)
    ) {
      return nok(code3)
    }
    if (code3 === 93) {
      effects.exit('chunkString')
      const token = effects.exit('gfmFootnoteCallString')
      if (!defined.includes(normalizeIdentifier(self.sliceSerialize(token)))) {
        return nok(code3)
      }
      effects.enter('gfmFootnoteCallLabelMarker')
      effects.consume(code3)
      effects.exit('gfmFootnoteCallLabelMarker')
      effects.exit('gfmFootnoteCall')
      return ok2
    }
    if (!markdownLineEndingOrSpace(code3)) {
      data = true
    }
    size++
    effects.consume(code3)
    return code3 === 92 ? callEscape : callData
  }
  function callEscape(code3) {
    if (code3 === 91 || code3 === 92 || code3 === 93) {
      effects.consume(code3)
      size++
      return callData
    }
    return callData(code3)
  }
}
function tokenizeDefinitionStart(effects, ok2, nok) {
  const self = this
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = [])
  let identifier
  let size = 0
  let data
  return start
  function start(code3) {
    effects.enter('gfmFootnoteDefinition')._container = true
    effects.enter('gfmFootnoteDefinitionLabel')
    effects.enter('gfmFootnoteDefinitionLabelMarker')
    effects.consume(code3)
    effects.exit('gfmFootnoteDefinitionLabelMarker')
    return labelAtMarker
  }
  function labelAtMarker(code3) {
    if (code3 === 94) {
      effects.enter('gfmFootnoteDefinitionMarker')
      effects.consume(code3)
      effects.exit('gfmFootnoteDefinitionMarker')
      effects.enter('gfmFootnoteDefinitionLabelString')
      effects.enter('chunkString').contentType = 'string'
      return labelInside
    }
    return nok(code3)
  }
  function labelInside(code3) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      (code3 === 93 && !data) || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code3 === null ||
      code3 === 91 ||
      markdownLineEndingOrSpace(code3)
    ) {
      return nok(code3)
    }
    if (code3 === 93) {
      effects.exit('chunkString')
      const token = effects.exit('gfmFootnoteDefinitionLabelString')
      identifier = normalizeIdentifier(self.sliceSerialize(token))
      effects.enter('gfmFootnoteDefinitionLabelMarker')
      effects.consume(code3)
      effects.exit('gfmFootnoteDefinitionLabelMarker')
      effects.exit('gfmFootnoteDefinitionLabel')
      return labelAfter
    }
    if (!markdownLineEndingOrSpace(code3)) {
      data = true
    }
    size++
    effects.consume(code3)
    return code3 === 92 ? labelEscape : labelInside
  }
  function labelEscape(code3) {
    if (code3 === 91 || code3 === 92 || code3 === 93) {
      effects.consume(code3)
      size++
      return labelInside
    }
    return labelInside(code3)
  }
  function labelAfter(code3) {
    if (code3 === 58) {
      effects.enter('definitionMarker')
      effects.consume(code3)
      effects.exit('definitionMarker')
      if (!defined.includes(identifier)) {
        defined.push(identifier)
      }
      return factorySpace(effects, whitespaceAfter, 'gfmFootnoteDefinitionWhitespace')
    }
    return nok(code3)
  }
  function whitespaceAfter(code3) {
    return ok2(code3)
  }
}
function tokenizeDefinitionContinuation(effects, ok2, nok) {
  return effects.check(blankLine, ok2, effects.attempt(indent, ok2, nok))
}
function gfmFootnoteDefinitionEnd(effects) {
  effects.exit('gfmFootnoteDefinition')
}
function tokenizeIndent(effects, ok2, nok) {
  const self = this
  return factorySpace(effects, afterPrefix, 'gfmFootnoteDefinitionIndent', 4 + 1)
  function afterPrefix(code3) {
    const tail = self.events[self.events.length - 1]
    return tail && tail[1].type === 'gfmFootnoteDefinitionIndent' && tail[2].sliceSerialize(tail[1], true).length === 4 ? ok2(code3) : nok(code3)
  }
}

// node_modules/.pnpm/micromark-extension-gfm-strikethrough@2.1.0/node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js
function gfmStrikethrough(options) {
  const options_ = options || {}
  let single = options_.singleTilde
  const tokenizer = {
    name: 'strikethrough',
    tokenize: tokenizeStrikethrough,
    resolveAll: resolveAllStrikethrough
  }
  if (single === null || single === void 0) {
    single = true
  }
  return {
    text: {
      [126]: tokenizer
    },
    insideSpan: {
      null: [tokenizer]
    },
    attentionMarkers: {
      null: [126]
    }
  }
  function resolveAllStrikethrough(events, context) {
    let index = -1
    while (++index < events.length) {
      if (events[index][0] === 'enter' && events[index][1].type === 'strikethroughSequenceTemporary' && events[index][1]._close) {
        let open = index
        while (open--) {
          if (
            events[open][0] === 'exit' &&
            events[open][1].type === 'strikethroughSequenceTemporary' &&
            events[open][1]._open && // If the sizes are the same:
            events[index][1].end.offset - events[index][1].start.offset === events[open][1].end.offset - events[open][1].start.offset
          ) {
            events[index][1].type = 'strikethroughSequence'
            events[open][1].type = 'strikethroughSequence'
            const strikethrough = {
              type: 'strikethrough',
              start: Object.assign({}, events[open][1].start),
              end: Object.assign({}, events[index][1].end)
            }
            const text4 = {
              type: 'strikethroughText',
              start: Object.assign({}, events[open][1].end),
              end: Object.assign({}, events[index][1].start)
            }
            const nextEvents = [
              ['enter', strikethrough, context],
              ['enter', events[open][1], context],
              ['exit', events[open][1], context],
              ['enter', text4, context]
            ]
            const insideSpan = context.parser.constructs.insideSpan.null
            if (insideSpan) {
              splice(nextEvents, nextEvents.length, 0, resolveAll(insideSpan, events.slice(open + 1, index), context))
            }
            splice(nextEvents, nextEvents.length, 0, [
              ['exit', text4, context],
              ['enter', events[index][1], context],
              ['exit', events[index][1], context],
              ['exit', strikethrough, context]
            ])
            splice(events, open - 1, index - open + 3, nextEvents)
            index = open + nextEvents.length - 2
            break
          }
        }
      }
    }
    index = -1
    while (++index < events.length) {
      if (events[index][1].type === 'strikethroughSequenceTemporary') {
        events[index][1].type = 'data'
      }
    }
    return events
  }
  function tokenizeStrikethrough(effects, ok2, nok) {
    const previous2 = this.previous
    const events = this.events
    let size = 0
    return start
    function start(code3) {
      if (previous2 === 126 && events[events.length - 1][1].type !== 'characterEscape') {
        return nok(code3)
      }
      effects.enter('strikethroughSequenceTemporary')
      return more(code3)
    }
    function more(code3) {
      const before = classifyCharacter(previous2)
      if (code3 === 126) {
        if (size > 1) return nok(code3)
        effects.consume(code3)
        size++
        return more
      }
      if (size < 2 && !single) return nok(code3)
      const token = effects.exit('strikethroughSequenceTemporary')
      const after = classifyCharacter(code3)
      token._open = !after || (after === 2 && Boolean(before))
      token._close = !before || (before === 2 && Boolean(after))
      return ok2(code3)
    }
  }
}

// node_modules/.pnpm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/edit-map.js
var EditMap = class {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = []
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   * @param {number} remove
   * @param {Array<Event>} add
   * @returns {undefined}
   */
  add(index, remove, add) {
    addImplementation(this, index, remove, add)
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   * @returns {undefined}
   */
  consume(events) {
    this.map.sort(function (a, b) {
      return a[0] - b[0]
    })
    if (this.map.length === 0) {
      return
    }
    let index = this.map.length
    const vecs = []
    while (index > 0) {
      index -= 1
      vecs.push(events.slice(this.map[index][0] + this.map[index][1]), this.map[index][2])
      events.length = this.map[index][0]
    }
    vecs.push(events.slice())
    events.length = 0
    let slice = vecs.pop()
    while (slice) {
      for (const element2 of slice) {
        events.push(element2)
      }
      slice = vecs.pop()
    }
    this.map.length = 0
  }
}
function addImplementation(editMap, at, remove, add) {
  let index = 0
  if (remove === 0 && add.length === 0) {
    return
  }
  while (index < editMap.map.length) {
    if (editMap.map[index][0] === at) {
      editMap.map[index][1] += remove
      editMap.map[index][2].push(...add)
      return
    }
    index += 1
  }
  editMap.map.push([at, remove, add])
}

// node_modules/.pnpm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/infer.js
function gfmTableAlign(events, index) {
  let inDelimiterRow = false
  const align = []
  while (index < events.length) {
    const event = events[index]
    if (inDelimiterRow) {
      if (event[0] === 'enter') {
        if (event[1].type === 'tableContent') {
          align.push(events[index + 1][1].type === 'tableDelimiterMarker' ? 'left' : 'none')
        }
      } else if (event[1].type === 'tableContent') {
        if (events[index - 1][1].type === 'tableDelimiterMarker') {
          const alignIndex = align.length - 1
          align[alignIndex] = align[alignIndex] === 'left' ? 'center' : 'right'
        }
      } else if (event[1].type === 'tableDelimiterRow') {
        break
      }
    } else if (event[0] === 'enter' && event[1].type === 'tableDelimiterRow') {
      inDelimiterRow = true
    }
    index += 1
  }
  return align
}

// node_modules/.pnpm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/syntax.js
function gfmTable() {
  return {
    flow: {
      null: {
        name: 'table',
        tokenize: tokenizeTable,
        resolveAll: resolveTable
      }
    }
  }
}
function tokenizeTable(effects, ok2, nok) {
  const self = this
  let size = 0
  let sizeB = 0
  let seen
  return start
  function start(code3) {
    let index = self.events.length - 1
    while (index > -1) {
      const type = self.events[index][1].type
      if (
        type === 'lineEnding' || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
        type === 'linePrefix'
      )
        index--
      else break
    }
    const tail = index > -1 ? self.events[index][1].type : null
    const next = tail === 'tableHead' || tail === 'tableRow' ? bodyRowStart : headRowBefore
    if (next === bodyRowStart && self.parser.lazy[self.now().line]) {
      return nok(code3)
    }
    return next(code3)
  }
  function headRowBefore(code3) {
    effects.enter('tableHead')
    effects.enter('tableRow')
    return headRowStart(code3)
  }
  function headRowStart(code3) {
    if (code3 === 124) {
      return headRowBreak(code3)
    }
    seen = true
    sizeB += 1
    return headRowBreak(code3)
  }
  function headRowBreak(code3) {
    if (code3 === null) {
      return nok(code3)
    }
    if (markdownLineEnding(code3)) {
      if (sizeB > 1) {
        sizeB = 0
        self.interrupt = true
        effects.exit('tableRow')
        effects.enter('lineEnding')
        effects.consume(code3)
        effects.exit('lineEnding')
        return headDelimiterStart
      }
      return nok(code3)
    }
    if (markdownSpace(code3)) {
      return factorySpace(effects, headRowBreak, 'whitespace')(code3)
    }
    sizeB += 1
    if (seen) {
      seen = false
      size += 1
    }
    if (code3 === 124) {
      effects.enter('tableCellDivider')
      effects.consume(code3)
      effects.exit('tableCellDivider')
      seen = true
      return headRowBreak
    }
    effects.enter('data')
    return headRowData(code3)
  }
  function headRowData(code3) {
    if (code3 === null || code3 === 124 || markdownLineEndingOrSpace(code3)) {
      effects.exit('data')
      return headRowBreak(code3)
    }
    effects.consume(code3)
    return code3 === 92 ? headRowEscape : headRowData
  }
  function headRowEscape(code3) {
    if (code3 === 92 || code3 === 124) {
      effects.consume(code3)
      return headRowData
    }
    return headRowData(code3)
  }
  function headDelimiterStart(code3) {
    self.interrupt = false
    if (self.parser.lazy[self.now().line]) {
      return nok(code3)
    }
    effects.enter('tableDelimiterRow')
    seen = false
    if (markdownSpace(code3)) {
      return factorySpace(effects, headDelimiterBefore, 'linePrefix', self.parser.constructs.disable.null.includes('codeIndented') ? void 0 : 4)(code3)
    }
    return headDelimiterBefore(code3)
  }
  function headDelimiterBefore(code3) {
    if (code3 === 45 || code3 === 58) {
      return headDelimiterValueBefore(code3)
    }
    if (code3 === 124) {
      seen = true
      effects.enter('tableCellDivider')
      effects.consume(code3)
      effects.exit('tableCellDivider')
      return headDelimiterCellBefore
    }
    return headDelimiterNok(code3)
  }
  function headDelimiterCellBefore(code3) {
    if (markdownSpace(code3)) {
      return factorySpace(effects, headDelimiterValueBefore, 'whitespace')(code3)
    }
    return headDelimiterValueBefore(code3)
  }
  function headDelimiterValueBefore(code3) {
    if (code3 === 58) {
      sizeB += 1
      seen = true
      effects.enter('tableDelimiterMarker')
      effects.consume(code3)
      effects.exit('tableDelimiterMarker')
      return headDelimiterLeftAlignmentAfter
    }
    if (code3 === 45) {
      sizeB += 1
      return headDelimiterLeftAlignmentAfter(code3)
    }
    if (code3 === null || markdownLineEnding(code3)) {
      return headDelimiterCellAfter(code3)
    }
    return headDelimiterNok(code3)
  }
  function headDelimiterLeftAlignmentAfter(code3) {
    if (code3 === 45) {
      effects.enter('tableDelimiterFiller')
      return headDelimiterFiller(code3)
    }
    return headDelimiterNok(code3)
  }
  function headDelimiterFiller(code3) {
    if (code3 === 45) {
      effects.consume(code3)
      return headDelimiterFiller
    }
    if (code3 === 58) {
      seen = true
      effects.exit('tableDelimiterFiller')
      effects.enter('tableDelimiterMarker')
      effects.consume(code3)
      effects.exit('tableDelimiterMarker')
      return headDelimiterRightAlignmentAfter
    }
    effects.exit('tableDelimiterFiller')
    return headDelimiterRightAlignmentAfter(code3)
  }
  function headDelimiterRightAlignmentAfter(code3) {
    if (markdownSpace(code3)) {
      return factorySpace(effects, headDelimiterCellAfter, 'whitespace')(code3)
    }
    return headDelimiterCellAfter(code3)
  }
  function headDelimiterCellAfter(code3) {
    if (code3 === 124) {
      return headDelimiterBefore(code3)
    }
    if (code3 === null || markdownLineEnding(code3)) {
      if (!seen || size !== sizeB) {
        return headDelimiterNok(code3)
      }
      effects.exit('tableDelimiterRow')
      effects.exit('tableHead')
      return ok2(code3)
    }
    return headDelimiterNok(code3)
  }
  function headDelimiterNok(code3) {
    return nok(code3)
  }
  function bodyRowStart(code3) {
    effects.enter('tableRow')
    return bodyRowBreak(code3)
  }
  function bodyRowBreak(code3) {
    if (code3 === 124) {
      effects.enter('tableCellDivider')
      effects.consume(code3)
      effects.exit('tableCellDivider')
      return bodyRowBreak
    }
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit('tableRow')
      return ok2(code3)
    }
    if (markdownSpace(code3)) {
      return factorySpace(effects, bodyRowBreak, 'whitespace')(code3)
    }
    effects.enter('data')
    return bodyRowData(code3)
  }
  function bodyRowData(code3) {
    if (code3 === null || code3 === 124 || markdownLineEndingOrSpace(code3)) {
      effects.exit('data')
      return bodyRowBreak(code3)
    }
    effects.consume(code3)
    return code3 === 92 ? bodyRowEscape : bodyRowData
  }
  function bodyRowEscape(code3) {
    if (code3 === 92 || code3 === 124) {
      effects.consume(code3)
      return bodyRowData
    }
    return bodyRowData(code3)
  }
}
function resolveTable(events, context) {
  let index = -1
  let inFirstCellAwaitingPipe = true
  let rowKind = 0
  let lastCell = [0, 0, 0, 0]
  let cell = [0, 0, 0, 0]
  let afterHeadAwaitingFirstBodyRow = false
  let lastTableEnd = 0
  let currentTable
  let currentBody
  let currentCell
  const map3 = new EditMap()
  while (++index < events.length) {
    const event = events[index]
    const token = event[1]
    if (event[0] === 'enter') {
      if (token.type === 'tableHead') {
        afterHeadAwaitingFirstBodyRow = false
        if (lastTableEnd !== 0) {
          flushTableEnd(map3, context, lastTableEnd, currentTable, currentBody)
          currentBody = void 0
          lastTableEnd = 0
        }
        currentTable = {
          type: 'table',
          start: Object.assign({}, token.start),
          // Note: correct end is set later.
          end: Object.assign({}, token.end)
        }
        map3.add(index, 0, [['enter', currentTable, context]])
      } else if (token.type === 'tableRow' || token.type === 'tableDelimiterRow') {
        inFirstCellAwaitingPipe = true
        currentCell = void 0
        lastCell = [0, 0, 0, 0]
        cell = [0, index + 1, 0, 0]
        if (afterHeadAwaitingFirstBodyRow) {
          afterHeadAwaitingFirstBodyRow = false
          currentBody = {
            type: 'tableBody',
            start: Object.assign({}, token.start),
            // Note: correct end is set later.
            end: Object.assign({}, token.end)
          }
          map3.add(index, 0, [['enter', currentBody, context]])
        }
        rowKind = token.type === 'tableDelimiterRow' ? 2 : currentBody ? 3 : 1
      } else if (rowKind && (token.type === 'data' || token.type === 'tableDelimiterMarker' || token.type === 'tableDelimiterFiller')) {
        inFirstCellAwaitingPipe = false
        if (cell[2] === 0) {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1]
            currentCell = flushCell(map3, context, lastCell, rowKind, void 0, currentCell)
            lastCell = [0, 0, 0, 0]
          }
          cell[2] = index
        }
      } else if (token.type === 'tableCellDivider') {
        if (inFirstCellAwaitingPipe) {
          inFirstCellAwaitingPipe = false
        } else {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1]
            currentCell = flushCell(map3, context, lastCell, rowKind, void 0, currentCell)
          }
          lastCell = cell
          cell = [lastCell[1], index, 0, 0]
        }
      }
    } else if (token.type === 'tableHead') {
      afterHeadAwaitingFirstBodyRow = true
      lastTableEnd = index
    } else if (token.type === 'tableRow' || token.type === 'tableDelimiterRow') {
      lastTableEnd = index
      if (lastCell[1] !== 0) {
        cell[0] = cell[1]
        currentCell = flushCell(map3, context, lastCell, rowKind, index, currentCell)
      } else if (cell[1] !== 0) {
        currentCell = flushCell(map3, context, cell, rowKind, index, currentCell)
      }
      rowKind = 0
    } else if (rowKind && (token.type === 'data' || token.type === 'tableDelimiterMarker' || token.type === 'tableDelimiterFiller')) {
      cell[3] = index
    }
  }
  if (lastTableEnd !== 0) {
    flushTableEnd(map3, context, lastTableEnd, currentTable, currentBody)
  }
  map3.consume(context.events)
  index = -1
  while (++index < context.events.length) {
    const event = context.events[index]
    if (event[0] === 'enter' && event[1].type === 'table') {
      event[1]._align = gfmTableAlign(context.events, index)
    }
  }
  return events
}
function flushCell(map3, context, range, rowKind, rowEnd, previousCell) {
  const groupName = rowKind === 1 ? 'tableHeader' : rowKind === 2 ? 'tableDelimiter' : 'tableData'
  const valueName = 'tableContent'
  if (range[0] !== 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, range[0]))
    map3.add(range[0], 0, [['exit', previousCell, context]])
  }
  const now = getPoint(context.events, range[1])
  previousCell = {
    type: groupName,
    start: Object.assign({}, now),
    // Note: correct end is set later.
    end: Object.assign({}, now)
  }
  map3.add(range[1], 0, [['enter', previousCell, context]])
  if (range[2] !== 0) {
    const relatedStart = getPoint(context.events, range[2])
    const relatedEnd = getPoint(context.events, range[3])
    const valueToken = {
      type: valueName,
      start: Object.assign({}, relatedStart),
      end: Object.assign({}, relatedEnd)
    }
    map3.add(range[2], 0, [['enter', valueToken, context]])
    if (rowKind !== 2) {
      const start = context.events[range[2]]
      const end = context.events[range[3]]
      start[1].end = Object.assign({}, end[1].end)
      start[1].type = 'chunkText'
      start[1].contentType = 'text'
      if (range[3] > range[2] + 1) {
        const a = range[2] + 1
        const b = range[3] - range[2] - 1
        map3.add(a, b, [])
      }
    }
    map3.add(range[3] + 1, 0, [['exit', valueToken, context]])
  }
  if (rowEnd !== void 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, rowEnd))
    map3.add(rowEnd, 0, [['exit', previousCell, context]])
    previousCell = void 0
  }
  return previousCell
}
function flushTableEnd(map3, context, index, table, tableBody) {
  const exits = []
  const related = getPoint(context.events, index)
  if (tableBody) {
    tableBody.end = Object.assign({}, related)
    exits.push(['exit', tableBody, context])
  }
  table.end = Object.assign({}, related)
  exits.push(['exit', table, context])
  map3.add(index + 1, 0, exits)
}
function getPoint(events, index) {
  const event = events[index]
  const side = event[0] === 'enter' ? 'start' : 'end'
  return event[1][side]
}

// node_modules/.pnpm/micromark-extension-gfm-task-list-item@2.1.0/node_modules/micromark-extension-gfm-task-list-item/lib/syntax.js
var tasklistCheck = {
  name: 'tasklistCheck',
  tokenize: tokenizeTasklistCheck
}
function gfmTaskListItem() {
  return {
    text: {
      [91]: tasklistCheck
    }
  }
}
function tokenizeTasklistCheck(effects, ok2, nok) {
  const self = this
  return open
  function open(code3) {
    if (
      // Exit if there’s stuff before.
      self.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !self._gfmTasklistFirstContentOfListItem
    ) {
      return nok(code3)
    }
    effects.enter('taskListCheck')
    effects.enter('taskListCheckMarker')
    effects.consume(code3)
    effects.exit('taskListCheckMarker')
    return inside
  }
  function inside(code3) {
    if (markdownLineEndingOrSpace(code3)) {
      effects.enter('taskListCheckValueUnchecked')
      effects.consume(code3)
      effects.exit('taskListCheckValueUnchecked')
      return close
    }
    if (code3 === 88 || code3 === 120) {
      effects.enter('taskListCheckValueChecked')
      effects.consume(code3)
      effects.exit('taskListCheckValueChecked')
      return close
    }
    return nok(code3)
  }
  function close(code3) {
    if (code3 === 93) {
      effects.enter('taskListCheckMarker')
      effects.consume(code3)
      effects.exit('taskListCheckMarker')
      effects.exit('taskListCheck')
      return after
    }
    return nok(code3)
  }
  function after(code3) {
    if (markdownLineEnding(code3)) {
      return ok2(code3)
    }
    if (markdownSpace(code3)) {
      return effects.check(
        {
          tokenize: spaceThenNonSpace
        },
        ok2,
        nok
      )(code3)
    }
    return nok(code3)
  }
}
function spaceThenNonSpace(effects, ok2, nok) {
  return factorySpace(effects, after, 'whitespace')
  function after(code3) {
    return code3 === null ? nok(code3) : ok2(code3)
  }
}

// node_modules/.pnpm/micromark-extension-gfm@3.0.0/node_modules/micromark-extension-gfm/index.js
function gfm(options) {
  return combineExtensions([gfmAutolinkLiteral(), gfmFootnote(), gfmStrikethrough(options), gfmTable(), gfmTaskListItem()])
}

// node_modules/.pnpm/remark-gfm@4.0.1/node_modules/remark-gfm/lib/index.js
var emptyOptions2 = {}
function remarkGfm(options) {
  const self =
    /** @type {Processor<Root>} */
    this
  const settings = options || emptyOptions2
  const data = self.data()
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = [])
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = [])
  micromarkExtensions.push(gfm(settings))
  fromMarkdownExtensions.push(gfmFromMarkdown())
  toMarkdownExtensions.push(gfmToMarkdown(settings))
}

// node_modules/.pnpm/remark-parse@11.0.0/node_modules/remark-parse/lib/index.js
function remarkParse(options) {
  const self = this
  self.parser = parser
  function parser(doc) {
    return fromMarkdown(doc, {
      ...self.data('settings'),
      ...options,
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: self.data('micromarkExtensions') || [],
      mdastExtensions: self.data('fromMarkdownExtensions') || []
    })
  }
}

// node_modules/.pnpm/remark-rehype@11.1.2/node_modules/remark-rehype/lib/index.js
function remarkRehype(destination, options) {
  if (destination && 'run' in destination) {
    return async function (tree, file2) {
      const hastTree =
        /** @type {HastRoot} */
        toHast(tree, { file: file2, ...options })
      await destination.run(hastTree, file2)
    }
  }
  return function (tree, file2) {
    return (
      /** @type {HastRoot} */
      toHast(tree, { file: file2, ...(destination || options) })
    )
  }
}

// node_modules/.pnpm/bail@2.0.2/node_modules/bail/index.js
function bail(error) {
  if (error) {
    throw error
  }
}

// node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/index.js
var import_extend = __toESM(require_extend(), 1)

// node_modules/.pnpm/is-plain-obj@4.1.0/node_modules/is-plain-obj/index.js
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return (
    (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) &&
    !(Symbol.toStringTag in value) &&
    !(Symbol.iterator in value)
  )
}

// node_modules/.pnpm/trough@2.2.0/node_modules/trough/lib/index.js
function trough() {
  const fns = []
  const pipeline = { run, use }
  return pipeline
  function run(...values) {
    let middlewareIndex = -1
    const callback = values.pop()
    if (typeof callback !== 'function') {
      throw new TypeError('Expected function as last argument, not ' + callback)
    }
    next(null, ...values)
    function next(error, ...output) {
      const fn = fns[++middlewareIndex]
      let index = -1
      if (error) {
        callback(error)
        return
      }
      while (++index < values.length) {
        if (output[index] === null || output[index] === void 0) {
          output[index] = values[index]
        }
      }
      values = output
      if (fn) {
        wrap(fn, next)(...output)
      } else {
        callback(null, ...output)
      }
    }
  }
  function use(middelware) {
    if (typeof middelware !== 'function') {
      throw new TypeError('Expected `middelware` to be a function, not ' + middelware)
    }
    fns.push(middelware)
    return pipeline
  }
}
function wrap(middleware, callback) {
  let called
  return wrapped
  function wrapped(...parameters) {
    const fnExpectsCallback = middleware.length > parameters.length
    let result
    if (fnExpectsCallback) {
      parameters.push(done)
    }
    try {
      result = middleware.apply(this, parameters)
    } catch (error) {
      const exception =
        /** @type {Error} */
        error
      if (fnExpectsCallback && called) {
        throw exception
      }
      return done(exception)
    }
    if (!fnExpectsCallback) {
      if (result && result.then && typeof result.then === 'function') {
        result.then(then, done)
      } else if (result instanceof Error) {
        done(result)
      } else {
        then(result)
      }
    }
  }
  function done(error, ...output) {
    if (!called) {
      called = true
      callback(error, ...output)
    }
  }
  function then(value) {
    done(null, value)
  }
}

// node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/callable-instance.js
var CallableInstance =
  /**
   * @type {new <Parameters extends Array<unknown>, Result>(property: string | symbol) => (...parameters: Parameters) => Result}
   */
  /** @type {unknown} */
  /**
   * @this {Function}
   * @param {string | symbol} property
   * @returns {(...parameters: Array<unknown>) => unknown}
   */
  function (property) {
    const self = this
    const constr = self.constructor
    const proto =
      /** @type {Record<string | symbol, Function>} */
      // Prototypes do exist.
      // type-coverage:ignore-next-line
      constr.prototype
    const value = proto[property]
    const apply = function () {
      return value.apply(apply, arguments)
    }
    Object.setPrototypeOf(apply, proto)
    return apply
  }

// node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/index.js
var own3 = {}.hasOwnProperty
var Processor = class _Processor extends CallableInstance {
  /**
   * Create a processor.
   */
  constructor() {
    super('copy')
    this.Compiler = void 0
    this.Parser = void 0
    this.attachers = []
    this.compiler = void 0
    this.freezeIndex = -1
    this.frozen = void 0
    this.namespace = {}
    this.parser = void 0
    this.transformers = trough()
  }
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
  copy() {
    const destination =
      /** @type {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>} */
      new _Processor()
    let index = -1
    while (++index < this.attachers.length) {
      const attacher = this.attachers[index]
      destination.use(...attacher)
    }
    destination.data((0, import_extend.default)(true, {}, this.namespace))
    return destination
  }
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
  data(key2, value) {
    if (typeof key2 === 'string') {
      if (arguments.length === 2) {
        assertUnfrozen('data', this.frozen)
        this.namespace[key2] = value
        return this
      }
      return (own3.call(this.namespace, key2) && this.namespace[key2]) || void 0
    }
    if (key2) {
      assertUnfrozen('data', this.frozen)
      this.namespace = key2
      return this
    }
    return this.namespace
  }
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
  freeze() {
    if (this.frozen) {
      return this
    }
    const self =
      /** @type {Processor} */
      /** @type {unknown} */
      this
    while (++this.freezeIndex < this.attachers.length) {
      const [attacher, ...options] = this.attachers[this.freezeIndex]
      if (options[0] === false) {
        continue
      }
      if (options[0] === true) {
        options[0] = void 0
      }
      const transformer = attacher.call(self, ...options)
      if (typeof transformer === 'function') {
        this.transformers.use(transformer)
      }
    }
    this.frozen = true
    this.freezeIndex = Number.POSITIVE_INFINITY
    return this
  }
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
  parse(file2) {
    this.freeze()
    const realFile = vfile(file2)
    const parser = this.parser || this.Parser
    assertParser('parse', parser)
    return parser(String(realFile), realFile)
  }
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
  process(file2, done) {
    const self = this
    this.freeze()
    assertParser('process', this.parser || this.Parser)
    assertCompiler('process', this.compiler || this.Compiler)
    return done ? executor(void 0, done) : new Promise(executor)
    function executor(resolve, reject) {
      const realFile = vfile(file2)
      const parseTree =
        /** @type {HeadTree extends undefined ? Node : HeadTree} */
        /** @type {unknown} */
        self.parse(realFile)
      self.run(parseTree, realFile, function (error, tree, file3) {
        if (error || !tree || !file3) {
          return realDone(error)
        }
        const compileTree =
          /** @type {CompileTree extends undefined ? Node : CompileTree} */
          /** @type {unknown} */
          tree
        const compileResult = self.stringify(compileTree, file3)
        if (looksLikeAValue(compileResult)) {
          file3.value = compileResult
        } else {
          file3.result = compileResult
        }
        realDone(
          error,
          /** @type {VFileWithOutput<CompileResult>} */
          file3
        )
      })
      function realDone(error, file3) {
        if (error || !file3) {
          reject(error)
        } else if (resolve) {
          resolve(file3)
        } else {
          ok(done, '`done` is defined if `resolve` is not')
          done(void 0, file3)
        }
      }
    }
  }
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
  processSync(file2) {
    let complete = false
    let result
    this.freeze()
    assertParser('processSync', this.parser || this.Parser)
    assertCompiler('processSync', this.compiler || this.Compiler)
    this.process(file2, realDone)
    assertDone('processSync', 'process', complete)
    ok(result, 'we either bailed on an error or have a tree')
    return result
    function realDone(error, file3) {
      complete = true
      bail(error)
      result = file3
    }
  }
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
  run(tree, file2, done) {
    assertNode(tree)
    this.freeze()
    const transformers = this.transformers
    if (!done && typeof file2 === 'function') {
      done = file2
      file2 = void 0
    }
    return done ? executor(void 0, done) : new Promise(executor)
    function executor(resolve, reject) {
      ok(typeof file2 !== 'function', '`file` can\u2019t be a `done` anymore, we checked')
      const realFile = vfile(file2)
      transformers.run(tree, realFile, realDone)
      function realDone(error, outputTree, file3) {
        const resultingTree =
          /** @type {TailTree extends undefined ? Node : TailTree} */
          outputTree || tree
        if (error) {
          reject(error)
        } else if (resolve) {
          resolve(resultingTree)
        } else {
          ok(done, '`done` is defined if `resolve` is not')
          done(void 0, resultingTree, file3)
        }
      }
    }
  }
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
  runSync(tree, file2) {
    let complete = false
    let result
    this.run(tree, file2, realDone)
    assertDone('runSync', 'run', complete)
    ok(result, 'we either bailed on an error or have a tree')
    return result
    function realDone(error, tree2) {
      bail(error)
      result = tree2
      complete = true
    }
  }
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
  stringify(tree, file2) {
    this.freeze()
    const realFile = vfile(file2)
    const compiler = this.compiler || this.Compiler
    assertCompiler('stringify', compiler)
    assertNode(tree)
    return compiler(tree, realFile)
  }
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
  use(value, ...parameters) {
    const attachers = this.attachers
    const namespace = this.namespace
    assertUnfrozen('use', this.frozen)
    if (value === null || value === void 0);
    else if (typeof value === 'function') {
      addPlugin(value, parameters)
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        addList(value)
      } else {
        addPreset(value)
      }
    } else {
      throw new TypeError('Expected usable value, not `' + value + '`')
    }
    return this
    function add(value2) {
      if (typeof value2 === 'function') {
        addPlugin(value2, [])
      } else if (typeof value2 === 'object') {
        if (Array.isArray(value2)) {
          const [plugin, ...parameters2] =
            /** @type {PluginTuple<Array<unknown>>} */
            value2
          addPlugin(plugin, parameters2)
        } else {
          addPreset(value2)
        }
      } else {
        throw new TypeError('Expected usable value, not `' + value2 + '`')
      }
    }
    function addPreset(result) {
      if (!('plugins' in result) && !('settings' in result)) {
        throw new Error(
          'Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither'
        )
      }
      addList(result.plugins)
      if (result.settings) {
        namespace.settings = (0, import_extend.default)(true, namespace.settings, result.settings)
      }
    }
    function addList(plugins) {
      let index = -1
      if (plugins === null || plugins === void 0);
      else if (Array.isArray(plugins)) {
        while (++index < plugins.length) {
          const thing = plugins[index]
          add(thing)
        }
      } else {
        throw new TypeError('Expected a list of plugins, not `' + plugins + '`')
      }
    }
    function addPlugin(plugin, parameters2) {
      let index = -1
      let entryIndex = -1
      while (++index < attachers.length) {
        if (attachers[index][0] === plugin) {
          entryIndex = index
          break
        }
      }
      if (entryIndex === -1) {
        attachers.push([plugin, ...parameters2])
      } else if (parameters2.length > 0) {
        let [primary, ...rest] = parameters2
        const currentPrimary = attachers[entryIndex][1]
        if (isPlainObject(currentPrimary) && isPlainObject(primary)) {
          primary = (0, import_extend.default)(true, currentPrimary, primary)
        }
        attachers[entryIndex] = [plugin, primary, ...rest]
      }
    }
  }
}
var unified = new Processor().freeze()
function assertParser(name, value) {
  if (typeof value !== 'function') {
    throw new TypeError('Cannot `' + name + '` without `parser`')
  }
}
function assertCompiler(name, value) {
  if (typeof value !== 'function') {
    throw new TypeError('Cannot `' + name + '` without `compiler`')
  }
}
function assertUnfrozen(name, frozen) {
  if (frozen) {
    throw new Error('Cannot call `' + name + '` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.')
  }
}
function assertNode(node) {
  if (!isPlainObject(node) || typeof node.type !== 'string') {
    throw new TypeError('Expected node, got `' + node + '`')
  }
}
function assertDone(name, asyncName, complete) {
  if (!complete) {
    throw new Error('`' + name + '` finished async. Use `' + asyncName + '` instead')
  }
}
function vfile(value) {
  return looksLikeAVFile(value) ? value : new VFile(value)
}
function looksLikeAVFile(value) {
  return Boolean(value && typeof value === 'object' && 'message' in value && 'messages' in value)
}
function looksLikeAValue(value) {
  return typeof value === 'string' || isUint8Array(value)
}
function isUint8Array(value) {
  return Boolean(value && typeof value === 'object' && 'byteLength' in value && 'byteOffset' in value)
}

// src/schemas/markdown.ts
var remarkRemoveComments = () => tree => {
  visit(tree, 'html', (node, index, parent) => {
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}
var rehypeMetaString = () => tree => {
  visit(tree, 'element', node => {
    if (node.tagName === 'code' && node.data?.meta) {
      node.properties ??= {}
      node.properties.metastring = node.data.meta
    }
  })
}
var markdown = (options = {}) =>
  custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta, addIssue }) => {
    value = value ?? meta.content
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return ''
    }
    const { markdown: markdown2, output } = meta.config
    const enableGfm = options.gfm ?? markdown2?.gfm ?? true
    const removeComments = options.removeComments ?? markdown2?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? markdown2?.copyLinkedFiles ?? true
    const remarkPlugins = []
    const rehypePlugins = []
    if (enableGfm) remarkPlugins.push(remarkGfm)
    if (removeComments) remarkPlugins.push(remarkRemoveComments)
    if (copyLinkedFiles) rehypePlugins.push([rehypeCopyLinkedFiles, output])
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
    if (markdown2?.remarkPlugins != null) remarkPlugins.push(...markdown2.remarkPlugins)
    if (markdown2?.rehypePlugins != null) rehypePlugins.push(...markdown2.rehypePlugins)
    try {
      const html5 = await unified()
        .use(remarkParse)
        .use(remarkPlugins)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeMetaString)
        .use(rehypeRaw)
        .use(rehypePlugins)
        .use(rehypeStringify)
        .process({ value, path: meta.path })
      return html5.toString()
    } catch (err) {
      addIssue({ fatal: true, code: 'custom', message: err.message })
      return null
    }
  })

// src/schemas/mdx.ts
var remarkRemoveComments2 = () => tree => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent) => {
    if (node.value.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}
var mdx = (options = {}) =>
  custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta, addIssue }) => {
    value = value ?? meta.content
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return ''
    }
    const { mdx: mdx2, output } = meta.config
    const enableGfm = options.gfm ?? mdx2?.gfm ?? true
    const enableMinify = options.minify ?? mdx2?.minify ?? true
    const removeComments = options.removeComments ?? mdx2?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? mdx2?.copyLinkedFiles ?? true
    const outputFormat = options.outputFormat ?? mdx2?.outputFormat ?? 'function-body'
    const remarkPlugins = []
    const rehypePlugins = []
    if (enableGfm) remarkPlugins.push(remarkGfm)
    if (removeComments) remarkPlugins.push(remarkRemoveComments2)
    if (copyLinkedFiles) remarkPlugins.push([remarkCopyLinkedFiles, output])
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
    if (mdx2?.remarkPlugins != null) remarkPlugins.push(...mdx2.remarkPlugins)
    if (mdx2?.rehypePlugins != null) rehypePlugins.push(...mdx2.rehypePlugins)
    const compilerOptions = { ...mdx2, ...options, outputFormat, remarkPlugins, rehypePlugins }
    const { compile } = await import('@mdx-js/mdx')
    try {
      const code3 = await compile({ value, path: meta.path }, compilerOptions)
      if (!enableMinify) return code3.toString()
      const { minify } = await import('terser')
      const minified = await minify(code3.toString(), {
        module: true,
        compress: true,
        keep_classnames: true,
        mangle: { keep_fnames: true },
        parse: { bare_returns: true }
      })
      return minified.code ?? code3.toString()
    } catch (err) {
      addIssue({ fatal: true, code: 'custom', message: err.message })
      return null
    }
  })

// src/schemas/metadata.ts
var cjRanges = [
  [11904, 11930],
  // Han
  [11931, 12020],
  [12032, 12246],
  [12293, 12294],
  [12295, 12296],
  [12321, 12330],
  [12344, 12348],
  [13312, 19894],
  [19968, 40939],
  [63744, 64110],
  [64112, 64218],
  [131072, 173783],
  [173824, 177973],
  [177984, 178206],
  [178208, 183970],
  [183984, 191457],
  [194560, 195102],
  [12353, 12439],
  // Hiragana
  [12445, 12448],
  [110593, 110879],
  [127488, 127489],
  [12449, 12539],
  // Katakana
  [12541, 12544],
  [12784, 12800],
  [13008, 13055],
  [13056, 13144],
  [65382, 65392],
  [65393, 65438],
  [110592, 110593]
]
var isCjChar = char => {
  const charCode = char.codePointAt(0) ?? 0
  return cjRanges.some(([from, to]) => charCode >= from && charCode < to)
}
var wordLength = str => {
  const reWord = /['\u2019]?([a-zA-Z]+(?:['\u2019]?[a-zA-Z]+)*)/g
  const words = str.match(reWord) || []
  return words.length
}
var metadata = () =>
  custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta, addIssue }) => {
    value = value ?? meta.plain
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return { readingTime: 0, wordCount: 0 }
    }
    const avgWPM = 265
    const latinChars = []
    const cjChars = []
    for (const char of value) {
      if (isCjChar(char)) {
        cjChars.push(char)
      } else {
        latinChars.push(char)
      }
    }
    const wordCount = wordLength(latinChars.join('')) + cjChars.length * 0.56
    const time = Math.round(wordCount / avgWPM)
    return {
      readingTime: time === 0 ? 1 : time,
      wordCount
    }
  })
var path2 = options =>
  custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta, addIssue }) => {
    if (value != null) {
      addIssue({ fatal: false, code: 'custom', message: '`s.path()` schema will resolve the flattening path based on the file path' })
    }
    const flattened = relative(meta.config.root, meta.path)
      .replace(/\.[^.]+$/, '')
      .replace(/\\/g, '/')
    return options?.removeIndex === false ? flattened : flattened.replace(/\/index$/, '')
  })

// src/schemas/raw.ts
var raw3 = () => custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta }) => value ?? meta.content ?? '')

// src/schemas/slug.ts
var slug = (by = 'global', reserved = []) =>
  stringType()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
    .superRefine((value, { path: path3, meta, addIssue }) => {
      const key2 = `schemas:slug:${by}:${value}`
      const { cache } = meta.config
      if (cache.has(key2)) {
        addIssue({ fatal: true, code: 'custom', message: `duplicate slug '${value}' in '${meta.path}:${path3.join('.')}'` })
      } else {
        cache.set(key2, meta.path)
      }
    })

// node_modules/.pnpm/github-slugger@2.0.0/node_modules/github-slugger/regex.js
var regex =
  /[\0-\x1F!-,\.\/:-@\[-\^`\{-\xA9\xAB-\xB4\xB6-\xB9\xBB-\xBF\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0378\u0379\u037E\u0380-\u0385\u0387\u038B\u038D\u03A2\u03F6\u0482\u0530\u0557\u0558\u055A-\u055F\u0589-\u0590\u05BE\u05C0\u05C3\u05C6\u05C8-\u05CF\u05EB-\u05EE\u05F3-\u060F\u061B-\u061F\u066A-\u066D\u06D4\u06DD\u06DE\u06E9\u06FD\u06FE\u0700-\u070F\u074B\u074C\u07B2-\u07BF\u07F6-\u07F9\u07FB\u07FC\u07FE\u07FF\u082E-\u083F\u085C-\u085F\u086B-\u089F\u08B5\u08C8-\u08D2\u08E2\u0964\u0965\u0970\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09F2-\u09FB\u09FD\u09FF\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF0-\u0AF8\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B54\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B70\u0B72-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BF0-\u0BFF\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B-\u0C5F\u0C64\u0C65\u0C70-\u0C7F\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0CFF\u0D0D\u0D11\u0D45\u0D49\u0D4F-\u0D53\u0D58-\u0D5E\u0D64\u0D65\u0D70-\u0D79\u0D80\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF4-\u0E00\u0E3B-\u0E3F\u0E4F\u0E5A-\u0E80\u0E83\u0E85\u0E8B\u0EA4\u0EA6\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F01-\u0F17\u0F1A-\u0F1F\u0F2A-\u0F34\u0F36\u0F38\u0F3A-\u0F3D\u0F48\u0F6D-\u0F70\u0F85\u0F98\u0FBD-\u0FC5\u0FC7-\u0FFF\u104A-\u104F\u109E\u109F\u10C6\u10C8-\u10CC\u10CE\u10CF\u10FB\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u1360-\u137F\u1390-\u139F\u13F6\u13F7\u13FE-\u1400\u166D\u166E\u1680\u169B-\u169F\u16EB-\u16ED\u16F9-\u16FF\u170D\u1715-\u171F\u1735-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17D4-\u17D6\u17D8-\u17DB\u17DE\u17DF\u17EA-\u180A\u180E\u180F\u181A-\u181F\u1879-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u1945\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DA-\u19FF\u1A1C-\u1A1F\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1AA6\u1AA8-\u1AAF\u1AC1-\u1AFF\u1B4C-\u1B4F\u1B5A-\u1B6A\u1B74-\u1B7F\u1BF4-\u1BFF\u1C38-\u1C3F\u1C4A-\u1C4C\u1C7E\u1C7F\u1C89-\u1C8F\u1CBB\u1CBC\u1CC0-\u1CCF\u1CD3\u1CFB-\u1CFF\u1DFA\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FBD\u1FBF-\u1FC1\u1FC5\u1FCD-\u1FCF\u1FD4\u1FD5\u1FDC-\u1FDF\u1FED-\u1FF1\u1FF5\u1FFD-\u203E\u2041-\u2053\u2055-\u2070\u2072-\u207E\u2080-\u208F\u209D-\u20CF\u20F1-\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F-\u215F\u2189-\u24B5\u24EA-\u2BFF\u2C2F\u2C5F\u2CE5-\u2CEA\u2CF4-\u2CFF\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D70-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E00-\u2E2E\u2E30-\u3004\u3008-\u3020\u3030\u3036\u3037\u303D-\u3040\u3097\u3098\u309B\u309C\u30A0\u30FB\u3100-\u3104\u3130\u318F-\u319F\u31C0-\u31EF\u3200-\u33FF\u4DC0-\u4DFF\u9FFD-\u9FFF\uA48D-\uA4CF\uA4FE\uA4FF\uA60D-\uA60F\uA62C-\uA63F\uA673\uA67E\uA6F2-\uA716\uA720\uA721\uA789\uA78A\uA7C0\uA7C1\uA7CB-\uA7F4\uA828-\uA82B\uA82D-\uA83F\uA874-\uA87F\uA8C6-\uA8CF\uA8DA-\uA8DF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA954-\uA95F\uA97D-\uA97F\uA9C1-\uA9CE\uA9DA-\uA9DF\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A-\uAA5F\uAA77-\uAA79\uAAC3-\uAADA\uAADE\uAADF\uAAF0\uAAF1\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB5B\uAB6A-\uAB6F\uABEB\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uE000-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB29\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBB2-\uFBD2\uFD3E-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFC-\uFDFF\uFE10-\uFE1F\uFE30-\uFE32\uFE35-\uFE4C\uFE50-\uFE6F\uFE75\uFEFD-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF3E\uFF40\uFF5B-\uFF65\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDD3F\uDD75-\uDDFC\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEE1-\uDEFF\uDF20-\uDF2C\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDF9F\uDFC4-\uDFC7\uDFD0\uDFD6-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCAF\uDCD4-\uDCD7\uDCFC-\uDCFF\uDD28-\uDD2F\uDD64-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56-\uDC5F\uDC77-\uDC7F\uDC9F-\uDCDF\uDCF3\uDCF6-\uDCFF\uDD16-\uDD1F\uDD3A-\uDD7F\uDDB8-\uDDBD\uDDC0-\uDDFF\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE36\uDE37\uDE3B-\uDE3E\uDE40-\uDE5F\uDE7D-\uDE7F\uDE9D-\uDEBF\uDEC8\uDEE7-\uDEFF\uDF36-\uDF3F\uDF56-\uDF5F\uDF73-\uDF7F\uDF92-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCFF\uDD28-\uDD2F\uDD3A-\uDE7F\uDEAA\uDEAD-\uDEAF\uDEB2-\uDEFF\uDF1D-\uDF26\uDF28-\uDF2F\uDF51-\uDFAF\uDFC5-\uDFDF\uDFF7-\uDFFF]|\uD804[\uDC47-\uDC65\uDC70-\uDC7E\uDCBB-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD40-\uDD43\uDD48-\uDD4F\uDD74\uDD75\uDD77-\uDD7F\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDFF\uDE12\uDE38-\uDE3D\uDE3F-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEA9-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDEFF\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF45\uDF46\uDF49\uDF4A\uDF4E\uDF4F\uDF51-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD805[\uDC4B-\uDC4F\uDC5A-\uDC5D\uDC62-\uDC7F\uDCC6\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDC1-\uDDD7\uDDDE-\uDDFF\uDE41-\uDE43\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB9-\uDEBF\uDECA-\uDEFF\uDF1B\uDF1C\uDF2C-\uDF2F\uDF3A-\uDFFF]|\uD806[\uDC3B-\uDC9F\uDCEA-\uDCFE\uDD07\uDD08\uDD0A\uDD0B\uDD14\uDD17\uDD36\uDD39\uDD3A\uDD44-\uDD4F\uDD5A-\uDD9F\uDDA8\uDDA9\uDDD8\uDDD9\uDDE2\uDDE5-\uDDFF\uDE3F-\uDE46\uDE48-\uDE4F\uDE9A-\uDE9C\uDE9E-\uDEBF\uDEF9-\uDFFF]|\uD807[\uDC09\uDC37\uDC41-\uDC4F\uDC5A-\uDC71\uDC90\uDC91\uDCA8\uDCB7-\uDCFF\uDD07\uDD0A\uDD37-\uDD39\uDD3B\uDD3E\uDD48-\uDD4F\uDD5A-\uDD5F\uDD66\uDD69\uDD8F\uDD92\uDD99-\uDD9F\uDDAA-\uDEDF\uDEF7-\uDFAF\uDFB1-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD809[\uDC6F-\uDC7F\uDD44-\uDFFF]|[\uD80A\uD80B\uD80E-\uD810\uD812-\uD819\uD824-\uD82B\uD82D\uD82E\uD830-\uD833\uD837\uD839\uD83D\uD83F\uD87B-\uD87D\uD87F\uD885-\uDB3F\uDB41-\uDBFF][\uDC00-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDECF\uDEEE\uDEEF\uDEF5-\uDEFF\uDF37-\uDF3F\uDF44-\uDF4F\uDF5A-\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD81B[\uDC00-\uDE3F\uDE80-\uDEFF\uDF4B-\uDF4E\uDF88-\uDF8E\uDFA0-\uDFDF\uDFE2\uDFE5-\uDFEF\uDFF2-\uDFFF]|\uD821[\uDFF8-\uDFFF]|\uD823[\uDCD6-\uDCFF\uDD09-\uDFFF]|\uD82C[\uDD1F-\uDD4F\uDD53-\uDD63\uDD68-\uDD6F\uDEFC-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A-\uDC9C\uDC9F-\uDFFF]|\uD834[\uDC00-\uDD64\uDD6A-\uDD6C\uDD73-\uDD7A\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDE41\uDE45-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3\uDFCC\uDFCD]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85-\uDE9A\uDEA0\uDEB0-\uDFFF]|\uD838[\uDC07\uDC19\uDC1A\uDC22\uDC25\uDC2B-\uDCFF\uDD2D-\uDD2F\uDD3E\uDD3F\uDD4A-\uDD4D\uDD4F-\uDEBF\uDEFA-\uDFFF]|\uD83A[\uDCC5-\uDCCF\uDCD7-\uDCFF\uDD4C-\uDD4F\uDD5A-\uDFFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDFFF]|\uD83C[\uDC00-\uDD2F\uDD4A-\uDD4F\uDD6A-\uDD6F\uDD8A-\uDFFF]|\uD83E[\uDC00-\uDFEF\uDFFA-\uDFFF]|\uD869[\uDEDE-\uDEFF]|\uD86D[\uDF35-\uDF3F]|\uD86E[\uDC1E\uDC1F]|\uD873[\uDEA2-\uDEAF]|\uD87A[\uDFE1-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uD884[\uDF4B-\uDFFF]|\uDB40[\uDC00-\uDCFF\uDDF0-\uDFFF]/g

// node_modules/.pnpm/github-slugger@2.0.0/node_modules/github-slugger/index.js
var own4 = Object.hasOwnProperty
var BananaSlug = class {
  /**
   * Create a new slug class.
   */
  constructor() {
    this.occurrences
    this.reset()
  }
  /**
   * Generate a unique slug.
   *
   * Tracks previously generated slugs: repeated calls with the same value
   * will result in different slugs.
   * Use the `slug` function to get same slugs.
   *
   * @param  {string} value
   *   String of text to slugify
   * @param  {boolean} [maintainCase=false]
   *   Keep the current case, otherwise make all lowercase
   * @return {string}
   *   A unique slug string
   */
  slug(value, maintainCase) {
    const self = this
    let result = slug2(value, maintainCase === true)
    const originalSlug = result
    while (own4.call(self.occurrences, result)) {
      self.occurrences[originalSlug]++
      result = originalSlug + '-' + self.occurrences[originalSlug]
    }
    self.occurrences[result] = 0
    return result
  }
  /**
   * Reset - Forget all previous slugs
   *
   * @return void
   */
  reset() {
    this.occurrences = /* @__PURE__ */ Object.create(null)
  }
}
function slug2(value, maintainCase) {
  if (typeof value !== 'string') return ''
  if (!maintainCase) value = value.toLowerCase()
  return value.replace(regex, '').replace(/ /g, '-')
}

// node_modules/.pnpm/mdast-util-toc@7.1.0/node_modules/mdast-util-toc/lib/to-expression.js
function toExpression2(value) {
  return new RegExp('^(' + value + ')$', 'i')
}

// node_modules/.pnpm/mdast-util-toc@7.1.0/node_modules/mdast-util-toc/lib/search.js
var slugs = new BananaSlug()
function search(root3, expression, settings) {
  const max = 'children' in root3 ? root3.children.length : 0
  const skip = settings.skip ? toExpression2(settings.skip) : void 0
  const parents = convert(
    settings.parents ||
      function (d) {
        return d === root3
      }
  )
  const map3 = []
  let index
  let endIndex
  let opening2
  slugs.reset()
  visit(root3, 'heading', function (node, position, parent) {
    const value = toString(node, { includeImageAlt: false })
    const id = node.data && node.data.hProperties && node.data.hProperties.id
    const slug3 = slugs.slug(id || value)
    if (!parents(parent)) {
      return
    }
    if (position !== void 0 && expression && !index && expression.test(value)) {
      index = position + 1
      opening2 = node
      return
    }
    if (position !== void 0 && opening2 && !endIndex && node.depth <= opening2.depth) {
      endIndex = position
    }
    if (
      (endIndex || !expression) &&
      (!settings.minDepth || node.depth >= settings.minDepth) &&
      (!settings.maxDepth || node.depth <= settings.maxDepth) &&
      (!skip || !skip.test(value))
    ) {
      map3.push({ depth: node.depth, children: node.children, id: slug3 })
    }
  })
  return {
    index: index === void 0 ? -1 : index,
    endIndex: index === void 0 ? -1 : endIndex || max,
    map: map3
  }
}

// node_modules/.pnpm/mdast-util-toc@7.1.0/node_modules/mdast-util-toc/lib/contents.js
function contents(map3, settings) {
  const { ordered = false, tight = false, prefix } = settings
  const table = { type: 'list', ordered, spread: false, children: [] }
  let minDepth = Number.POSITIVE_INFINITY
  let index = -1
  while (++index < map3.length) {
    if (map3[index].depth < minDepth) {
      minDepth = map3[index].depth
    }
  }
  index = -1
  while (++index < map3.length) {
    map3[index].depth -= minDepth - 1
  }
  index = -1
  while (++index < map3.length) {
    insert(map3[index], table, { ordered, tight, prefix })
  }
  return table
}
function insert(entry, parent, settings) {
  let index = -1
  const tail = parent.children[parent.children.length - 1]
  if (parent.type === 'list') {
    if (entry.depth === 1) {
      parent.children.push({
        type: 'listItem',
        spread: false,
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                title: null,
                url: '#' + (settings.prefix || '') + entry.id,
                children: all2(entry.children)
              }
            ]
          }
        ]
      })
    } else if (parent.children.length > 0) {
      const tail2 = parent.children[parent.children.length - 1]
      insert(entry, tail2, settings)
    } else {
      const item = { type: 'listItem', spread: false, children: [] }
      parent.children.push(item)
      insert(entry, item, settings)
    }
  } else if (tail && tail.type === 'list') {
    entry.depth--
    insert(entry, tail, settings)
  } else {
    const item = {
      type: 'list',
      ordered: settings.ordered,
      spread: false,
      children: []
    }
    parent.children.push(item)
    entry.depth--
    insert(entry, item, settings)
  }
  if (parent.type === 'list' && !settings.tight) {
    parent.spread = false
    while (++index < parent.children.length) {
      if (parent.children[index].children.length > 1) {
        parent.spread = true
        break
      }
    }
  } else {
    parent.spread = !settings.tight
  }
}
function all2(nodes) {
  const results = []
  let index = -1
  while (++index < nodes.length) {
    const result = one2(nodes[index])
    if (Array.isArray(result)) {
      results.push(...result)
    } else {
      results.push(result)
    }
  }
  return results
}
function one2(node) {
  if (node.type === 'footnoteReference') {
    return []
  }
  if (node.type === 'link' || node.type === 'linkReference') {
    return all2(node.children)
  }
  if ('children' in node) {
    const { children, position: position2, ...copy2 } = node
    return Object.assign(esm_default(copy2), {
      children: all2(node.children)
    })
  }
  const { position, ...copy } = node
  return esm_default(copy)
}

// node_modules/.pnpm/mdast-util-toc@7.1.0/node_modules/mdast-util-toc/lib/index.js
function toc(tree, options) {
  const settings = options || {}
  const heading2 = settings.heading ? toExpression2(settings.heading) : void 0
  const result = search(tree, heading2, settings)
  return {
    index: heading2 ? result.index : void 0,
    endIndex: heading2 ? result.endIndex : void 0,
    map: result.map.length > 0 ? contents(result.map, settings) : void 0
  }
}

// src/schemas/toc.ts
var parseParagraph = node => {
  if (node.type !== 'paragraph') return { title: '', url: '' }
  const extraction = { title: '', url: '' }
  visit(node, 'link', link2 => {
    extraction.url = link2.url
  })
  visit(node, ['text', 'emphasis', 'strong', 'inlineCode'], text4 => {
    extraction.title += text4.value
  })
  return extraction
}
var parse = tree => {
  if (!tree || tree?.type !== 'list') return []
  const layer = tree.children.flatMap(node => node.children)
  const entries = layer.flatMap((node, index) => {
    if (node.type === 'paragraph')
      return [
        {
          ...parseParagraph(node),
          items: parse(layer[index + 1])
          // Safe, next node can be either a list or a paragraph
        }
      ]
    return []
  })
  return entries
}
var toc2 = options =>
  custom(i => i === void 0 || typeof i === 'string').transform(async (value, { meta, addIssue }) => {
    value = value ?? meta.content
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return options?.original ? {} : []
    }
    try {
      const tree = value != null ? fromMarkdown(value) : meta.mdast
      if (tree == null) throw new Error('No tree found')
      const tocTree = toc(tree, options)
      if (options?.original) return tocTree
      return parse(tocTree.map)
    } catch (err) {
      addIssue({ fatal: true, code: 'custom', message: err.message })
      return null
    }
  })

// src/schemas/unique.ts
var unique = (by = 'global') =>
  stringType().superRefine((value, { path: path3, meta, addIssue }) => {
    const key2 = `schemas:unique:${by}:${value}`
    const { cache } = meta.config
    if (cache.has(key2)) {
      addIssue({ fatal: true, code: 'custom', message: `duplicate value '${value}' in '${meta.path}:${path3.join('.')}'` })
    } else {
      cache.set(key2, meta.path)
    }
  })

// src/schemas/index.ts
var s = {
  ...zod_exports,
  isodate,
  unique,
  slug,
  file,
  image,
  metadata,
  excerpt,
  markdown,
  mdx,
  path: path2,
  raw: raw3,
  toc: toc2
}

export { s }
