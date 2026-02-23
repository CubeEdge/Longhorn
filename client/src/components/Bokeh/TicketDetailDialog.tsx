import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, User, Package, Calendar, FileText } from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../../i18n/useLanguage';

interface TicketDetailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticketNumber: string;
    ticketId: number;
    ticketType: 'inquiry' | 'rma' | 'dealer_repair';
}

interface TicketDetail {
    ticket_number: string;
    customer_name?: string;
    product_model?: string;
    serial_number?: string;
    problem_summary?: string;
    problem_description?: string;
    resolution?: string;
    status: string;
    created_at: string;
    closed_at?: string;
}

const TicketDetailDialog: React.FC<TicketDetailDialogProps> = ({
    isOpen,
    onClose,
    ticketNumber,
    ticketId,
    ticketType
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        if (isOpen && ticketId) {
            fetchTicketDetail();
        }
    }, [isOpen, ticketId, ticketType]);

    const fetchTicketDetail = async () => {
        setLoading(true);
        setError('');
        try {
            const endpoints = {
                inquiry: `/api/v1/inquiry-tickets/${ticketId}`,
                rma: `/api/v1/rma-tickets/${ticketId}`,
                dealer_repair: `/api/v1/dealer-repairs/${ticketId}`
            };

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await axios.get(endpoints[ticketType], { signal: controller.signal });
            clearTimeout(timeout);
            setTicket(response.data);
        } catch (err: any) {
            console.error('Failed to fetch ticket:', err);
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                setError(t('bokeh.ticket.timeout'));
            } else {
                setError(err.response?.data?.error || t('bokeh.ticket.load_failed'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenInSystem = () => {
        const routes = {
            inquiry: `/inquiry-tickets/${ticketId}`,
            rma: `/rma-tickets/${ticketId}`,
            dealer_repair: `/dealer-repairs/${ticketId}`
        };
        window.location.href = routes[ticketType];
    };

    const getTypeLabel = () => {
        switch (ticketType) {
            case 'inquiry': return t('bokeh.ticket.type_inquiry');
            case 'rma': return t('bokeh.ticket.type_rma');
            case 'dealer_repair': return t('bokeh.ticket.type_dealer');
            default: return '';
        }
    };

    // ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)'
                }}
            />

            {/* Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '500px',
                    maxWidth: 'calc(100vw - 32px)',
                    maxHeight: 'calc(100vh - 64px)',
                    background: 'rgba(28, 28, 30, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                    zIndex: 10001,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0, 191, 165, 0.1)'
                }}>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
                            {ticketNumber}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                            {getTypeLabel()}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '4px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.6)' }}>
                            {t('bokeh.ticket.loading')}
                        </div>
                    )}

                    {error && (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div style={{ color: '#ff6b6b', marginBottom: '16px' }}>{error}</div>
                            <button
                                onClick={onClose}
                                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}
                            >
                                {t('action.close')}
                            </button>
                        </div>
                    )}

                    {ticket && !loading && !error && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Customer Info */}
                            {ticket.customer_name && (
                                <InfoRow icon={<User size={16} />} label="客户" value={ticket.customer_name} />
                            )}

                            {/* Product Info */}
                            {ticket.product_model && (
                                <InfoRow
                                    icon={<Package size={16} />}
                                    label="产品"
                                    value={`${ticket.product_model}${ticket.serial_number ? ` (SN: ${ticket.serial_number})` : ''}`}
                                />
                            )}

                            {/* Dates */}
                            {ticket.created_at && (
                                <InfoRow
                                    icon={<Calendar size={16} />}
                                    label="创建时间"
                                    value={new Date(ticket.created_at).toLocaleString('zh-CN')}
                                />
                            )}

                            {/* Problem Description */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '8px',
                                padding: '12px',
                                borderLeft: '3px solid #00BFA5'
                            }}>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileText size={14} />
                                    {t('bokeh.ticket.problem_desc')}
                                </div>
                                <div style={{ fontSize: '14px', color: 'white', lineHeight: '1.6' }}>
                                    {ticket.problem_summary || ticket.problem_description || t('bokeh.ticket.none')}
                                </div>
                            </div>

                            {/* Resolution */}
                            {ticket.resolution && (
                                <div style={{
                                    background: 'rgba(0, 191, 165, 0.1)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    borderLeft: '3px solid #00BFA5'
                                }}>
                                    <div style={{ fontSize: '12px', color: '#00BFA5', marginBottom: '8px', fontWeight: 600 }}>
                                        ✅ {t('bokeh.ticket.resolution')}
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'white', lineHeight: '1.6' }}>
                                        {ticket.resolution}
                                    </div>
                                </div>
                            )}

                            {/* Status */}
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                {t('bokeh.ticket.status')}: <span style={{ color: '#00BFA5', fontWeight: 600 }}>{ticket.status}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <button
                        onClick={handleOpenInSystem}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#00BFA5',
                            color: 'black',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#00D4B4'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#00BFA5'}
                    >
                        <ExternalLink size={16} />
                        {t('bokeh.ticket.open_in_system')}
                    </button>
                </div>
            </motion.div>
        </>
    );
};
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{icon}</div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '14px', color: 'white' }}>{value}</div>
        </div>
    </div>
);

export default TicketDetailDialog;
