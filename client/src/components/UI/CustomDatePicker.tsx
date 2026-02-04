import React, { useState } from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
    value: string;
    onChange: (val: string) => void;
    label: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewDate)),
        end: endOfWeek(endOfMonth(viewDate))
    });

    const handleSelect = (date: Date) => {
        onChange(format(date, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', fontWeight: 500 }}>
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
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: isOpen ? '1px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                <Calendar size={18} color={isOpen ? '#FFD700' : 'rgba(255,255,255,0.4)'} />
                <span style={{ fontSize: '0.95rem', color: value ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: 500, lineHeight: 1 }}>
                    {value || 'Select Date'}
                </span>
            </div>

            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }} onClick={() => setIsOpen(false)} />
                    <div
                        style={{
                            position: 'absolute',
                            top: '110%',
                            left: 0,
                            width: '320px',
                            background: '#1C1C1E',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '20px',
                            zIndex: 3001,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <button onClick={() => setViewDate(subMonths(viewDate, 1))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px', color: '#fff', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{format(viewDate, 'MMMM yyyy')}</div>
                            <button onClick={() => setViewDate(addMonths(viewDate, 1))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px', color: '#fff', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {days.map(day => {
                                const isCurrentMonth = isSameMonth(day, viewDate);
                                const isSelected = value && isSameDay(day, new Date(value));
                                return (
                                    <button
                                        key={day.toString()}
                                        onClick={() => handleSelect(day)}
                                        style={{
                                            height: '36px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: isSelected ? '#FFD700' : 'transparent',
                                            color: isSelected ? '#000' : isCurrentMonth ? '#fff' : 'rgba(255,255,255,0.1)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: isSelected ? 600 : 400
                                        }}
                                        onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
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
