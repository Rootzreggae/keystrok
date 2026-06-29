export default function VerifyRequest() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Check your email</h2>
          <p className="mt-2 text-gray-600">
            A magic link has been sent to your email address.
          </p>
        </div>
        <div className="p-6 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            Click the link in your email to sign in. The link will expire in 24 hours.
          </p>
        </div>
      </div>
    </div>
  )
}