import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, MessageSquare, ShieldCheck, Wrench, Upload, Trash2, Image as ImageIcon, Video, FileText } from 'lucide-react';
import axios from 'axios';
import { useTicketStore } from '../../store/useTicketStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <ImageIcon size={16} className="text-blue-400" />;
        if (file.type.startsWith('video/')) return <Video size={16} className="text-purple-400" />;
        return <FileText size={16} className="text-gray-400" />;
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
            case 'Inquiry': return <MessageSquare className="text-blue-500" size={24} />;
            case 'RMA': return <ShieldCheck className="text-orange-500" size={24} />;
            case 'DealerRepair': return <Wrench className="text-green-500" size={24} />;
        }
    };

    const getTypeColor = () => {
        switch (ticketType) {
            case 'Inquiry': return 'border-blue-500/30 bg-blue-500/5';
            case 'RMA': return 'border-orange-500/30 bg-orange-500/5';
            case 'DealerRepair': return 'border-green-500/30 bg-green-500/5';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
            <div
                className="bg-[#1c1c1e] border border-white/10 rounded-2xl w-full max-w-[800px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
                style={{ animation: 'modalIn 0.2s ease-out' }}
            >
                {/* Header - macOS Sheet Style */}
                <div className={`flex items-center justify-between px-8 py-6 border-b border-white/10 ${getTypeColor()}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                            {renderTypeIcon()}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white tracking-tight">
                                {ticketType === 'Inquiry' ? t('ticket.create.inquiry') :
                                    ticketType === 'RMA' ? t('ticket.create.rma') :
                                        t('ticket.create.dealerrepair')}
                            </h2>
                            <p className="text-sm text-white/50 mt-0.5">
                                Kinefinity Service Operation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeModal}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body - Two Column Layout */}
                <div className="flex-1 overflow-y-auto p-8">
                    <form id="ticket-form" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Customer & Product Info */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest">
                                        客户信息
                                    </h3>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/70">
                                            {t('field.customer_name')}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 text-white placeholder-white/30 focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all outline-none"
                                            value={draft.customer_name || ''}
                                            onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                                            placeholder="输入客户名称..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/70">
                                            {t('field.customer_contact')}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 text-white placeholder-white/30 focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all outline-none"
                                            value={draft.customer_contact || ''}
                                            onChange={(e) => handleFieldChange('customer_contact', e.target.value)}
                                            placeholder="邮箱或电话..."
                                        />
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest">
                                        产品信息
                                    </h3>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/70">
                                            {t('field.product')}
                                        </label>
                                        <select
                                            className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 text-white focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all outline-none appearance-none cursor-pointer"
                                            value={draft.product_id || ''}
                                            onChange={(e) => handleFieldChange('product_id', e.target.value)}
                                        >
                                            <option value="" className="bg-[#1c1c1e]">选择产品...</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id} className="bg-[#1c1c1e]">{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/70">
                                            {t('field.serial_number')}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 text-white placeholder-white/30 focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all outline-none font-mono"
                                            value={draft.serial_number || ''}
                                            onChange={(e) => handleFieldChange('serial_number', e.target.value)}
                                            placeholder="S/N..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Description & Attachments */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest">
                                        问题详情
                                    </h3>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/70">
                                            {ticketType === 'Inquiry' ? t('field.problem_summary') : t('field.problem_description')}
                                        </label>
                                        <textarea
                                            className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all outline-none min-h-[160px] resize-none"
                                            value={ticketType === 'Inquiry' ? (draft.problem_summary || '') : (draft.problem_description || '')}
                                            onChange={(e) => handleFieldChange(ticketType === 'Inquiry' ? 'problem_summary' : 'problem_description', e.target.value)}
                                            placeholder="请详细描述问题..."
                                        />
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                {/* Attachments Section */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest">
                                        附件
                                    </h3>

                                    {/* Upload Zone */}
                                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all group">
                                        <Upload size={24} className="text-white/30 group-hover:text-white/50 mb-2" />
                                        <span className="text-sm text-white/40 group-hover:text-white/60">点击或拖拽文件到此处</span>
                                        <span className="text-xs text-white/20 mt-1">图片、视频、PDF (最大 50MB)</span>
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            accept="image/*,video/*,.pdf"
                                        />
                                    </label>

                                    {/* File List */}
                                    {attachments.length > 0 && (
                                        <div className="space-y-2">
                                            {attachments.map((file, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-lg group"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {getFileIcon(file)}
                                                        <span className="text-sm text-white/70 truncate">{file.name}</span>
                                                        <span className="text-xs text-white/30">
                                                            {(file.size / 1024 / 1024).toFixed(1)}MB
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAttachment(index)}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer - macOS Style */}
                <div className="px-8 py-5 border-t border-white/10 bg-black/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-white/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        草稿已自动保存
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-6 h-11 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 hover:text-white font-medium transition-all"
                        >
                            {t('action.cancel')}
                        </button>
                        <button
                            type="submit"
                            form="ticket-form"
                            disabled={loading}
                            style={{ backgroundColor: 'var(--kine-yellow)' }}
                            className="px-8 h-11 rounded-xl text-black font-semibold hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-yellow-500/20"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {t('action.create')}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default TicketCreationModal;
