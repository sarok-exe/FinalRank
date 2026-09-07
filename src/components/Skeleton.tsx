function SkeletonCard({ className = '' }: { className?: string }) {
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