/**
 * DeactivateDealerModal Component
 * 经销商停用对话框
 * 
 * 功能：
 * - 停用经销商账户
 * - 选择客户转移方式（直客/其他经销商）
 * - 记录停用原因
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { AlertTriangle, X, Loader2, Users, Building2, User } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface Account {
    id: number;
    name: string;
    account_type: string;
    dealer_code?: string;
    region?: string;
}

interface DeactivateDealerModalProps {
    isOpen: boolean;
    onClose: () => void;
    dealer: Account | null;
    onSuccess: () => void;
}

const DeactivateDealerModal: React.FC<DeactivateDealerModalProps> = ({
    isOpen,
    onClose,
    dealer,
    onSuccess
}) => {
    const { t } = useTranslation();
    const { token } = useAuthStore();
    
    const [reason, setReason] = useState('');
    const [transferType, setTransferType] = useState<'dealer_to_direct' | 'dealer_to_dealer'>('dealer_to_direct');
    const [successorDealerId, setSuccessorDealerId] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [activeDealers, setActiveDealers] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingDealers, setFetchingDealers] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 获取活跃经销商列表（用于转移选择）
    useEffect(() => {
        if (isOpen && transferType === 'dealer_to_dealer') {
            fetchActiveDealers();
        }
    }, [isOpen, transferType]);

    const fetchActiveDealers = async () => {
        setFetchingDealers(true);
        try {
            const res = await axios.get('/api/v1/accounts', {
                params: {
                    account_type: 'DEALER',
                    is_active: 'true'
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.success) {
                // 排除当前要停用的经销商
                setActiveDealers(res.data.data.filter((d: Account) => d.id !== dealer?.id));
            }
        } catch (err) {
            console.error('Failed to fetch dealers:', err);
        } finally {
            setFetchingDealers(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dealer) return;

        setLoading(true);
        setError(null);

        try {
            const res = await axios.post(
                `/api/v1/accounts/${dealer.id}/deactivate`,
                {
                    reason,
                    transfer_type: transferType,
                    successor_account_id: transferType === 'dealer_to_dealer' ? successorDealerId : null,
                    notes
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.success) {
                onSuccess();
                onClose();
                // 重置表单
                setReason('');
                setTransferType('dealer_to_direct');
                setSuccessorDealerId(null);
                setNotes('');
            }
        } catch (err: any) {
            console.error('Failed to deactivate dealer:', err);
            setError(err.response?.data?.error?.message || t('common.operationFailed'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !dealer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#1c1c1e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#2c2c2e]">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-[#FFD700]" />
                        <h2 className="text-lg font-semibold text-white">
                            {t('dealer.deactivateTitle') || '停用经销商'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Dealer Info */}
                    <div className="bg-[#2c2c2e] rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <Building2 className="w-5 h-5 text-[#FFD700]" />
                            <span className="font-medium text-white">{dealer.name}</span>
                        </div>
                        {dealer.dealer_code && (
                            <div className="text-sm text-gray-400 ml-8">
                                经销商编码: {dealer.dealer_code}
                            </div>
                        )}
                        {dealer.region && (
                            <div className="text-sm text-gray-400 ml-8">
                                地区: {dealer.region}
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('dealer.deactivationReason') || '停用原因'} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('dealer.deactivationReasonPlaceholder') || '例如：停止合作'}
                            className="w-full px-4 py-2.5 bg-[#2c2c2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30"
                            required
                        />
                    </div>

                    {/* Transfer Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            {t('dealer.customerTransfer') || '客户转移方式'} <span className="text-red-400">*</span>
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#2c2c2e] cursor-pointer hover:border-[#FFD700]/30 transition-colors">
                                <input
                                    type="radio"
                                    name="transferType"
                                    value="dealer_to_direct"
                                    checked={transferType === 'dealer_to_direct'}
                                    onChange={(e) => setTransferType(e.target.value as any)}
                                    className="w-4 h-4 accent-[#FFD700]"
                                />
                                <User className="w-5 h-5 text-gray-400" />
                                <div>
                                    <div className="text-white font-medium">
                                        {t('dealer.transferToDirect') || '转为直客'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {t('dealer.transferToDirectDesc') || '由 Kinefinity 直接服务这些客户'}
                                    </div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#2c2c2e] cursor-pointer hover:border-[#FFD700]/30 transition-colors">
                                <input
                                    type="radio"
                                    name="transferType"
                                    value="dealer_to_dealer"
                                    checked={transferType === 'dealer_to_dealer'}
                                    onChange={(e) => setTransferType(e.target.value as any)}
                                    className="w-4 h-4 accent-[#FFD700]"
                                />
                                <Users className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                    <div className="text-white font-medium">
                                        {t('dealer.transferToDealer') || '转移给其他经销商'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {t('dealer.transferToDealerDesc') || '选择一个经销商接管这些客户'}
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Successor Dealer Selection */}
                    {transferType === 'dealer_to_dealer' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('dealer.selectSuccessor') || '选择新经销商'} <span className="text-red-400">*</span>
                            </label>
                            {fetchingDealers ? (
                                <div className="flex items-center gap-2 text-gray-400 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('common.loading')}
                                </div>
                            ) : activeDealers.length === 0 ? (
                                <div className="text-yellow-500 text-sm py-2">
                                    {t('dealer.noActiveDealers') || '没有其他活跃经销商可选'}
                                </div>
                            ) : (
                                <select
                                    value={successorDealerId || ''}
                                    onChange={(e) => setSuccessorDealerId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-4 py-2.5 bg-[#2c2c2e] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#FFD700]/50"
                                    required={transferType === 'dealer_to_dealer'}
                                >
                                    <option value="">{t('dealer.selectDealerPlaceholder') || '请选择经销商'}</option>
                                    {activeDealers.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} {d.dealer_code ? `(${d.dealer_code})` : ''} {d.region ? `- ${d.region}` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('common.notes') || '备注'} ({t('common.optional') || '可选'})
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('dealer.deactivationNotesPlaceholder') || '补充说明...'}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-[#2c2c2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 resize-none"
                        />
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-gray-300 space-y-1">
                                <p className="font-medium text-white">{t('dealer.deactivationWarning') || '停用后影响：'}</p>
                                <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                                    <li>{t('dealer.warning1') || '该经销商不再出现在新建工单的选择列表中'}</li>
                                    <li>{t('dealer.warning2') || '历史工单仍保留该经销商信息'}</li>
                                    <li>{t('dealer.warning3') || '联系人将标记为"已离职"状态'}</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
                        >
                            {t('common.cancel') || '取消'}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !reason || (transferType === 'dealer_to_dealer' && !successorDealerId)}
                            className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {t('dealer.confirmDeactivate') || '确认停用'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeactivateDealerModal;
