import type { Metadata } from 'next'
import { Gowun_Dodum, Noto_Sans_KR } from 'next/font/google'

import './globals.css'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '500', '700', '800'],
})

const gowunDodum = Gowun_Dodum({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Dev-Radar | Live GitHub Repository Analysis',
  description:
    'Analyze a GitHub repository with live metadata, commit signals, stack heuristics, and market-fit scoring.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${notoSansKr.variable} ${gowunDodum.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
