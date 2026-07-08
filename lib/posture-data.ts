import { prisma } from '@/lib/prisma'
import { computePosture } from '@/lib/posture'

// Secret-hygiene SLOs + backlog trend for one user, shared by BOTH the
// /api/posture route and the server-side prefetch so the two can never drift.
// Lives apart from lib/posture.ts to keep that module prisma-free (it has pure
// unit tests). Caller ensures auth.
export async function getPostureData(userId: string) {
  const keys = await prisma.discoveredKey.findMany({
    where: { userId },
    select: { foundAt: true, exposedAt: true, rotatedAt: true, liveStatus: true, liveCheckedAt: true, status: true, severity: true },
  })
  // JSON round-trip so the hydrated shape is identical to what a client fetch
  // returns (computePosture may emit Dates; the API route serializes them).
  return JSON.parse(JSON.stringify(computePosture(keys)))
}
