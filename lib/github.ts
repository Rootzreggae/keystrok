// GitHub App integration. Config is captured per-instance via the App Manifest
// flow (stored in the DB) so each self-host owns its own App; env vars are the
// single-tenant fallback. We mint short-lived installation tokens on demand and
// never persist them (only the installation id).
import { App } from 'octokit'
import { createPrivateKey } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

// Normalize PKCS#1 ("BEGIN RSA PRIVATE KEY", what GitHub hands out) to PKCS#8,
// which octokit's JWT signer expects.
function toPkcs8(pem: string): string {
  return createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' }).toString()
}

interface GithubConfig { appId: string; slug: string; privateKey: string }

// DB row (manifest flow) wins; env vars are the fallback. Returns null if
// neither is present. The PEM is decrypted/decoded and normalized here.
async function loadConfig(): Promise<GithubConfig | null> {
  const row = await prisma.githubAppConfig.findUnique({ where: { id: 'default' } }).catch(() => null)
  if (row) {
    return { appId: row.appId, slug: row.slug, privateKey: toPkcs8(decryptSecret(row.privateKeyEnc)) }
  }
  const { GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY_BASE64 } = process.env
  if (GITHUB_APP_ID && GITHUB_APP_SLUG && GITHUB_APP_PRIVATE_KEY_BASE64) {
    const pem = Buffer.from(GITHUB_APP_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
    return { appId: GITHUB_APP_ID, slug: GITHUB_APP_SLUG, privateKey: toPkcs8(pem) }
  }
  return null
}

// Cheap existence check (no decryption) for gating UI / routes.
export async function githubConfigured(): Promise<boolean> {
  const row = await prisma.githubAppConfig.findUnique({ where: { id: 'default' }, select: { id: true } }).catch(() => null)
  if (row) return true
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_SLUG && process.env.GITHUB_APP_PRIVATE_KEY_BASE64)
}

async function app(): Promise<App> {
  const cfg = await loadConfig()
  if (!cfg) throw new Error('GitHub App is not configured')
  return new App({ appId: cfg.appId, privateKey: cfg.privateKey })
}

// Where to send the operator to install / reconfigure the App on github.com.
export async function installUrl(): Promise<string> {
  const cfg = await loadConfig()
  if (!cfg) throw new Error('GitHub App is not configured')
  return `https://github.com/apps/${cfg.slug}/installations/new`
}

// Installation metadata: which account the App is installed on.
export async function getInstallation(installationId: string | number) {
  const { data } = await (await app()).octokit.request('GET /app/installations/{installation_id}', {
    installation_id: Number(installationId),
  })
  return data
}

// Repos the installation can see.
export async function listInstallationRepos(installationId: string | number) {
  const octo = await (await app()).getInstallationOctokit(Number(installationId))
  const repos = await octo.paginate('GET /installation/repositories', { per_page: 100 })
  return repos.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
  }))
}

// Mint a 1-hour installation token (used to build an authenticated clone URL).
async function installationToken(installationId: string | number): Promise<string> {
  const { data } = await (await app()).octokit.request('POST /app/installations/{installation_id}/access_tokens', {
    installation_id: Number(installationId),
  })
  return data.token
}

// Tokenized HTTPS clone URL for a repo. The token is short-lived and embedded
// only in the URL passed to git for this one clone.
export async function cloneUrl(installationId: string | number, fullName: string): Promise<string> {
  const token = await installationToken(installationId)
  return `https://x-access-token:${token}@github.com/${fullName}.git`
}

// Persist the credentials returned by the App Manifest conversion. The private
// key is encrypted at rest. Singleton row.
export async function saveAppConfig(c: {
  appId: number | string
  slug: string
  pem: string
  webhookSecret?: string | null
  clientId?: string | null
}) {
  const data = {
    appId: String(c.appId),
    slug: c.slug,
    privateKeyEnc: encryptSecret(c.pem),
    webhookSecret: c.webhookSecret ? encryptSecret(c.webhookSecret) : null,
    clientId: c.clientId ?? null,
  }
  await prisma.githubAppConfig.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data })
}

// The instance operator is the first registered user. On an invite-only self-
// host the owner signs in first, so this gates App setup to them.
// ponytail: first-user heuristic; add an explicit admin role if multi-admin matters.
export async function isOperator(userId: string): Promise<boolean> {
  const first = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  return !!first && first.id === userId
}
