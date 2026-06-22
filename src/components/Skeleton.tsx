export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ${className}`}>
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
          <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-4 w-3/4 bg-[var(--color-border)] rounded" />
        <div className="h-3 w-1/2 bg-[var(--color-border)] rounded" />
      </div>
    </div>
  );
}

export function SkeletonGameGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonBoard() {
  return (
    <div className="space-y-4 flex flex-col items-center w-full">
      <div className="flex w-full gap-3" style={{ maxWidth: 550 }}>
        <div className="w-8 bg-[var(--color-surface)] rounded animate-pulse" style={{ minHeight: 400 }} />
        <div className="flex-1 aspect-square bg-[var(--color-surface)] rounded animate-pulse" />
      </div>
      <div className="w-full h-10 bg-[var(--color-surface)] rounded-lg animate-pulse" style={{ maxWidth: 550 }} />
    </div>
  );
}

export function SkeletonMoveList() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <div className="h-4 w-8 bg-[var(--color-border)] rounded" />
          <div className="h-4 w-16 bg-[var(--color-border)] rounded" />
          <div className="h-4 w-16 bg-[var(--color-border)] rounded" />
        </div>
      ))}
    </div>
  );
}
