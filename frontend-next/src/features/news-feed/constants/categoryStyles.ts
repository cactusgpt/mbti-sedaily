export const CATEGORY_STYLES: Record<string, {
  gradient: string;
  badge: string;
  accent: string;
}> = {
  '경제': {
    gradient: 'from-blue-600 to-indigo-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200/60',
    accent: '#2563eb',
  },
  '국제': {
    gradient: 'from-emerald-600 to-teal-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
    accent: '#059669',
  },
  '테크': {
    gradient: 'from-violet-600 to-purple-500',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200/60',
    accent: '#7c3aed',
  },
  '산업': {
    gradient: 'from-slate-600 to-gray-500',
    badge: 'bg-slate-50 text-slate-700 ring-slate-200/60',
    accent: '#475569',
  },
  '사회': {
    gradient: 'from-amber-500 to-orange-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200/60',
    accent: '#d97706',
  },
  '문화': {
    gradient: 'from-rose-500 to-pink-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200/60',
    accent: '#e11d48',
  },
  '정치': {
    gradient: 'from-red-600 to-rose-500',
    badge: 'bg-red-50 text-red-700 ring-red-200/60',
    accent: '#dc2626',
  },
};

const DEFAULT_CATEGORY_STYLE = {
  gradient: 'from-gray-500 to-gray-400',
  badge: 'bg-gray-50 text-gray-700 ring-gray-200/60',
  accent: '#6b7280',
};

export function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] || DEFAULT_CATEGORY_STYLE;
}
