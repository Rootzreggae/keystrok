// Run: node --experimental-strip-types lib/aws-sigv4.test.ts
// Checks the signer against AWS's published SigV4 "get-vanilla" test vector.
// If canonicalization or the signing-key chain drifts, this signature changes
// and every real IAM call would 403, so this is the one check that matters.
import assert from 'node:assert/strict'
import { signRequest, amzDate } from './aws-sigv4.ts'

assert.equal(amzDate(new Date('2015-08-30T12:36:00.000Z')), '20150830T123600Z')

// aws-sig-v4-test-suite / get-vanilla: GET / with host + x-amz-date, empty body.
const headers = signRequest({
  method: 'GET', host: 'example.amazonaws.com', service: 'service', region: 'us-east-1',
  accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  date: new Date('2015-08-30T12:36:00.000Z'),
})
const sig = headers.Authorization.match(/Signature=([0-9a-f]+)/)?.[1]
assert.equal(sig, '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31')

console.log('aws-sigv4: ok')
