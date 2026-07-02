'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { BrandMark } from '@/components/ks'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await signIn('email', { email, redirect: false })
      if (result?.error) setError('Could not send the link. Check the address and try again.')
      else setSent(true)
    } catch {
      setError('Could not send the link. Check the address and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="kb ks-auth">
      <div className="ks-auth__card">
        <div className="ks-auth__brand"><BrandMark /></div>

        {sent ? (
          <>
            <div className="ks-auth__h">Check your inbox</div>
            <div className="ks-auth__s">
              We sent a one-time sign-in link to <b>{email}</b>. Open it on this device; it expires shortly.
            </div>
            <button className="ks-btn ks-auth__btn" style={{ marginTop: 22 }} onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <div className="ks-auth__h">Sign in</div>
            <div className="ks-auth__s">Enter your email and we&apos;ll send a one-time magic link. No passwords to manage.</div>
            <form className="ks-auth__form" onSubmit={handleSubmit}>
              <div>
                <label className="ks-auth__lbl" htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ks-input"
                  placeholder="you@company.com"
                />
              </div>
              <button type="submit" disabled={loading} className="ks-btn ks-btn--primary ks-auth__btn">
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
            {error && <div className="ks-auth__msg fail">{error}</div>}
          </>
        )}

        <div className="ks-auth__foot">Read-only · Keystrok never rotates a key on its own</div>
      </div>
    </div>
  )
}
