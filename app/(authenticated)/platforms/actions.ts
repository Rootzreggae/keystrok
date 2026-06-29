'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { encryptSecret, decryptSecret, maskApiKey, isMaskedSecret } from '@/lib/crypto'

export async function getPlatforms() {
  const session = await auth()
  if (!session?.user?.id) return []

  const platforms = await prisma.platform.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  })

  // Never hand key material (plaintext or ciphertext) to the client. Replace
  // apiKey with a server-computed masked preview for display only.
  return platforms.map((platform) => ({
    ...platform,
    apiKey: platform.apiKey ? maskApiKey(decryptSecret(platform.apiKey)) : '',
  }))
}

export async function createPlatform(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const userId = session.user.id

  // Debug logging to see what form data we're receiving
  console.log('Form data received:', {
    name: formData.get('name'),
    type: formData.get('type'),
    category: formData.get('category'),
    apiUrl: formData.get('apiUrl'),
    apiKey: formData.get('apiKey') ? '[MASKED]' : null,
    authType: formData.get('authType'),
    authHeader: formData.get('authHeader'),
    testEndpoint: formData.get('testEndpoint'),
    description: formData.get('description')
  })

  const rawApiKey = (formData.get('apiKey') as string | null) || ''

  const platform = await prisma.platform.create({
    data: {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      category: formData.get('category') as string,
      apiUrl: formData.get('apiUrl') as string,
      // Encrypt at rest. Skip if the value is empty or a masked placeholder.
      apiKey: rawApiKey && !isMaskedSecret(rawApiKey) ? encryptSecret(rawApiKey) : '',
      authType: formData.get('authType') as string || 'bearer',
      authHeader: formData.get('authHeader') as string || 'Authorization',
      testEndpoint: formData.get('testEndpoint') as string | null,
      description: formData.get('description') as string | null,
      userId
    }
  })

  // Log activity
  await prisma.activity.create({
    data: {
      action: 'platform_added',
      description: `Added ${platform.name} (${platform.type}) platform with API key`,
      userId
    }
  })

  revalidatePath('/platforms')
  return platform
}

export async function deletePlatform(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const userId = session.user.id
  const platformId = formData.get('id') as string

  // Verify ownership
  const platform = await prisma.platform.findFirst({
    where: { id: platformId, userId }
  })

  if (!platform) throw new Error('Platform not found')

  await prisma.platform.delete({
    where: { id: platformId }
  })

  // Log activity
  await prisma.activity.create({
    data: {
      action: 'platform_removed',
      description: `Removed ${platform.name} from platform configurations`,
      userId
    }
  })

  revalidatePath('/platforms')
}