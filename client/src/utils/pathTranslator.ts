/**
 * Path Translation Utilities
 * Translates department codes in path segments for UI display
 */

/**
 * Translates a single path segment (e.g., "MS" or "市场部 (MS)")
 * to the localized department name (e.g., "Marketing (MS)")
 * 
 * @param segment - Path segment to translate
 * @param t - Translation function from useLanguage hook
 * @returns Translated segment or original if no translation exists
 */
export const translatePathSegment = (segment: string, t: (key: any) => string): string => {
    // Decode URL encoding first
    const decoded = decodeURIComponent(segment);

    // Extract dept code from formats like "市场部 (MS)" or just "MS"
    const codeMatch = decoded.match(/\(([A-Z]{2,3})\)$/);
    const code = codeMatch
        ? codeMatch[1]
        : (decoded.length <= 3 && /^[A-Z]+$/.test(decoded) ? decoded : null);

    if (code) {
        const transKey = `dept.${code}`;
        const translated = t(transKey);

        // If translation exists and isn't just the key itself
        if (translated !== transKey) {
            return `${translated} (${code})`;
        }
    }

    // Return original if no translation found
    return decoded;
};

/**
 * Translates an entire path (e.g., "MS/ProjectA/File.jpg")
 * Useful for display purposes
 * 
 * @param fullPath - Full path string
 * @param t - Translation function
 * @returns Path with translated segments
 */
export const translateFullPath = (fullPath: string, t: (key: any) => string): string => {
    return fullPath
        .split('/')
        .filter(Boolean)
        .map(segment => translatePathSegment(segment, t))
        .join(' / ');
};
