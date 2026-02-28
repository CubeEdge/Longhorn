import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string | React.ReactNode;
}

interface KineSelectProps {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    placeholder?: string;
    width?: string;
}

export const KineSelect: React.FC<KineSelectProps> = ({ value, options, onChange, placeholder, width = '100%' }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Find selected option to get the label
    const selectedOption = options.find(o => o.value === value);
    // If selectedOption exists, use its label. If it's ReactNode (stringified if needed for display? No, ReactNode is renderable).
    // But we are rendering it inside a span with textOverflow. ReactNode might be complex. 
    // Usually for select display we prefer string, but KineSelect implementation allowed label to be passed directly.
    // In InquiryTicketListPage, labels are strings. '30d' -> t('filter.last_30_days').
    // But dynamic custom range was `${start} ~ ${end}` which is string.

    // In the original code: `const selectedLabel = options.find(o => o.value === value)?.label || placeholder || value;`
    // If label is ReactNode, it works in JSX.

    const selectedLabel = selectedOption?.label || placeholder || value;

    return (
        <div style={{ position: 'relative', width }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    background: 'var(--glass-bg-hover)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    transition: 'all 0.2s',
                    userSelect: 'none'
                }}
            >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                    {selectedLabel}
                </div>
                <ChevronDown size={14} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>

            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setIsOpen(false)} />
                    <div
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            width: '100%',
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
                        {options.map(opt => (
                            <div
                                key={opt.value}
                                onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    color: opt.value === value ? 'var(--accent-blue)' : 'var(--text-main)',
                                    background: opt.value === value ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s'
                                }}
                                onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                                onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
