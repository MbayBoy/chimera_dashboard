const SkeletonLoader = ({ className = '' }) => (
  <div className={`animate-pulse bg-muted rounded ${className}`} />
);

export const SkeletonCard = () => (
  <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-8 w-8 bg-muted rounded-lg" />
    </div>
    <div className="h-8 bg-muted rounded w-1/2 mb-2" />
    <div className="h-3 bg-muted rounded w-1/4" />
  </div>
);

export const SkeletonTableRow = ({ cols = 5 }) => (
  <tr className="border-b border-border">
    {Array.from({ length: cols })?.map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
      </td>
    ))}
  </tr>
);

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="p-4 border-b border-border">
      <div className="h-5 bg-muted rounded w-1/4 animate-pulse" />
    </div>
    <table className="w-full">
      <thead>
        <tr className="border-b border-border">
          {Array.from({ length: cols })?.map((_, i) => (
            <th key={i} className="px-4 py-3 text-left">
              <div className="h-3 bg-muted rounded animate-pulse w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows })?.map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

export const SkeletonList = ({ items = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: items })?.map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg animate-pulse">
        <div className="h-8 w-8 bg-muted rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-3/4 mb-1" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
        <div className="h-6 bg-muted rounded w-16" />
      </div>
    ))}
  </div>
);

export const SkeletonGrid = ({ items = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: items })?.map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonLoader;
