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
    async (files: File[]): Promise<File[]> => {
      setIsCompressing(true)
      setProgress(0)

      const results: File[] = []
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i])
        results.push(compressed)
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }

      setIsCompressing(false)
      return results
    },
    [compressImage]
  )

  return { compressImage, compressImages, isCompressing, progress }
}
