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
  title: 'Dev-Radar | AI 기반 개발 역량 실시간 관제 솔루션',
  description:
    'IDE, GitHub, 오류 로그, 채용 공고를 연결해 학습자의 개발 역량을 실시간으로 시각화하는 Dev-Radar 대시보드 MVP입니다.',
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
