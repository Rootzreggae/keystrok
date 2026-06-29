/**
 * Proof that the SSRF guard blocks internal targets and allows public ones.
 *
 * Run:  node --env-file=.env.local scripts/verify-ssrf.ts
 *
 * Asserts that cloud-metadata, loopback, private-range, and non-http URLs are
 * rejected, that a public host is allowed, and that the
 * ALLOW_PRIVATE_PLATFORM_URLS opt-out re-enables private targets.
 * Exits non-zero on any failed assertion.
 */
import { assertSafePlatformUrl, BlockedUrlError } from '../lib/ssrf.ts'

let failed = 0
const ok = (m: string) => console.log('  ✓ ' + m)
const bad = (m: string) => { console.log('  ✗ ' + m); failed = 1 }

async function expectBlocked(url: string) {
  try {
    await assertSafePlatformUrl(url)
    bad(`should have BLOCKED ${url}`)
  } catch (e) {
    if (e instanceof BlockedUrlError) ok(`blocked ${url} (${e.message})`)
    else bad(`unexpected error for ${url}: ${e}`)
  }
}

async function expectAllowed(url: string) {
  try {
    await assertSafePlatformUrl(url)
    ok(`allowed ${url}`)
  } catch (e) {
    bad(`should have ALLOWED ${url} but got: ${(e as Error).message}`)
  }
}

async function main() {
  // Force the secure default regardless of the local env.
  delete process.env.ALLOW_PRIVATE_PLATFORM_URLS

  console.log('== blocked (secure default) ==')
  await expectBlocked('http://169.254.169.254/latest/meta-data/')   // AWS metadata
  await expectBlocked('http://metadata.google.internal/')           // GCP metadata
  await expectBlocked('http://localhost:3000/')                     // loopback name
  await expectBlocked('http://127.0.0.1/')                          // loopback IP
  await expectBlocked('http://10.0.0.5/')                           // private
  await expectBlocked('http://192.168.1.1/')                        // private
  await expectBlocked('http://172.16.0.1/')                         // private
  await expectBlocked('http://[::1]/')                              // IPv6 loopback
  await expectBlocked('file:///etc/passwd')                         // non-http scheme
  await expectBlocked('gopher://127.0.0.1/')                        // non-http scheme

  console.log('== allowed ==')
  await expectAllowed('https://api.stripe.com/v1/account')
  await expectAllowed('https://grafana.com/')

  console.log('== self-host opt-out (ALLOW_PRIVATE_PLATFORM_URLS=true) ==')
  process.env.ALLOW_PRIVATE_PLATFORM_URLS = 'true'
  await expectAllowed('http://192.168.1.10:3000/')   // internal Grafana, now permitted
  await expectBlocked('file:///etc/passwd')          // scheme still enforced

  console.log(failed ? '\nSSRF GUARD: FAIL' : '\nSSRF GUARD: PASS')
  process.exitCode = failed
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
