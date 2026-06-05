/**
 * Remove background from an image using remove.bg API
 * Free tier: 50 images/month
 * Requires REMOVEBG_API_KEY in .env.local
 */
export async function removeBackground(imageBuffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  const apiKey = process.env.REMOVEBG_API_KEY
  if (!apiKey) {
    console.warn('REMOVEBG_API_KEY not set, skipping background removal')
    return null
  }

  try {
    const formData = new FormData()
    formData.append('image_file', new Blob([imageBuffer]), 'photo.png')
    formData.append('size', 'auto')
    formData.append('format', 'png')

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('remove.bg error:', response.status, error)
      return null
    }

    return await response.arrayBuffer()
  } catch (error) {
    console.error('remove.bg error:', error)
    return null
  }
}
