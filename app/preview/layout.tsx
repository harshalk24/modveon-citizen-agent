import type { ReactNode } from "react"
import Link from "next/link"

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Sticky yellow banner */}
      <div className="sticky top-0 z-50 bg-yellow-400 text-yellow-900 text-xs font-medium py-2 px-4 flex justify-between items-center">
        <span>⚡ Preview mode — vision demo · not the live product</span>
        <Link href="/chat" className="underline hover:text-yellow-800 transition-colors">
          ← Back to live product
        </Link>
      </div>
      {children}
    </div>
  )
}
