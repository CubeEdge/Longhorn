import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Check, ArrowUpDown, ChevronDown } from 'lucide-react';

interface SortOption {
    field: string;
    label: string;
}

interface SortDropdownProps {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    onChange: (field: string, order: 'asc' | 'desc') => void;
    options: SortOption[];
    width?: string;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
    sortBy,
    sortOrder,
    onChange,
    options,
    width = '40px'
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Handle option click - toggle order if same field, otherwise set new field with desc
    const handleOptionClick = (field: string) => {
        if (field === sortBy) {
            // Toggle order
            const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
            onChange(field, newOrder);
        } else {
            // New field, default to desc (newest first for dates)
            onChange(field, 'desc');
        }
        setIsOpen(false);
    };

    return (
        <div style={{ position: 'relative', width }}>
            {/* Finder-style icon button - ArrowUpDown with dropdown indicator on right */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'var(--glass-bg-hover)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <ArrowUpDown size={16} style={{ color: 'var(--text-main)', opacity: 0.8 }} />
                    {/* Dropdown indicator on the right side */}
                    <ChevronDown size={10} style={{ color: 'var(--text-main)', opacity: 0.5 }} />
                </div>
            </div>

            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setIsOpen(false)} />
                    <div
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            minWidth: '160px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px',
                            padding: '4px',
                            zIndex: 101,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                        }}
                    >
                        {options.map(opt => {
                            const isSelected = opt.field === sortBy;
                            return (
                                <div
                                    key={opt.field}
                                    onClick={(e) => { e.stopPropagation(); handleOptionClick(opt.field); }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        color: isSelected ? 'var(--accent-blue)' : 'var(--text-main)',
                                        background: isSelected ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.1s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    {/* Check mark on the left */}
                                    {isSelected ? (
                                        <Check size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                                    ) : (
                                        <div style={{ width: 14, flexShrink: 0 }} />
                                    )}
                                    <span style={{ flex: 1 }}>{opt.label}</span>
                                    {/* Sort direction indicator on the right */}
                                    {isSelected && (
                                        sortOrder === 'desc' ? (
                                            <ArrowDown size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                                        ) : (
                                            <ArrowUp size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
