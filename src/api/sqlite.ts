import http from './client'
import type {
  ApiResponse,
  SqliteDataData,
  SqliteQueryResult,
  SqliteSchemaData,
  SqliteTableInfo,
} from '@/models'

/** SQLite 表/视图列表 (GET /api/files/sqlite/tables) */
export function getSqliteTables(dbPath: string) {
  return http.get<ApiResponse<SqliteTableInfo[]>>('/files/sqlite/tables', {
    params: { path: dbPath },
  })
}

/** SQLite 表结构 (GET /api/files/sqlite/schema) */
export function getSqliteSchema(dbPath: string, table: string) {
  return http.get<ApiResponse<SqliteSchemaData>>('/files/sqlite/schema', {
    params: { path: dbPath, table },
  })
}

/** SQLite 表数据分页预览 (GET /api/files/sqlite/data) */
export function getSqliteData(dbPath: string, table: string, page: number, pageSize: number) {
  return http.get<ApiResponse<SqliteDataData>>('/files/sqlite/data', {
    params: { path: dbPath, table, page, pageSize },
  })
}

/** 执行 SQLite SQL (POST /api/files/sqlite/query) */
export function runSqliteQuery(dbPath: string, sql: string) {
  return http.post<ApiResponse<SqliteQueryResult>>('/files/sqlite/query', { path: dbPath, sql })
}
