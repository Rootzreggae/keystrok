'use client'

// Summon the native folder picker, read the scannable text files the browser
// gives us, and send their contents to the server scanner. (A web page can't
// get a filesystem path, so we scan the files themselves, works everywhere,
// hosted or local.)
const SCAN_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'java', 'php', 'cs', 'sh',
  'yml', 'yaml', 'json', 'toml', 'conf', 'config', 'ini', 'properties', 'env',
  'txt', 'md', 'xml', 'sql', 'tf',
])
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|vendor|\.cache|\.venv|venv)\//
const MAX_FILE = 512 * 1024 // 512KB/file
const MAX_FILES = 4000

export interface FolderScanResult { ok: boolean; cancelled?: boolean; error?: string; sessionId?: string; findings?: number }

export function pickAndScanFolder(): Promise<FolderScanResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)

    let handled = false
    const cleanup = () => { input.remove(); window.removeEventListener('focus', onFocus) }

    // Detect cancel (file inputs fire no event on cancel): if focus returns and
    // no files were chosen shortly after, treat it as cancelled.
    const onFocus = () => setTimeout(() => { if (!handled) { handled = true; cleanup(); resolve({ ok: false, cancelled: true }) } }, 500)
    window.addEventListener('focus', onFocus)

    input.addEventListener('change', async () => {
      handled = true
      window.removeEventListener('focus', onFocus)
      const all = Array.from(input.files ?? [])
      input.remove()
      if (all.length === 0) return resolve({ ok: false, cancelled: true })

      const picked = all.filter((f) => {
        const rel = f.webkitRelativePath || f.name
        if (SKIP_DIR.test('/' + rel)) return false
        const ext = rel.split('.').pop()?.toLowerCase() ?? ''
        const isEnv = /(^|\/)\.env/.test(rel)
        return (SCAN_EXT.has(ext) || isEnv) && f.size <= MAX_FILE
      }).slice(0, MAX_FILES)

      if (picked.length === 0) return resolve({ ok: false, error: 'No scannable text files in that folder.' })

      const files = await Promise.all(picked.map(async (f) => ({ relativePath: f.webkitRelativePath || f.name, content: await f.text() })))
      const folderName = (all[0].webkitRelativePath || '').split('/')[0] || 'folder'

      try {
        const r = await fetch('/api/discovery/scan-files', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Folder · ${folderName}`, files }),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) return resolve({ ok: false, error: j.error || `Scan failed (${r.status})` })
        resolve({ ok: true, sessionId: j.sessionId, findings: j.findings })
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : 'Scan failed' })
      }
    })

    input.click()
  })
}
