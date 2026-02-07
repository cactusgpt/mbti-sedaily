export function formatDate(dateString: string): string {
  // Extract date part to avoid timezone conversion issues
  // published_at format: "2025-12-23T00:00:00.000+09:00"
  const datePart = dateString.substring(0, 10); // "2025-12-23"
  const [year, month, day] = datePart.split('-');

  // Create date without timezone conversion
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

export function formatKoreanStyle(dateString: string): string {
  // Parse ISO datetime: "2026-01-08T17:06:38.000+09:00"
  // Always display in KST (Korea Standard Time, UTC+9) regardless of server/client timezone
  const date = new Date(dateString);

  // Convert to KST using Intl.DateTimeFormat for consistent timezone handling
  const kstFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = kstFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hours = getPart('hour');
  const minutes = getPart('minute');
  const seconds = getPart('second');

  return `${year}.${month}.${day}. ${hours}:${minutes}:${seconds}`;
}

export function formatPublishedUpdated(publishedAt: string, updatedAt?: string): string {
  const published = `Published ${formatKoreanStyle(publishedAt)}`;
  
  if (updatedAt && updatedAt !== publishedAt) {
    const updated = `Updated ${formatKoreanStyle(updatedAt)}`;
    return `${published}\n${updated}`;
  }
  
  return published;
}

export function formatRelativeTime(dateString: string): string {
  // Parse the full ISO timestamp with timezone: "2025-12-23T09:50:06.000+09:00"
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return formatDate(dateString);
  }
}
