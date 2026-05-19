import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { CitizenProvider } from "@/contexts/CitizenContext"
import Sidebar from "@/components/layout/Sidebar"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Citizen Assist — El Salvador",
  description: "AI-powered citizen navigation agent for El Salvador government benefits",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans antialiased bg-gray-50">
        <LanguageProvider>
          <CitizenProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 overflow-hidden">
                {children}
              </main>
            </div>
          </CitizenProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
