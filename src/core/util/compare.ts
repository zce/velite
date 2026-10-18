/** Compare two strings for canonical ordering (`Array.prototype.sort` compatible). */
export const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
