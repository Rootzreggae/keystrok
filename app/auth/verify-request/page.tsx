import Link from 'next/link'
import { BrandMark } from '@/components/ks'

export default function VerifyRequest() {
  return (
    <div className="kb ks-auth">
      <div className="ks-auth__card">
        <div className="ks-auth__brand"><BrandMark /></div>
        <div className="ks-auth__h">Check your inbox</div>
        <div className="ks-auth__s">
          A one-time sign-in link is on its way. Open it on this device to continue; it expires shortly.
        </div>
        <Link href="/auth/signin" className="ks-btn ks-auth__btn" style={{ marginTop: 22, textDecoration: 'none' }}>
          Back to sign in
        </Link>
        <div className="ks-auth__foot">Read-only · Keystrok never rotates a key on its own</div>
      </div>
    </div>
  )
}
