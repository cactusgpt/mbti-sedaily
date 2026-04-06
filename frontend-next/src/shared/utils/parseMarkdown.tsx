import React from 'react';

/**
 * Parse basic markdown formatting in article content
 * Supports: **bold**, *italic*
 *
 * @param text - The text to parse
 * @returns React elements with proper formatting
 */
export function parseMarkdownText(text: string): React.ReactNode {
  if (!text) return null;

  // Pattern to match **bold** and *italic* text
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Match **bold** text (must be non-greedy and handle multiple occurrences)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;

  while ((match = boldPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the bold text
    parts.push(
      <strong key={`bold-${match.index}`} className="font-bold">
        {match[1]}
      </strong>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no matches found, return original text
  if (parts.length === 0) {
    return text;
  }

  return <>{parts}</>;
}
