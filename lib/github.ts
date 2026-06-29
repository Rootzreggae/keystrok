// GitHub App integration: mint short-lived installation tokens on demand from
// the App's private key; we never persist tokens (only the installation id).
import { App } from 'octokit'
import { createPrivateKey } from 'crypto'

export function githubConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_SLUG && process.env.GITHUB_APP_PRIVATE_KEY_BASE64)
}

// Decode the base64 PEM and normalize PKCS#1 (GitHub's "BEGIN RSA PRIVATE KEY")
// to PKCS#8, which octokit's JWT signer expects.
function privateKey(): string {
  const b64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64
  if (!b64) throw new Error('GITHUB_APP_PRIVATE_KEY_BASE64 is not set')
  const pem = Buffer.from(b64, 'base64').toString('utf8')
  return createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' }).toString()
}

let _app: App | null = null
function app(): App {
  if (!_app) _app = new App({ appId: process.env.GITHUB_APP_ID!, privateKey: privateKey() })
  return _app
}

// Where to send the user to install / reconfigure the App on github.com.
export function installUrl(): string {
  return `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`
}

// Installation metadata: which account the App is installed on.
export async function getInstallation(installationId: string | number) {
  const { data } = await app().octokit.request('GET /app/installations/{installation_id}', {
    installation_id: Number(installationId),
  })
  return data
}

// Repos the installation can see.
export async function listInstallationRepos(installationId: string | number) {
  const octo = await app().getInstallationOctokit(Number(installationId))
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
  const { data } = await app().octokit.request('POST /app/installations/{installation_id}/access_tokens', {
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
