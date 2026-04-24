/**
 * Google Analytics 4 Event Tracking Utilities
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export function trackEvent({ action, category, label, value }: AnalyticsEvent) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

export function trackArticleView({
  title,
  category,
  newsId,
  author,
}: {
  title: string;
  category: string;
  newsId: string;
  author?: string;
}) {
  trackEvent({
    action: 'view_article',
    category: 'engagement',
    label: `${category} - ${title}`,
  });

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'view_item', {
      item_id: newsId,
      item_name: title,
      item_category: category,
      item_author: author,
    });
  }
}

export function trackSearch({ query, resultsCount }: { query: string; resultsCount?: number }) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'search', {
      search_term: query,
      results_count: resultsCount,
    });
  }
}

export function trackNewsletterSignup({ email }: { email: string }) {
  trackEvent({
    action: 'newsletter_signup',
    category: 'conversion',
    label: email,
  });

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'sign_up', {
      method: 'newsletter',
    });
  }
}

export function trackOutboundLink({ url, label }: { url: string; label?: string }) {
  trackEvent({
    action: 'click_outbound',
    category: 'engagement',
    label: label || url,
  });

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'click', {
      link_url: url,
      link_domain: new URL(url).hostname,
      outbound: true,
    });
  }
}

export function trackSocialShare({ platform, url, title }: { platform: string; url: string; title: string }) {
  trackEvent({
    action: 'share',
    category: 'engagement',
    label: `${platform} - ${title}`,
  });

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'share', {
      method: platform,
      content_type: 'article',
      item_id: url,
    });
  }
}

export function trackCategoryView({ category }: { category: string }) {
  trackEvent({
    action: 'view_category',
    category: 'navigation',
    label: category,
  });
}

export function trackVideoPlay({ videoId, title }: { videoId: string; title: string }) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'video_start', {
      video_title: title,
      video_provider: 'Naver TV',
      video_url: `https://tv.naver.com/v/${videoId}`,
    });
  }
}

export function trackAdClick({ adSlot, adPosition }: { adSlot: string; adPosition: string }) {
  trackEvent({
    action: 'ad_click',
    category: 'ads',
    label: `${adPosition} - ${adSlot}`,
  });
}

export function track404Error({ path }: { path: string }) {
  trackEvent({
    action: '404_error',
    category: 'error',
    label: path,
  });
}

export function trackPageTiming({
  name,
  value,
  category = 'performance',
}: {
  name: string;
  value: number;
  category?: string;
}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'timing_complete', {
      name,
      value: Math.round(value),
      event_category: category,
    });
  }
}

export function trackScrollDepth({ depth }: { depth: number }) {
  trackEvent({
    action: 'scroll',
    category: 'engagement',
    label: `${depth}%`,
    value: depth,
  });
}
