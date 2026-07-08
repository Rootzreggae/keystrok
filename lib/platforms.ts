import { prisma } from '@/lib/prisma'
import { decryptSecret, maskApiKey } from '@/lib/crypto'

// Shared platform list (masked keys only), used by BOTH the /api/platforms route
// and the server-side prefetch, so the two shapes can never drift. Caller is
// responsible for auth; the (authenticated) layout gates page access.
export async function getPlatforms() {
  const platforms = await prisma.platform.findMany({
    where: {},
    include: {
      _count: { select: { discoveredKeys: true } },
      discoveredKeys: {
        where: {
          expiresAt: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // next 30 days
        },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return platforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
    platform_type: platform.type,
    category: platform.category,
    api_url: platform.apiUrl,
    // Masked preview only. Never return key material to the client.
    api_key: platform.apiKey ? maskApiKey(decryptSecret(platform.apiKey)) : '',
    rotation_schedule: 90,
    description: platform.description,
    created_at: platform.createdAt.toISOString(),
    updated_at: platform.updatedAt.toISOString(),
    key_count: platform._count.discoveredKeys,
    expiring_count: platform.discoveredKeys.length,
    auth_type: platform.authType,
    auth_header: platform.authHeader,
    test_endpoint: platform.testEndpoint,
  }))
}
