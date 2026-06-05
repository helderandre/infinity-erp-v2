"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { X, Camera, Video, SwitchCamera, Circle, Square, Send, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraCaptureProps {
  onCapture: (file: File, type: 'image' | 'video') => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [mode, setMode] = useState<'photo' | 'video'>('photo')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isRecording, setIsRecording] = useState(false)
  const [preview, setPreview] = useState<{ url: string; file: File; type: 'image' | 'video' } | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: mode === 'video',
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setPermissionDenied(false)
    } catch {
      setPermissionDenied(true)
    }
  }, [facingMode, mode])

  useEffect(() => {
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [startCamera])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setPreview({ url: URL.createObjectURL(blob), file, type: 'image' })
      }
    }, 'image/jpeg', 0.85)
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
    })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' })
      setPreview({ url: URL.createObjectURL(blob), file, type: 'video' })
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setIsRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const handleSend = () => {
    if (preview) {
      onCapture(preview.file, preview.type)
    }
  }

  const discardPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const toggleCamera = () => {
    setFacingMode(f => f === 'user' ? 'environment' : 'user')
  }

  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white gap-4">
        <Camera className="h-12 w-12 text-muted-foreground" />
        <p className="text-center max-w-xs">
          Permissão de câmera negada. Verifique as definições do browser para permitir o acesso.
        </p>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </div>
    )
  }

  if (preview) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          {preview.type === 'image' ? (
            <img src={preview.url} alt="Preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <video src={preview.url} controls className="max-h-full max-w-full object-contain" />
          )}
        </div>
        <div className="flex items-center justify-center gap-6 p-6">
          <Button variant="ghost" size="lg" onClick={discardPreview} className="text-white">
            <RotateCcw className="h-6 w-6 mr-2" /> Descartar
          </Button>
          <Button size="lg" onClick={handleSend} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Send className="h-5 w-5 mr-2" /> Enviar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button variant="ghost" size="icon" onClick={toggleCamera} className="text-white hover:bg-white/20">
          <SwitchCamera className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full object-contain" />
      </div>

      <div className="flex flex-col items-center gap-4 p-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('photo')}
            className={`text-white ${mode === 'photo' ? 'underline underline-offset-4' : 'opacity-60'}`}
          >
            <Camera className="h-4 w-4 mr-1" /> Foto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('video')}
            className={`text-white ${mode === 'video' ? 'underline underline-offset-4' : 'opacity-60'}`}
          >
            <Video className="h-4 w-4 mr-1" /> Vídeo
          </Button>
        </div>

        {mode === 'photo' ? (
          <button
            onClick={capturePhoto}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-colors flex items-center justify-center"
          >
            <Circle className="h-12 w-12 text-white fill-white" />
          </button>
        ) : (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-colors ${
              isRecording ? 'bg-red-500' : 'bg-white/20 hover:bg-white/40'
            }`}
          >
            {isRecording ? (
              <Square className="h-6 w-6 text-white fill-white" />
            ) : (
              <Circle className="h-12 w-12 text-red-500 fill-red-500" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
