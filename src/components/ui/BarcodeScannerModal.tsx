"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type Props = {
  open: boolean
  title?: string
  description?: string
  onClose: () => void
  onDetected: (value: string) => void
}

type BarcodeDetectorResult = { rawValue: string }

function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window
}

export default function BarcodeScannerModal(props: Props) {
  const [error, setError] = useState<string>("")
  const [manualValue, setManualValue] = useState("")
  const [starting, setStarting] = useState(false)
  const [scanning, setScanning] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const supported = useMemo(() => hasBarcodeDetector(), [])

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
    }
    streamRef.current = null
    setScanning(false)
    setStarting(false)
  }, [])

  const close = useCallback(() => {
    stop()
    setError("")
    setManualValue("")
    props.onClose()
  }, [props, stop])

  const submitManual = useCallback(() => {
    const value = manualValue.trim()
    if (!value) return
    props.onDetected(value)
    close()
  }, [close, manualValue, props])

  const loopScan = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector as undefined | (new (init?: unknown) => { detect: (video: HTMLVideoElement) => Promise<BarcodeDetectorResult[]> })
      if (!Detector) return

      const detector = new Detector()
      const results = await detector.detect(video)
      const raw = results?.[0]?.rawValue?.trim()
      if (raw) {
        props.onDetected(raw)
        close()
        return
      }
    } catch {
      // ignore single-frame scan errors
    }

    rafRef.current = requestAnimationFrame(() => {
      void loopScan()
    })
  }, [close, props])

  const start = useCallback(async () => {
    if (!supported) {
      setError("Browser tidak mendukung BarcodeDetector. Gunakan input manual.")
      return
    }

    setError("")
    setStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) throw new Error("Video element tidak tersedia")
      video.srcObject = stream
      await video.play()
      setScanning(true)
      setStarting(false)
      void loopScan()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal mengakses kamera"
      setError(message)
      setStarting(false)
      setScanning(false)
    }
  }, [loopScan, supported])

  useEffect(() => {
    if (!props.open) {
      stop()
      return
    }
    void start()
    return () => stop()
  }, [props.open, start, stop])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "Enter" && !scanning) submitManual()
    }
    if (!props.open) return
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [close, props.open, scanning, submitManual])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{props.title || "Scan Barcode / QR"}</h3>
            <p className="mt-1 text-sm text-slate-600">{props.description || "Arahkan kamera ke barcode/QR, atau masukkan kode manual."}</p>
          </div>
          <button onClick={close} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Tutup
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
        </div>

        <div className="mt-3 text-xs text-slate-500">
          {starting ? "Mengaktifkan kamera..." : scanning ? "Scanning..." : supported ? "Kamera tidak aktif." : "BarcodeDetector tidak tersedia di browser ini."}
        </div>

        {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Input manual (barcode / SKU)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={submitManual}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!manualValue.trim()}
          >
            Gunakan
          </button>
        </div>
      </div>
    </div>
  )
}
