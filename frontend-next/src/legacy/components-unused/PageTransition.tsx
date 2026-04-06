/**
 * PageTransition - Instant page transitions (no delay)
 * Animation removed for faster page switching
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
