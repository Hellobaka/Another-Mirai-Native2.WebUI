// monaco-editor 的 exports 会把子路径映射到 esm/vs/，因此这里不带 esm/vs 前缀
import EditorWorker from 'monaco-editor/editor/common/services/editorWebWorkerMain?worker'
import JsonWorker from 'monaco-editor/languages/features/json/json.worker?worker'
import CssWorker from 'monaco-editor/languages/features/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/languages/features/html/html.worker?worker'
import TsWorker from 'monaco-editor/languages/features/typescript/ts.worker?worker'

/**
 * Monaco 0.56 在构建时会把 editorWebWorkerMain 的 `new URL(...)` 内联成 data URL，
 * 但该入口含相对 import，data URL 下无法解析（运行时抛
 * "Failed to resolve module specifier ... Invalid relative url or base scheme isn't hierarchical"）。
 * 这里用 Vite 的 `?worker` 让各 worker 打成独立产物，并注册到 MonacoEnvironment。
 */
export function setupMonacoWorkers(): void {
  const global = globalThis as { MonacoEnvironment?: { getWorker?: unknown } }
  if (global.MonacoEnvironment && typeof global.MonacoEnvironment.getWorker === 'function') {
    return
  }
  global.MonacoEnvironment = {
    ...global.MonacoEnvironment,
    getWorker(_workerId: string, label: string) {
      switch (label) {
        case 'json':
          return new JsonWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker()
        case 'typescript':
        case 'javascript':
          return new TsWorker()
        default:
          return new EditorWorker()
      }
    },
  }
}
