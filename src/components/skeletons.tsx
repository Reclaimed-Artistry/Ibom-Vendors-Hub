/**
 * Route-transition skeletons.
 *
 * Each segment ships a `loading.tsx` so a click paints its frame immediately
 * while the server data streams in, and so the App Router can prefetch the
 * shell of a dynamic route before it is opened.
 */

export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 ${className}`} aria-hidden />;
}

export function PageSkeleton({ title = true, rows = 3 }: { title?: boolean; rows?: number }) {
  return (
    <div className="container-page py-8">
      {title ? (
        <div className="space-y-3">
          <Bar className="h-8 w-64" />
          <Bar className="h-4 w-96 max-w-full" />
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card card-pad space-y-3">
            <Bar className="h-32 w-full" />
            <Bar className="h-4 w-3/4" />
            <Bar className="h-4 w-1/2" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Bar key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton({ tiles = 4, rows = 6 }: { tiles?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Bar className="h-7 w-56" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: tiles }).map((_, index) => (
          <div key={index} className="card card-pad space-y-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-6 w-16" />
            <Bar className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="card card-pad space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Bar key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
