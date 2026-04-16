'use client';

import { getCategoryStyle } from '../constants/categoryStyles';

interface Props {
  category: string;
  className?: string;
}

export function ImagePlaceholder({ category, className = '' }: Props) {
  const style = getCategoryStyle(category);

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${style.gradient} overflow-hidden ${className}`}>
      {/* 기하학 패턴 오버레이 */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={`dots-${category}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${category})`} />
      </svg>
      {/* 우하단 장식 원 */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/[0.06]" />
      <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full bg-white/[0.04]" />
    </div>
  );
}
