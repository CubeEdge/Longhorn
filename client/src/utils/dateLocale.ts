/**
 * Date-fns Locale Utility
 * Returns the appropriate date-fns locale object based on the current language
 */

import { zhCN, enUS, de, ja } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { Language } from '../i18n/translations';

export const getDateLocale = (language: Language): Locale => {
    const localeMap: Record<Language, Locale> = {
        'zh': zhCN,
        'en': enUS,
        'de': de,
        'ja': ja
    };

    return localeMap[language] || enUS;
};
