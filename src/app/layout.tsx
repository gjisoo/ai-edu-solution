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
  title: 'Dev-Radar | GitHub 저장소 실시간 분석',
  description:
    'GitHub 저장소를 실시간 메타데이터, 커밋 신호, 스택 휴리스틱, 시장 적합도 기준으로 분석합니다.',
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
