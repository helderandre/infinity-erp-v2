'use client'

import { useState, useCallback } from 'react'
import imageCompression from 'browser-image-compression'

interface UseImageCompressReturn {
  compressImage: (file: File) => Promise<File>
  compressImages: (files: File[]) => Promise<File[]>
  isCompressing: boolean
  progress: number
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/webp' as const,
  initialQuality: 0.8,
  preserveExif: false,
}

export function useImageCompress(): UseImageCompressReturn {
  const [isCompressing, setIsCompressing] = useState(false)
  const [progress, setProgress] = useState(0)

  const compressImage = useCallback(async (file: File): Promise<File> => {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
    // Ensure the file has a .webp extension
    const name = file.name.replace(/\.[^.]+$/, '.webp')
    return new File([compressed], name, { type: 'image/webp' })
  }, [])

  const compressImages = useCallback(
    async (files: File[], concurrency = 2): Promise<File[]> => {
      setIsCompressing(true)
      setProgress(0)

      const results: File[] = new Array(files.length)
      let completed = 0
      let nextIndex = 0

      async function worker(): Promise<void> {
        while (nextIndex < files.length) {
          const idx = nextIndex++
          const compressed = await compressImage(files[idx])
          results[idx] = compressed
          completed++
          setProgress(Math.round((completed / files.length) * 100))
        }
      }

      const workers = Array.from(
        { length: Math.min(concurrency, files.length) },
        () => worker()
      )
      await Promise.all(workers)

      setIsCompressing(false)
      return results
    },
    [compressImage]
  )

  return { compressImage, compressImages, isCompressing, progress }
}
