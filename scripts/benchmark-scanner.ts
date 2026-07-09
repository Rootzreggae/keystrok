/**
 * Scanner detection benchmark: plants format-valid fake secrets in a
 * generated corpus, runs the PRODUCTION scan path (SecurityScanner,
 * BALANCED preset, same options as lib/scan-runner.ts with every file
 * category enabled), and reports per-platform recall + false positives.
 *
 * Run:  node --import ./scripts/register-alias.mjs scripts/benchmark-scanner.ts
 *
 * Secrets are generated at runtime from a seeded PRNG: deterministic across
 * runs, never committed, and never real. The corpus is written to a temp dir
 * outside the repo so the scanner cannot pick up repo files.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SecurityScanner } from '@/lib/scanner/core'
import { SCANNER_PRESETS } from '@/lib/scanner/index'
import type { ScanOptions } from '@/lib/scanner/types'

// ── deterministic fake-secret generation ────────────────────────────────────
// ponytail: mulberry32, seeded, so every run benchmarks the identical corpus
let seed = 0x6b657973
function rnd(): number {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const from = (alphabet: string, n: number) =>
  Array.from({ length: n }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('')
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const LOHEX = 'abcdef0123456789'
const B64 = ALNUM + '/+'
const DIGITS = '0123456789'

const gen = {
  awsAccessKey: () => 'AKIA' + from(UP, 16),
  awsSecretKey: () => from(B64, 40),
  stripeLive: () => 'sk_live_' + from(ALNUM, 24),
  stripeTest: () => 'sk_test_' + from(ALNUM, 24),
  githubPat: () => 'ghp_' + from(ALNUM, 36),
  githubOauth: () => 'gho_' + from(ALNUM, 36),
  grafanaSA: () => 'glsa_' + from(ALNUM, 32) + '_' + from(ALNUM, 8),
  datadogApi: () => from(LOHEX, 32),
  datadogApp: () => from(LOHEX, 40),
  newrelicQuery: () => 'NRIQ-' + from(ALNUM, 43),
  newrelicLicense: () => from('abcdef0123456789klmnopqrstuvwxyz', 40),
  slackBot: () => 'xoxb-' + from(DIGITS, 12) + '-' + from(DIGITS, 12) + '-' + from(ALNUM, 24),
  jwt: () => {
    const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    return b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ sub: 'bench', iat: 1751500800 }) + '.' + from(ALNUM, 32)
  },
  genericKey: () => from(ALNUM, 28),
}

// ── corpus builder: records the exact file+line of every plant ──────────────
type Plant = { file: string; line: number; platform: string; label: string }
type Corpus = { files: Map<string, string[]>; plants: Plant[] }
const corpus: Corpus = { files: new Map(), plants: [] }

function file(relPath: string) {
  const lines: string[] = []
  corpus.files.set(relPath, lines)
  return {
    raw(...text: string[]) { lines.push(...text) },
    plant(text: string, platform: string, label: string) {
      lines.push(text)
      corpus.plants.push({ file: relPath, line: lines.length, platform, label })
    },
  }
}

function buildCorpus() {
  // 1. Classic .env leak: the bread-and-butter case
  const env = file('.env')
  env.raw('# local development secrets', 'NODE_ENV=production')
  env.plant(`AWS_ACCESS_KEY_ID=${gen.awsAccessKey()}`, 'AWS', 'access key in .env')
  env.plant(`AWS_SECRET_ACCESS_KEY=${gen.awsSecretKey()}`, 'AWS', 'secret key in .env')
  env.plant(`DATADOG_API_KEY=${gen.datadogApi()}`, 'Datadog', 'API key in .env')
  env.plant(`STRIPE_SECRET_KEY=${gen.stripeLive()}`, 'Stripe', 'live key in .env')

  // 2. Same leaks but in a non-dot env file (dotfile handling control group)
  const envProd = file('config/production.env')
  envProd.plant(`AWS_ACCESS_KEY_ID=${gen.awsAccessKey()}`, 'AWS', 'access key in non-dot env')
  envProd.plant(`GITHUB_TOKEN=${gen.githubPat()}`, 'GitHub', 'PAT in non-dot env')

  // 3. JSON config
  const json = file('config/services.json')
  json.raw('{', '  "region": "eu-west-1",')
  json.plant(`  "stripe_secret": "${gen.stripeLive()}",`, 'Stripe', 'live key in JSON')
  json.plant(`  "datadog_app_key": "${gen.datadogApp()}",`, 'Datadog', 'app key in JSON')
  json.raw('  "timeout": 30', '}')

  // 4. Hardcoded in TypeScript source
  const ts = file('src/deploy.ts')
  ts.raw("import { execSync } from 'child_process'", '')
  ts.plant(`const GITHUB_TOKEN = '${gen.githubPat()}'`, 'GitHub', 'PAT hardcoded in TS')
  ts.plant(`const slack = '${gen.slackBot()}'`, 'Slack', 'bot token hardcoded in TS')
  ts.plant(`const OAUTH = '${gen.githubOauth()}'`, 'GitHub', 'OAuth token in TS')
  ts.raw('export function deploy() { execSync(`gh workflow run deploy`) }')

  // 5. docker-compose with observability creds
  const compose = file('docker-compose.yml')
  compose.raw('services:', '  grafana:', '    image: grafana/grafana:11.0.0', '    environment:')
  compose.plant(`      GRAFANA_SA_TOKEN: ${gen.grafanaSA()}`, 'Grafana', 'service account token in compose')
  compose.plant(`      NEW_RELIC_LICENSE_KEY: ${gen.newrelicLicense()}`, 'New Relic', 'license key in compose')
  compose.plant(`      SPLUNK_HEC_TOKEN: ${from(LOHEX, 8)}-${from(LOHEX, 4)}-${from(LOHEX, 4)}-${from(LOHEX, 4)}-${from(LOHEX, 12)}`, 'Splunk', 'HEC token in compose')
  compose.plant(`      PAGERDUTY_ROUTING_KEY: ${from(ALNUM.toLowerCase(), 32)}`, 'PagerDuty', 'routing key in compose')

  // 6. Python with JWT + generic key
  const py = file('src/auth.py')
  py.raw('import requests', '')
  py.plant(`SESSION_JWT = "${gen.jwt()}"`, 'JWT', 'JWT hardcoded in Python')
  py.plant(`api_key = "${gen.genericKey()}"`, 'Generic', 'generic api_key assignment')

  // 7. Shell script
  const sh = file('scripts/backup.sh')
  sh.raw('#!/bin/bash', 'set -euo pipefail')
  sh.plant(`export AWS_SECRET_ACCESS_KEY="${gen.awsSecretKey()}"`, 'AWS', 'secret key in shell export')

  // 8. INI config with legacy Grafana key
  const ini = file('config/grafana.ini')
  ini.raw('[auth]')
  ini.plant(`grafana_api_key = ${from(ALNUM, 36)}`, 'Grafana', 'legacy API key in INI')

  // 9. Markdown: curl example pasted in docs (do we scan docs at all?)
  const md = file('docs/QUERIES.md')
  md.raw('# Insights queries', '', '```')
  md.plant(`curl -H "X-Query-Key: ${gen.newrelicQuery()}" https://insights-api.newrelic.com/v1`, 'New Relic', 'query key in markdown')
  md.raw('```')

  // 10. Jupyter notebook (JSON body)
  const nb = file('notebooks/analysis.ipynb')
  nb.raw('{', ' "cells": [', '  {', '   "cell_type": "code",', '   "source": [')
  nb.plant(`    "stripe.api_key = \\"${gen.stripeLive()}\\""`, 'Stripe', 'live key in .ipynb')
  nb.raw('   ]', '  }', ' ],', ' "nbformat": 4', '}')

  // 11. Terraform
  const tf = file('infra/main.tf')
  tf.raw('provider "aws" {', '  region = "eu-west-1"')
  tf.plant(`  access_key = "${gen.awsAccessKey()}"`, 'AWS', 'access key in .tf')
  tf.raw('}')

  // 12. Known-hard cases: expected misses, kept to make the ceiling visible
  const hard = file('src/hard-cases.ts')
  const split = gen.stripeLive()
  hard.raw('// key split across two string literals')
  hard.plant(`const k = '${split.slice(0, 16)}' +`, 'Stripe', 'HARD: key split across lines')
  hard.raw(`  '${split.slice(16)}'`)
  hard.raw('// base64-wrapped secret')
  hard.plant(`const wrapped = '${Buffer.from('stripe_key=' + gen.stripeLive()).toString('base64')}'`, 'Generic', 'HARD: base64-wrapped secret')

  // ── benign files: false-positive bait ──────────────────────────────────────
  const lock = file('package-lock.json')
  lock.raw('{', '  "packages": {', '    "node_modules/react": {', '      "version": "19.0.0",',
    `      "integrity": "sha512-${from(B64, 64)}=="`, '    },', '    "node_modules/next": {',
    `      "integrity": "sha512-${from(B64, 64)}=="`, '    }', '  }', '}')

  const docs = file('docs/ARCHITECTURE.md')
  docs.raw('# Architecture', '', `Deployed at commit ${from(LOHEX, 40)}.`,
    `Trace requests with the request id header, e.g. ${from(LOHEX, 8)}-${from(LOHEX, 4)}-${from(LOHEX, 4)}-${from(LOHEX, 4)}-${from(LOHEX, 12)}.`,
    `Content hash: md5 ${from(LOHEX, 32)}.`)

  const client = file('src/api-client.ts')
  client.raw("const BASE = 'https://api.example.com/v2'",
    "export async function getUser(id: string) { return fetch(`${BASE}/users/${id}`) }",
    "// TODO: set STRIPE_KEY via env, never hardcode it",
    "const password = process.env.ADMIN_PASSWORD ?? ''",
    `const REQUEST_ID = '${from(LOHEX, 8)}-${from(LOHEX, 4)}-${from(LOHEX, 4)}-${from(LOHEX, 4)}-${from(LOHEX, 12)}' // trace id, not a secret`,
    `const CACHE_BUST = '${from(LOHEX, 32)}' // md5 of the bundle`,
    `const PINNED_COMMIT = '${from(LOHEX, 40)}'`)

  const gosum = file('go.sum')
  gosum.raw(`github.com/pkg/errors v0.9.1 h1:${from(B64, 43)}=`,
    `github.com/pkg/errors v0.9.1/go.mod h1:${from(B64, 43)}=`)

  // ponytail: bait assembled at runtime; a literal sk_live_xxx trips GitHub push protection
  const fixtures = file('test/fixtures.ts')
  fixtures.raw("export const placeholder = 'your_api_key_here'",
    `export const docsExample = '${'sk_live_' + 'x'.repeat(24)}'`)
}

// ── run ──────────────────────────────────────────────────────────────────────
async function main() {
  buildCorpus()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'keystrok-bench-'))
  for (const [rel, lines] of corpus.files) {
    const abs = path.join(root, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, lines.join('\n') + '\n')
  }

  // Mirror lib/scan-runner.ts: BALANCED preset, deep scan, every category on
  const scanner = new SecurityScanner(SCANNER_PRESETS.BALANCED)
  const options: ScanOptions = {
    targetPath: root,
    scanType: 'deep',
    includeHidden: false,
    maxDepth: 6,
    excludePaths: ['node_modules', '.git', 'build', 'dist', '.next', 'coverage'],
  }
  const result = await scanner.scanDirectory(options)
  fs.rmSync(root, { recursive: true, force: true })

  // ── score ──────────────────────────────────────────────────────────────────
  const plantAt = new Map(corpus.plants.map(p => [`${p.file}:${p.line}`, p]))
  const hits = new Set<Plant>()
  const falsePositives: { file: string; line: number; rule: string; preview: string }[] = []
  for (const f of result.findings) {
    const rel = path.isAbsolute(f.filePath) ? path.relative(root, f.filePath) : f.relativePath
    const plant = plantAt.get(`${rel}:${f.lineNumber}`)
    if (plant) hits.add(plant)
    else falsePositives.push({ file: rel, line: f.lineNumber, rule: f.patternName ?? f.detectionRule, preview: f.keyPreview ?? '' })
  }

  const byPlatform = new Map<string, { total: number; found: number }>()
  for (const p of corpus.plants) {
    const s = byPlatform.get(p.platform) ?? { total: 0, found: 0 }
    s.total++
    if (hits.has(p)) s.found++
    byPlatform.set(p.platform, s)
  }

  const scannedRel = new Set(result.fileScans.map(fs2 => fs2.fileInfo.relativePath.replace(/^[/\\]/, '')))
  const skipped = [...corpus.files.keys()].filter(f => ![...scannedRel].some(s => s.endsWith(f)))

  const pad = (s: string, n: number) => s.padEnd(n)
  console.log(`\nScanned ${result.scannedFiles}/${corpus.files.size} corpus files, ${result.findings.length} findings`)
  if (skipped.length) console.log(`NEVER SCANNED   ${skipped.join(', ')}`)
  console.log()
  console.log(pad('PLATFORM', 12) + pad('RECALL', 10) + 'MISSED')
  for (const [platform, s] of [...byPlatform].sort()) {
    const missed = corpus.plants.filter(p => p.platform === platform && !hits.has(p))
    console.log(pad(platform, 12) + pad(`${s.found}/${s.total}`, 10) + missed.map(m => `${m.label} (${m.file}:${m.line})`).join('; '))
  }
  const total = corpus.plants.length
  const found = hits.size
  console.log(`\nOVERALL RECALL  ${found}/${total}  (${((found / total) * 100).toFixed(1)}%)`)
  console.log(`FALSE POSITIVES ${falsePositives.length}`)
  for (const fp of falsePositives) console.log(`  ${fp.file}:${fp.line}  [${fp.rule}]  ${fp.preview}`)
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
