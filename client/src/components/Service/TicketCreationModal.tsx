import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, MessageSquare, ShieldCheck, Wrench, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useTicketStore } from '../../store/useTicketStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import AttachmentZone from './AttachmentZone';

const TicketCreationModal: React.FC = () => {
    const { isOpen, ticketType, drafts, closeModal, updateDraft, clearDraft } = useTicketStore();
    const { token } = useAuthStore();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [, setDealers] = useState<any[]>([]);
    const [attachments, setAttachments] = useState<File[]>([]);

    const draft = drafts[ticketType];

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        try {
            const [prodRes, dealerRes] = await Promise.all([
                axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/system/dealers', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (prodRes.data.success) setProducts(prodRes.data.data);
            if (dealerRes.data.success) setDealers(dealerRes.data.data);
        } catch (err) {
            console.error('Failed to fetch modal data:', err);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        updateDraft(ticketType, { [field]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            Object.keys(draft).forEach(key => {
                if (draft[key] !== undefined && draft[key] !== null) {
                    formData.append(key, draft[key]);
                }
            });

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            const endpoint = ticketType === 'Inquiry' ? '/api/v1/inquiry-tickets' :
                ticketType === 'RMA' ? '/api/v1/rma-tickets' :
                    '/api/v1/dealer-repairs';

            const res = await axios.post(endpoint, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                clearDraft(ticketType);
                setAttachments([]);
                closeModal();
                // Optionally refresh the list or redirect
                window.location.reload();
            }
        } catch (err: any) {
            console.error('Failed to create ticket:', err);
            alert(err.response?.data?.error?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderTypeIcon = () => {
        switch (ticketType) {
            case 'Inquiry': return <MessageSquare className="text-blue-500" />;
            case 'RMA': return <ShieldCheck className="text-orange-500" />;
            case 'DealerRepair': return <Wrench className="text-green-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background border border-border">
                            {renderTypeIcon()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">
                                {ticketType === 'Inquiry' ? t('ticket.create.inquiry') :
                                    ticketType === 'RMA' ? t('ticket.create.rma') :
                                        t('ticket.create.dealerrepair')}
                            </h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
                                Kinefinity Service Operation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeModal}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-8">
                    <form id="ticket-form" onSubmit={handleSubmit} className="space-y-8">
                        {/* Section: Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('field.customer_name')}
                                </label>
                                <input
                                    type="text"
                                    className="w-full h-12 bg-muted/50 border-border rounded-xl px-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    value={draft.customer_name || ''}
                                    onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                                    placeholder="Enter customer name..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('field.customer_contact')}
                                </label>
                                <input
                                    type="text"
                                    className="w-full h-12 bg-muted/50 border-border rounded-xl px-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    value={draft.customer_contact || ''}
                                    onChange={(e) => handleFieldChange('customer_contact', e.target.value)}
                                    placeholder="Email or phone..."
                                />
                            </div>
                        </div>

                        {/* Section: Product Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('field.product')}
                                </label>
                                <select
                                    className="w-full h-12 bg-muted/50 border-border rounded-xl px-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    value={draft.product_id || ''}
                                    onChange={(e) => handleFieldChange('product_id', e.target.value)}
                                >
                                    <option value="">Select product...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('field.serial_number')}
                                </label>
                                <input
                                    type="text"
                                    className="w-full h-12 bg-muted/50 border-border rounded-xl px-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    value={draft.serial_number || ''}
                                    onChange={(e) => handleFieldChange('serial_number', e.target.value)}
                                    placeholder="S/N..."
                                />
                            </div>
                        </div>

                        {/* Section: Summary / Description */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                {ticketType === 'Inquiry' ? t('field.problem_summary') : t('field.problem_description')}
                            </label>
                            <textarea
                                className="w-full bg-muted/50 border-border rounded-xl p-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[120px]"
                                value={ticketType === 'Inquiry' ? (draft.problem_summary || '') : (draft.problem_description || '')}
                                onChange={(e) => handleFieldChange(ticketType === 'Inquiry' ? 'problem_summary' : 'problem_description', e.target.value)}
                                placeholder="Details..."
                            />
                        </div>

                        {/* Section: Attachments */}
                        <div className="space-y-4 pt-4 border-t border-border">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-primary" />
                                <h3 className="text-sm font-bold uppercase tracking-widest">{t('section.media_attachments')}</h3>
                            </div>
                            <AttachmentZone files={attachments} onFilesChange={setAttachments} />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-muted/30 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-2 italic">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Draft saved to local storage automatically
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-6 h-12 rounded-xl border border-border hover:bg-muted font-medium transition-colors"
                        >
                            {t('action.cancel')}
                        </button>
                        <button
                            type="submit"
                            form="ticket-form"
                            disabled={loading}
                            style={{ backgroundColor: 'var(--kine-yellow)' }}
                            className="px-8 h-12 rounded-xl text-black font-bold hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {t('action.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketCreationModal;
