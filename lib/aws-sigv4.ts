// AWS Signature V4 signing, stdlib crypto only.
//
// We call two IAM actions (ListAccessKeys, GetAccessKeyLastUsed) to learn if a
// leaked AWS key is still live and when/where it was last used. Those calls must
// be SigV4-signed. The full AWS SDK is a large dependency for two GETs, so we
// sign by hand: it's an HMAC-SHA256 chain that Node's crypto does directly.
//
// Correctness is not optional here (a wrong signature is a flat 403), so this is
// checked against AWS's published "get-vanilla" test vector in aws-sigv4.test.ts.
import { createHash, createHmac } from 'node:crypto'

const sha256hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s, 'utf8').digest()

// Date -> AWS basic-format timestamp: 2015-08-30T12:36:00.000Z -> 20150830T123600Z
export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

export interface SignOpts {
  method: string
  host: string            // e.g. iam.amazonaws.com
  path?: string           // default '/'
  query?: string          // canonical query string, already sorted+encoded; default ''
  body?: string           // request body; default ''
  service: string         // e.g. 'iam', 'sts'
  region: string          // e.g. 'us-east-1' (IAM/STS global endpoints use us-east-1)
  accessKeyId: string
  secretAccessKey: string
  contentType?: string    // set for POST form bodies
  date?: Date
}

/** Sign a request and return the headers to send (Authorization, X-Amz-Date, ...). */
export function signRequest(o: SignOpts): Record<string, string> {
  const date = o.date ?? new Date()
  const amz = amzDate(date)
  const stamp = amz.slice(0, 8)
  const path = o.path ?? '/'
  const query = o.query ?? ''
  const body = o.body ?? ''

  // Headers that get signed, keyed lowercase. host + x-amz-date are mandatory.
  const signed: Record<string, string> = { host: o.host, 'x-amz-date': amz }
  if (o.contentType) signed['content-type'] = o.contentType

  const names = Object.keys(signed).sort()
  const canonicalHeaders = names.map((n) => `${n}:${signed[n].trim()}\n`).join('')
  const signedHeaders = names.join(';')
  const payloadHash = sha256hex(body)

  const canonicalRequest = [o.method, path, query, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${stamp}/${o.region}/${o.service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonicalRequest)].join('\n')

  const kDate = hmac('AWS4' + o.secretAccessKey, stamp)
  const kRegion = hmac(kDate, o.region)
  const kService = hmac(kRegion, o.service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  const out: Record<string, string> = { Authorization: authorization, 'X-Amz-Date': amz }
  if (o.contentType) out['Content-Type'] = o.contentType
  return out
}
