import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { CitizenProvider } from "@/contexts/CitizenContext"
import { ConversationsProvider } from "@/contexts/ConversationsContext"
import Sidebar from "@/components/layout/Sidebar"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Citizen Agent",
  description: "AI-powered citizen navigation agent — find every government benefit you qualify for",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans antialiased bg-gray-50">
        <LanguageProvider>
          <CitizenProvider>
            <ConversationsProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 overflow-hidden">
                  {children}
                </main>
              </div>
            </ConversationsProvider>
          </CitizenProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
