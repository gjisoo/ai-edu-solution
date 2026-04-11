'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'

import type { DevMetric } from '@/types/dev-radar'

const labelMap: Array<{
  key: keyof DevMetric
  label: string
}> = [
  { key: 'readability', label: '가독성' },
  { key: 'efficiency', label: '효율성' },
  { key: 'security', label: '보안성' },
  { key: 'architecture', label: '구조 설계' },
  { key: 'consistency', label: '일관성' },
  { key: 'modernity', label: '현대성' },
]

export function RadarMetricChart({ metrics }: { metrics: DevMetric }) {
  const chartData = labelMap.map((item) => ({
    subject: item.label,
    score: metrics[item.key],
    fullMark: 100,
  }))

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,0.92fr)_minmax(0,1.08fr)]">
      <div className="min-w-0 rounded-[28px] border border-[#eadfdb] bg-white/90 p-3 shadow-[0_16px_34px_rgba(235,193,166,0.14)]">
        <ResponsiveContainer width="100%" height={320} minWidth={260}>
          <RadarChart data={chartData} outerRadius="76%">
            <PolarGrid stroke="rgba(188, 170, 153, 0.55)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#4c5569', fontSize: 12, fontWeight: 700 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fill: '#9b8f86', fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              dataKey="score"
              stroke="#8c7df8"
              fill="#a79bff"
              fillOpacity={0.34}
              strokeWidth={2.5}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3">
        {chartData.map((item) => (
          <article
            key={item.subject}
            className="rounded-2xl border border-[#eadfdb] bg-white/90 p-4 shadow-[0_14px_30px_rgba(235,193,166,0.12)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {item.subject}
                </p>
                <strong className="mt-2 block text-2xl font-black tracking-tight text-slate-800">
                  {item.score}점
                </strong>
              </div>
              <span className="rounded-full bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7f70eb]">
                현재 점수
              </span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#f3e8e2]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8c7df8] to-[#7ed9c3] transition-all duration-700"
                style={{ width: `${item.score}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
