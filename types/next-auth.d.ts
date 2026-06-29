import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `auth()`, `getSession()`, `getServerSession()`
   * Extends the default session to include user.id
   */
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
    } & DefaultSession["user"]
  }

  /**
   * The shape of the user object from the database
   * Used in callbacks
   */
  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    emailVerified?: Date | null
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    id: string
    email: string
    emailVerified: Date | null
  }
}
