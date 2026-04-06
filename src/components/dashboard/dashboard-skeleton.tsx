import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-[#eadfdb] bg-white/80 p-5 shadow-[0_14px_30px_rgba(235,193,166,0.12)]"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-[#eadfdb] bg-white/80 p-6 shadow-[0_14px_30px_rgba(235,193,166,0.12)]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-9 w-80" />
          <Skeleton className="mt-6 h-[360px] w-full rounded-[28px]" />
        </div>

        <div className="grid gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[32px] border border-[#eadfdb] bg-white/80 p-6 shadow-[0_14px_30px_rgba(235,193,166,0.12)]"
            >
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-3 h-8 w-72" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((__, row) => (
                  <Skeleton key={row} className="h-24 w-full rounded-[20px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-[#eadfdb] bg-white/80 p-6 shadow-[0_14px_30px_rgba(235,193,166,0.12)]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-8 w-80" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-[20px]" />
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[32px] border border-[#eadfdb] bg-white/80 p-6 shadow-[0_14px_30px_rgba(235,193,166,0.12)]"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-8 w-72" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((__, row) => (
                  <Skeleton key={row} className="h-20 w-full rounded-[20px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
