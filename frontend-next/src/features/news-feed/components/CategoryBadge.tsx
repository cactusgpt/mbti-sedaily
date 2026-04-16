'use client';

import { getCategoryStyle } from '../constants/categoryStyles';

interface Props {
  category: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'overlay';
}

export function CategoryBadge({ category, size = 'sm', variant = 'default' }: Props) {
  const style = getCategoryStyle(category);

  if (variant === 'overlay') {
    return (
      <span className={`inline-block rounded-full font-semibold backdrop-blur-md bg-white/20 text-white border border-white/20 ${
        size === 'md'
          ? 'text-[12px] px-3 py-1'
          : 'text-[11px] px-2.5 py-0.5'
      }`}>
        {category}
      </span>
    );
  }

  return (
    <span className={`inline-block rounded-full font-medium ring-1 ${style.badge} ${
      size === 'md'
        ? 'text-[12px] px-3 py-1'
        : 'text-[11px] px-2.5 py-0.5'
    }`}>
      {category}
    </span>
  );
}
