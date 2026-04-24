/**
 * User Preferences Utility
 * Tracks user interactions with articles to provide personalized recommendations
 */

interface UserPreferencesData {
  keywords: Record<string, number>; // keyword -> count
  categories: Record<string, number>; // category -> count
  recentArticleIds: string[];
  lastUpdated: string;
}

const STORAGE_KEY = 'sedaily_user_preferences';
const MAX_RECENT_ARTICLES = 50;

export class UserPreferences {
  /**
   * Get user preferences from localStorage
   */
  static getPreferences(): UserPreferencesData {
    if (typeof window === 'undefined') {
      return {
        keywords: {},
        categories: {},
        recentArticleIds: [],
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return this.getDefaultPreferences();
      }

      const data = JSON.parse(stored) as UserPreferencesData;
      return data;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Save user preferences to localStorage
   */
  private static savePreferences(data: UserPreferencesData): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }

  /**
   * Get default preferences structure
   */
  private static getDefaultPreferences(): UserPreferencesData {
    return {
      keywords: {},
      categories: {},
      recentArticleIds: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Track article view
   */
  static trackArticleView(articleId: string, category?: string, keywords?: string[]): void {
    const prefs = this.getPreferences();

    // Add to recent articles
    if (!prefs.recentArticleIds.includes(articleId)) {
      prefs.recentArticleIds.unshift(articleId);
      if (prefs.recentArticleIds.length > MAX_RECENT_ARTICLES) {
        prefs.recentArticleIds = prefs.recentArticleIds.slice(0, MAX_RECENT_ARTICLES);
      }
    }

    // Track category
    if (category) {
      prefs.categories[category] = (prefs.categories[category] || 0) + 1;
    }

    // Track keywords
    if (keywords && keywords.length > 0) {
      keywords.forEach(keyword => {
        if (keyword && keyword.trim()) {
          const normalized = keyword.trim().toLowerCase();
          prefs.keywords[normalized] = (prefs.keywords[normalized] || 0) + 1;
        }
      });
    }

    prefs.lastUpdated = new Date().toISOString();
    this.savePreferences(prefs);
  }

  /**
   * Get top keywords by frequency
   */
  static getTopKeywords(limit: number = 10): string[] {
    const prefs = this.getPreferences();
    
    return Object.entries(prefs.keywords)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([keyword]) => keyword);
  }

  /**
   * Get top categories by frequency
   */
  static getTopCategories(limit: number = 3): string[] {
    const prefs = this.getPreferences();
    
    return Object.entries(prefs.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([category]) => category);
  }

  /**
   * Get recent article IDs
   */
  static getRecentArticleIds(limit?: number): string[] {
    const prefs = this.getPreferences();
    return limit ? prefs.recentArticleIds.slice(0, limit) : prefs.recentArticleIds;
  }

  /**
   * Clear all preferences
   */
  static clearPreferences(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear user preferences:', error);
    }
  }

  /**
   * Get preference statistics
   */
  static getStats(): {
    totalKeywords: number;
    totalCategories: number;
    totalArticles: number;
    lastUpdated: string;
  } {
    const prefs = this.getPreferences();
    
    return {
      totalKeywords: Object.keys(prefs.keywords).length,
      totalCategories: Object.keys(prefs.categories).length,
      totalArticles: prefs.recentArticleIds.length,
      lastUpdated: prefs.lastUpdated
    };
  }
}
