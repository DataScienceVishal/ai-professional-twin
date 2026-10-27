interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`bg-wash motion-safe:animate-pulse ${className}`} />
}
