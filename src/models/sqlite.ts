/** SQLite 表/视图信息 (GET /api/files/sqlite/tables) */
export interface SqliteTableInfo {
  /** 表/视图名称 */
  name: string
  /** 类型：table / view */
  type: string
  /** 建表语句 */
  sql: string
}

/** SQLite 列信息 */
export interface SqliteColumnInfo {
  name: string
  dataType: string
  notNull: boolean
  defaultValue: unknown
  primaryKey: number
}

/** SQLite 索引信息 */
export interface SqliteIndexInfo {
  name: string
  unique: boolean
  columns: string[]
}

/** 表结构响应 (GET /api/files/sqlite/schema) */
export interface SqliteSchemaData {
  table: string
  columns: SqliteColumnInfo[]
  indexes: SqliteIndexInfo[]
}

/** 表数据分页预览 (GET /api/files/sqlite/data) */
export interface SqliteDataData {
  columns: string[]
  rows: unknown[][]
  total: number
  page: number
  pageSize: number
}

/** SQL 执行结果 (POST /api/files/sqlite/query) */
export interface SqliteQueryResult {
  /** query=查询类，execute=写入类 */
  type: 'query' | 'execute'
  /** 查询列名，execute 为 null */
  columns: string[] | null
  /** 查询行数据，execute 为 null */
  rows: unknown[][] | null
  /** 结果是否被截断（最多 1000 行） */
  truncated: boolean
  /** 受影响行数 */
  affectedRows: number
}
