// Test-tooling only: lets the standalone proof scripts (run under plain Node)
// resolve the app's "@/..." path alias and ".ts" extensions, so they can
// import app modules (e.g. lib/allowlist) without a bundler.
// Usage: node --import ./scripts/register-alias.mjs <script.ts>
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { pathToFileURL, fileURLToPath } from 'node:url'
      import { existsSync } from 'node:fs'
      import { dirname, resolve as resolvePath } from 'node:path'
      export async function resolve(spec, ctx, next) {
        // "@/..." path alias -> repo root.
        if (spec.startsWith('@/')) {
          let p = process.cwd() + '/' + spec.slice(2)
          if (existsSync(p + '.ts')) p += '.ts'
          else if (existsSync(p + '.tsx')) p += '.tsx'
          return next(pathToFileURL(p).href, ctx)
        }
        // Extensionless relative import (e.g. "./mailer") that maps to a .ts/.tsx
        // file. Turbopack resolves these; plain Node does not.
        if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL) {
          const base = dirname(fileURLToPath(ctx.parentURL))
          let p = resolvePath(base, spec)
          if (!existsSync(p)) {
            if (existsSync(p + '.ts')) p += '.ts'
            else if (existsSync(p + '.tsx')) p += '.tsx'
            else return next(spec, ctx)
            return next(pathToFileURL(p).href, ctx)
          }
        }
        return next(spec, ctx)
      }
    `),
  import.meta.url
)
