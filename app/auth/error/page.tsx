'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: "This email isn't approved for access yet. Keystrok is currently invite-only. Join the waitlist to request access.",
    Verification: 'The sign in link is no longer valid. It may have been used already or it may have expired.',
    EmailSignin: "We couldn't send the sign-in link. If you just requested one, wait a few minutes before trying again.",
    Default: 'An error occurred during authentication.',
  }

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-red-600">Authentication Error</h2>
          <p className="mt-4 text-gray-600">{errorMessage}</p>
          {error && (
            <p className="mt-2 text-sm text-gray-500">Error code: {error}</p>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/auth/signin"
            className="inline-flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </Link>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>If this problem persists, please contact support.</p>
        </div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}