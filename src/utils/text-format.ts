/**
 * Abbreviates text by taking the first letter of each word and adding periods.
 * Only abbreviates if there are more than two words.
 * @param text The text to abbreviate
 * @returns The abbreviated text or original text if 2 or fewer words
 */
export function abbreviateText(text: string): string {
    const words = text.trim().split(/\s+/);
    if (words.length <= 2) {
        return text; // Return original text if 2 or fewer words
    }
    return words.map(word => word.charAt(0).toUpperCase()).join('.') + '.';
} 