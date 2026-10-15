import { isMdxCommentExpression } from './mdx-comment'

import type { TocItem } from '../results'

export interface NavigationSnapshot {
  items: TocItem[]
  limitations: string[]
}

export interface NavigationNode {
  type: string
  tagName?: string
  name?: string | null
  value?: unknown
  properties?: Record<string, unknown>
  attributes?: { type: string; name?: string; value?: unknown }[]
  children?: NavigationNode[]
}

const normalize = (fragments: string[]): string => fragments.join(' ').replace(/\s+/gu, ' ').trim()

const anchorBase = (title: string): string => {
  let result = '',
    separator = false
  for (const point of title.normalize('NFC').toLowerCase().normalize('NFC')) {
    if (/[\p{Letter}\p{Number}\p{Mark}_]/u.test(point)) {
      if (separator && result) result += '-'
      result += point
      separator = false
    } else if (/[\p{White_Space}-]/u.test(point)) separator = true
  }
  return result || 'heading'
}

const isJsx = (node: NavigationNode): boolean => node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'

const hasRuntimeChildren = (node: NavigationNode): boolean =>
  (node.attributes ?? []).some(
    attr =>
      attr.type === 'mdxJsxExpressionAttribute' ||
      (attr.name === 'children' &&
        attr.value !== null &&
        typeof attr.value === 'object' &&
        (attr.value as { type?: string }).type === 'mdxJsxAttributeValueExpression')
  )

const staticTitle = (node: NavigationNode): string | undefined => {
  const fragments: string[] = []
  let determined = true
  const collect = (value: NavigationNode): void => {
    if (isMdxCommentExpression(value)) return
    if (value.type === 'text' && typeof value.value === 'string') fragments.push(value.value)
    else if (
      value.type === 'mdxFlowExpression' ||
      value.type === 'mdxTextExpression' ||
      (isJsx(value) && (hasRuntimeChildren(value) || (value.name != null && !/^[a-z][a-z\d-]*$/.test(value.name))))
    )
      determined = false
    else if (value.type !== 'comment' && value.type !== 'mdxjsEsm') for (const child of value.children ?? []) collect(child)
  }
  collect(node)
  return determined ? normalize(fragments) : undefined
}

type Target = { dynamic: true } | { dynamic: false; id?: unknown }

const targetOf = (node: NavigationNode): Target => {
  if (!isJsx(node)) return { dynamic: false, id: node.properties?.id }
  const attrs = node.attributes ?? []
  if (
    attrs.some(
      attr =>
        attr.type === 'mdxJsxExpressionAttribute' ||
        (attr.name === 'id' &&
          attr.value !== null &&
          typeof attr.value === 'object' &&
          (attr.value as { type?: string }).type === 'mdxJsxAttributeValueExpression')
    )
  )
    return { dynamic: true }
  const ids = attrs.filter(attr => attr.name === 'id')
  // A bare JSX id is present, not an absent transformed property.
  return { dynamic: false, id: ids.length ? (ids.at(-1)!.value ?? false) : undefined }
}

/** Two passes: reserve every explicit target before allocating any heading. */
export const captureNavigation = (tree: NavigationNode): NavigationSnapshot => {
  const elements: { node: NavigationNode; target: Target }[] = [],
    reserved = new Map<string, number>(),
    errors: string[] = []
  const visit = (node: NavigationNode): void => {
    if (node.type === 'element' || isJsx(node)) {
      const target = targetOf(node)
      elements.push({ node, target })
      const id = target.dynamic ? undefined : target.id
      if (id !== undefined && id !== null) {
        if (typeof id !== 'string' || id === '' || /[\t\n\f\r ]/u.test(id)) errors.push('Invalid explicit content id')
        else reserved.set(id, (reserved.get(id) ?? 0) + 1)
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  for (const [id, count] of reserved) if (count > 1) errors.push(`Duplicate explicit content id ${JSON.stringify(id)} (${count} declarations)`)
  // A plain Error on purpose: invalid/duplicate ids are user-content failures,
  // so the schema layer surfaces them as validation issues (see `failureMessage`
  // in schema/content.ts) rather than internal VeliteError('internal') aborts.
  if (errors.length) throw new Error(errors.join('; '))
  const items: TocItem[] = []
  const limitations: string[] = []
  for (const { node, target } of elements) {
    const tag = isJsx(node) ? node.name : node.tagName
    if (!/^h[1-6]$/.test(tag ?? '')) continue
    const title = staticTitle(node)
    if (title === undefined || target.dynamic) {
      limitations.push(`Cannot statically determine navigation for <${tag}>: ${target.dynamic ? 'target' : 'title'}`)
      continue
    }
    let id = target.id as string | undefined | null
    if (id === undefined || id === null) {
      const base = anchorBase(title)
      id = base
      for (let suffix = 1; reserved.has(id); suffix++) id = `${base}-${suffix}`
      reserved.set(id, 1)
      if (isJsx(node)) (node.attributes ??= []).push({ type: 'mdxJsxAttribute', name: 'id', value: id })
      else (node.properties ??= {}).id = id
    }
    if (title !== '') items.push({ depth: Number(tag![1]), title, id })
  }
  return { items, limitations }
}
