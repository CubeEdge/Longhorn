
import { useState, useEffect } from 'react';
import { translations, type Language } from './translations';

// Simple event bus for cross-component updates without context hell for this size
const listeners: Set<() => void> = new Set();

const notify = () => {
    listeners.forEach(l => l());
};

const getStoredLanguage = (): Language => {
    const stored = localStorage.getItem('longhorn_language');
    if (stored && ['zh', 'en', 'de', 'ja'].includes(stored)) {
        return stored as Language;
    }
    return 'zh'; // Default
};

let currentLanguage: Language = getStoredLanguage();

export const setLanguage = (lang: Language) => {
    currentLanguage = lang;
    localStorage.setItem('longhorn_language', lang);
    notify();
};

export const getCurrentLanguage = () => currentLanguage;

export const useLanguage = () => {
    const [lang, setLang] = useState<Language>(currentLanguage);

    useEffect(() => {
        // Immediately sync with current language on mount
        setLang(currentLanguage);

        const listener = () => setLang(currentLanguage);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    const t = (key: keyof typeof translations['zh'], params?: { [key: string]: string | number }) => {
        const dict = translations[lang] || translations['zh'];
        let text: string = dict[key as keyof typeof dict] || translations['zh'][key] || key;

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            });
        }
        return text;
    };

    return { language: lang, setLanguage, t };
};
