/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  arrowParens: 'avoid',
  printWidth: 160,
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: [
    '<BUILTIN_MODULES>',
    '^(react/(.*)$)|^(react$)',
    '^(next/(.*)$)|^(next$)',
    '<THIRD_PARTY_MODULES>',
    '',
    '^(~|@\/|#)',
    '^@/',
    '^#',
    '',
    '^[.]',
    '',
    '<TYPES>',
    '<TYPES>^(~|@\/|#)',
    '<TYPES>^[.]'
  ]
}
