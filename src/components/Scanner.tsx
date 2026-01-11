import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'

const UPC_REGEX = /^[0-9]{12,13}$/

export function Scanner() {
  const navigate = useNavigate()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode("reader")
    scannerRef.current = scanner

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            setError(null)

            // Validate UPC format (12-13 digit numeric)
            if (!UPC_REGEX.test(decodedText)) {
              setError(`Invalid barcode format: ${decodedText} (must be 12-13 digits)`)
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([100, 50, 100])
              }
              return
            }

            // Haptics for successful scan
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(200)
            }

            // Stop scanner and navigate
            scanner.stop().then(() => {
              try {
                scanner.clear()
              } catch (e) {
                console.error("Failed to clear scanner", e)
              }
              navigate({
                to: '/product/$sku',
                params: { sku: decodedText }
              })
            }).catch(err => {
              console.error("Failed to stop scanner", err)
              // Still navigate even if stop fails
              navigate({
                to: '/product/$sku',
                params: { sku: decodedText }
              })
            })
          },
          () => {
            // Scan failed or still searching
          }
        )
      } catch (err) {
        console.error("Scanner start error:", err)
        setError("Camera access denied or unavailable")
      }
    }

    startScanner()

    return () => {
      const scanner = scannerRef.current
      if (!scanner) return

      try {
        if (scanner.isScanning) {
          scanner.stop()
            .then(() => {
              try { scanner.clear() } catch (e) { console.error("Clear error after stop:", e) }
            })
            .catch(e => console.error("Cleanup stop error:", e))
        } else {
          try { scanner.clear() } catch (e) { console.error("Clear error:", e) }
        }
      } catch (e) {
        console.error("Scanner cleanup error:", e)
      }
    }
  }, [navigate])

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div
        id="reader"
        className="overflow-hidden rounded-2xl border-4 border-marks-orange shadow-xl bg-black aspect-square"
      ></div>
      <div className="mt-6 text-center">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100 text-marks-navy text-sm font-medium animate-pulse border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-marks-orange mr-2"></span>
          Active Scanning...
        </div>
        <p className="mt-4 text-slate-500 text-sm">
          Align barcode within the frame to automatically scan
        </p>
        {error && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
