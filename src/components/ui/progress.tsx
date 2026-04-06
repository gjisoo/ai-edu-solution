import * as React from 'react'

import { cn } from '@/lib/utils'

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-[#f3e8e2]',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full w-full flex-1 rounded-full bg-primary transition-all duration-700 ease-out',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
      />
    </div>
  ),
)
Progress.displayName = 'Progress'

export { Progress }
