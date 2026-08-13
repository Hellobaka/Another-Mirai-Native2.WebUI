/**
 * SQLite 行内编辑的纯逻辑：单元格值的类型化序列化、行定位、UPDATE 语句生成。
 * 与 UI 解耦，便于单元测试。
 */

export type CellSetResult =
  | { kind: 'skip' }
  | { kind: 'error'; message: string }
  | { kind: 'value'; sql: string }

/** 单元格的稳定文本形式，用于判断「未修改」 */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/**
 * 行定位键：对主键值做 JSON 序列化，避免 `1` 与 `"1"`、`null` 与 `''` 碰撞，
 * 也避免值内含分隔符导致的歧义。
 */
export function rowKeyOf(pkValues: unknown[]): string {
  return JSON.stringify(pkValues)
}

/** 类型化 SQL 字面量：数字/布尔保持原类型，字符串引号转义 */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return quoteString(String(v))
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

const NULL_TOKEN = /^null$/i
const NUMBER_TOKEN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/

/**
 * 计算某个单元格编辑后的 SET 表达式（不含列名）：
 * - 文本与原值一致 → 跳过
 * - 原值为 NULL：空输入跳过；输入 NULL（忽略大小写）保持 NULL
 * - 原值为数字：只接受数字文本，保持数字类型
 * - 原值为布尔：接受 0/1/true/false，写回 1/0
 * - 字符串：空输入保存为空字符串；输入 NULL（忽略大小写）设为 NULL
 */
export function cellSetResult(text: string, original: unknown): CellSetResult {
  if (text === cellText(original)) return { kind: 'skip' }

  const trimmed = text.trim()
  if (original === null || original === undefined) {
    if (trimmed === '') return { kind: 'skip' }
    if (NULL_TOKEN.test(trimmed)) return { kind: 'value', sql: 'NULL' }
    return { kind: 'value', sql: quoteString(text) }
  }

  if (typeof original === 'number') {
    if (NULL_TOKEN.test(trimmed)) return { kind: 'value', sql: 'NULL' }
    if (!NUMBER_TOKEN.test(trimmed)) {
      return { kind: 'error', message: `列值为数字，无法保存 "${text}"` }
    }
    return { kind: 'value', sql: trimmed }
  }

  if (typeof original === 'boolean') {
    const lower = trimmed.toLowerCase()
    if (lower === 'true' || lower === '1') return { kind: 'value', sql: '1' }
    if (lower === 'false' || lower === '0') return { kind: 'value', sql: '0' }
    return { kind: 'error', message: `列值为布尔，只能输入 0/1/true/false` }
  }

  if (NULL_TOKEN.test(trimmed)) return { kind: 'value', sql: 'NULL' }
  return { kind: 'value', sql: quoteString(text) }
}

export function buildWhereSql(pkColumns: string[], pkValues: unknown[]): string {
  return pkColumns.map((col, i) => `${quoteIdent(col)} = ${sqlLiteral(pkValues[i])}`).join(' AND ')
}

export interface CellEditInput {
  colIndex: number
  original: unknown
  text: string
}

export type BuildUpdateResult = { kind: 'sql'; sql: string } | { kind: 'error'; message: string }

/** 组装一行的一条 UPDATE；未被修改的单元格跳过 */
export function buildUpdateSql(
  table: string,
  columns: string[],
  pkColumns: string[],
  pkValues: unknown[],
  cells: CellEditInput[],
): BuildUpdateResult {
  const sets: string[] = []
  for (const cell of cells) {
    const column = columns[cell.colIndex]
    if (column === undefined) continue
    const result = cellSetResult(cell.text, cell.original)
    if (result.kind === 'skip') continue
    if (result.kind === 'error') return { kind: 'error', message: result.message }
    sets.push(`${quoteIdent(column)} = ${result.sql}`)
  }
  if (sets.length === 0) return { kind: 'error', message: '没有可保存的修改' }
  return {
    kind: 'sql',
    sql: `UPDATE ${quoteIdent(table)} SET ${sets.join(', ')} WHERE ${buildWhereSql(pkColumns, pkValues)}`,
  }
}

const READONLY_KEYWORDS = new Set(['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN', 'VALUES'])

function stripLeadingComments(sql: string): string {
  let s = sql.trimStart()
  let changed = true
  while (changed && s) {
    changed = false
    if (s.startsWith('--')) {
      const nl = s.indexOf('\n')
      s = (nl < 0 ? '' : s.slice(nl + 1)).trimStart()
      changed = true
    } else if (s.startsWith('/*')) {
      const end = s.indexOf('*/')
      s = (end < 0 ? '' : s.slice(end + 2)).trimStart()
      changed = true
    }
  }
  return s
}

export function firstKeyword(sql: string): string {
  const trimmed = stripLeadingComments(sql).replace(/^\(/, '').trimStart()
  const end = trimmed.search(/\s/)
  return (end < 0 ? trimmed : trimmed.slice(0, end)).toUpperCase()
}

/** 是否只读语句（查询类），用于执行前是否需要确认 */
export function isReadonlySql(sql: string): boolean {
  return READONLY_KEYWORDS.has(firstKeyword(sql))
}
