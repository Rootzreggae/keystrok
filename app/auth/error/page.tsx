'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { BrandMark } from '@/components/ks'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: "This email isn't approved for access yet. Keystrok is currently invite-only.",
    Verification: 'The sign-in link is no longer valid. It may have been used already, or it may have expired.',
    EmailSignin: "We couldn't send the sign-in link. If you just requested one, wait a few minutes before trying again.",
    Default: 'Something went wrong during sign-in.',
  }

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default

  return (
    <div className="kb ks-auth">
      <div className="ks-auth__card">
        <div className="ks-auth__brand"><BrandMark /></div>
        <div className="ks-auth__h">Sign-in error</div>
        <div className="ks-auth__s">{errorMessage}</div>
        {error && <div className="ks-auth__msg fail" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Code: {error}</div>}
        <Link href="/auth/signin" className="ks-btn ks-btn--primary ks-auth__btn" style={{ marginTop: 22, textDecoration: 'none' }}>
          Try again
        </Link>
        <div className="ks-auth__foot">Read-only · Keystrok never rotates a key on its own</div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  )
}
