import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { WalletProvider } from '../context/WalletContext'
import { ConnectWallet } from '../components/ConnectWallet'
import Link from 'next/link'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'StellarSplit — On-Chain Bill Splitting',
  description:
    'Split bills with friends on the Stellar blockchain. Create group expenses, track who owes what, and settle debts on-chain via Soroban smart contracts.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#0a0a14',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen">
        <WalletProvider>
          {/* Sticky nav bar */}
          <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-bold text-slate-100 transition-colors hover:text-indigo-400"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                  S
                </span>
                StellarSplit
              </Link>
              <ConnectWallet />
            </div>
          </header>

          {/* Main content */}
          <main className="mx-auto max-w-5xl px-4 py-8">
            {children}
          </main>
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  )
}
