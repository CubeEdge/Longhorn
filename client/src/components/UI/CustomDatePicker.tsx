import React, { useState, useRef, useEffect } from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths, isBefore, isAfter, startOfDay, setYear, setMonth } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface CustomDatePickerProps {
    value: string;
    onChange: (val: string) => void;
    label: string;
    showTime?: boolean;
    minDate?: string;
    maxDate?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, label, showTime = false, minDate, maxDate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
    const [showYearSelector, setShowYearSelector] = useState(false);
    const [showMonthSelector, setShowMonthSelector] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const yearSelectorRef = useRef<HTMLDivElement>(null);
    const monthSelectorRef = useRef<HTMLDivElement>(null);
    const yearListRef = useRef<HTMLDivElement>(null);
    const monthListRef = useRef<HTMLDivElement>(null);

    // Generate year options (current year ± 30 years)
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 61 }, (_, i) => currentYear - 30 + i);
    const monthOptions = [
        { value: 0, label: '1月' }, { value: 1, label: '2月' },
        { value: 2, label: '3月' }, { value: 3, label: '4月' },
        { value: 4, label: '5月' }, { value: 5, label: '6月' },
        { value: 6, label: '7月' }, { value: 7, label: '8月' },
        { value: 8, label: '9月' }, { value: 9, label: '10月' },
        { value: 10, label: '11月' }, { value: 11, label: '12月' }
    ];

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewDate)),
        end: endOfWeek(endOfMonth(viewDate))
    });

    const handleSelect = (date: Date) => {
        onChange(format(date, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    // 检测位置，决定向上或向下显示
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const calendarHeight = 380; // 日历弹窗大约高度
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // 如果下方空间不足且上方空间足够，则向上显示
            if (spaceBelow < calendarHeight && spaceAbove > calendarHeight) {
                setPosition('top');
            } else {
                setPosition('bottom');
            }
        }
    }, [isOpen]);

    // Close selectors when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (yearSelectorRef.current && !yearSelectorRef.current.contains(e.target as Node)) {
                setShowYearSelector(false);
            }
            if (monthSelectorRef.current && !monthSelectorRef.current.contains(e.target as Node)) {
                setShowMonthSelector(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll to current year when year selector opens
    useEffect(() => {
        if (showYearSelector && yearListRef.current) {
            const currentYearElement = yearListRef.current.querySelector(`[data-year="${viewDate.getFullYear()}"]`) as HTMLElement;
            if (currentYearElement) {
                currentYearElement.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [showYearSelector, viewDate]);

    // Scroll to current month when month selector opens
    useEffect(() => {
        if (showMonthSelector && monthListRef.current) {
            const currentMonthElement = monthListRef.current.querySelector(`[data-month="${viewDate.getMonth()}"]`) as HTMLElement;
            if (currentMonthElement) {
                currentMonthElement.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [showMonthSelector, viewDate]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {label}
            </label>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    height: '44px',
                    background: 'var(--glass-bg-light)',
                    border: isOpen ? '1px solid #FFD700' : '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '0 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                <Calendar size={18} color={isOpen ? 'var(--accent-blue)' : 'var(--text-tertiary)'} />
                <span style={{ fontSize: 14, color: value ? 'var(--text-main)' : 'var(--text-tertiary)', fontWeight: 500, lineHeight: 1 }}>
                    {value ? (showTime ? value : value.split('T')[0]) : '选择日期'}
                </span>
            </div>

            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }} onClick={() => setIsOpen(false)} />
                    <div
                        style={{
                            position: 'absolute',
                            [position === 'bottom' ? 'top' : 'bottom']: position === 'bottom' ? '110%' : '110%',
                            left: 0,
                            width: '320px',
                            background: 'var(--bg-sidebar)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            padding: '20px',
                            zIndex: 3001,
                            boxShadow: '0 20px 40px var(--glass-shadow-lg)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <button onClick={() => setViewDate(subMonths(viewDate, 1))} style={{ background: 'var(--glass-bg-hover)', border: 'none', borderRadius: '8px', padding: '6px', color: 'var(--text-main)', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                            
                            {/* Year and Month Selectors */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                                {/* Year Selector */}
                                <div ref={yearSelectorRef} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => {
                                            setShowYearSelector(!showYearSelector);
                                            setShowMonthSelector(false);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '4px 8px', background: 'var(--glass-bg-hover)',
                                            border: '1px solid var(--glass-border)', borderRadius: '6px',
                                            color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {format(viewDate, 'yyyy')}
                                        <ChevronDown size={14} style={{ transform: showYearSelector ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    </button>
                                    {showYearSelector && (
                                        <div ref={yearListRef} style={{
                                            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                            marginTop: 4, maxHeight: '200px', overflowY: 'auto',
                                            background: 'var(--bg-sidebar)', border: '1px solid var(--glass-border)',
                                            borderRadius: '8px', padding: '4px', zIndex: 10,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                            width: '80px'
                                        }}>
                                            {yearOptions.map(year => (
                                                <button
                                                    key={year}
                                                    data-year={year}
                                                    onClick={() => {
                                                        setViewDate(setYear(viewDate, year));
                                                        setShowYearSelector(false);
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '6px 8px', textAlign: 'center',
                                                        background: year === viewDate.getFullYear() ? 'var(--accent-blue)' : 'transparent',
                                                        color: year === viewDate.getFullYear() ? 'var(--bg-main)' : 'var(--text-main)',
                                                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                        fontSize: '0.85rem', fontWeight: year === viewDate.getFullYear() ? 600 : 400
                                                    }}
                                                >
                                                    {year}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Month Selector */}
                                <div ref={monthSelectorRef} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => {
                                            setShowMonthSelector(!showMonthSelector);
                                            setShowYearSelector(false);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '4px 8px', background: 'var(--glass-bg-hover)',
                                            border: '1px solid var(--glass-border)', borderRadius: '6px',
                                            color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {format(viewDate, 'MMM')}
                                        <ChevronDown size={14} style={{ transform: showMonthSelector ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    </button>
                                    {showMonthSelector && (
                                        <div ref={monthListRef} style={{
                                            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                            marginTop: 4, maxHeight: '200px', overflowY: 'auto',
                                            background: 'var(--bg-sidebar)', border: '1px solid var(--glass-border)',
                                            borderRadius: '8px', padding: '4px', zIndex: 10,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                            width: '70px'
                                        }}>
                                            {monthOptions.map(month => (
                                                <button
                                                    key={month.value}
                                                    data-month={month.value}
                                                    onClick={() => {
                                                        setViewDate(setMonth(viewDate, month.value));
                                                        setShowMonthSelector(false);
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '6px 8px', textAlign: 'center',
                                                        background: month.value === viewDate.getMonth() ? 'var(--accent-blue)' : 'transparent',
                                                        color: month.value === viewDate.getMonth() ? 'var(--bg-main)' : 'var(--text-main)',
                                                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                        fontSize: '0.85rem', fontWeight: month.value === viewDate.getMonth() ? 600 : 400
                                                    }}
                                                >
                                                    {month.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <button onClick={() => setViewDate(addMonths(viewDate, 1))} style={{ background: 'var(--glass-bg-hover)', border: 'none', borderRadius: '8px', padding: '6px', color: 'var(--text-main)', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {days.map(day => {
                                const isCurrentMonth = isSameMonth(day, viewDate);
                                const isSelected = value && isSameDay(day, new Date(value));
                                
                                // Check if date is disabled
                                const dayStart = startOfDay(day);
                                const minDateObj = minDate ? startOfDay(new Date(minDate)) : null;
                                const maxDateObj = maxDate ? startOfDay(new Date(maxDate)) : null;
                                const isDisabled = !!(minDateObj && isBefore(dayStart, minDateObj)) || 
                                                   !!(maxDateObj && isAfter(dayStart, maxDateObj));
                                
                                return (
                                    <button
                                        key={day.toString()}
                                        onClick={() => !isDisabled && handleSelect(day)}
                                        disabled={isDisabled}
                                        style={{
                                            height: '36px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: isSelected ? 'var(--accent-blue)' : 'transparent',
                                            color: isDisabled ? 'var(--text-tertiary)' : (isSelected ? 'var(--bg-main)' : isCurrentMonth ? 'var(--text-main)' : 'var(--glass-bg-hover)'),
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: isSelected ? 600 : 400,
                                            opacity: isDisabled ? 0.3 : 1
                                        }}
                                        onMouseEnter={e => !isSelected && !isDisabled && (e.currentTarget.style.background = 'var(--glass-bg-hover)')}
                                        onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
