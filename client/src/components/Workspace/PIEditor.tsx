import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Send, FileText, Plus, Trash2, Download, FileInput, Settings } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../store/useToast';

import { exportToPDF } from '../../utils/pdfExport';
import ConfirmModal from '../Service/ConfirmModal';

interface PIEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    piId?: number | null;  // null for new PI
    onSuccess: () => void;
    onReview?: () => void;  // Callback when review is needed
}

interface PIItem {
    id: string;
    part_id?: number;       // 关联 parts_master.id
    part_number?: string;   // SKU（用于查询英文名称）
    description: string;
    description_en?: string; // 英文描述
    quantity: number;
    unit_price: number;
    total: number;
}

interface PIOtherFee {
    id: string;
    description: string;
    description_en?: string; // 英文描述
    amount: number;
}

interface PIContent {
    header: {
        title: string;
        subtitle: string;
    };
    customer_info: {
        name: string;
        address: string;
        contact: string;
        email: string;
    };
    device_info: {
        product_name: string;
        product_name_en?: string;
        serial_number: string;
        firmware_version: string;
    };
    items: PIItem[];
    other_fees: PIOtherFee[];
    terms: {
        payment_terms: string;
        delivery_terms: string;
        valid_days: number;
    };
    notes: string;
}

interface PIData {
    id?: number;
    pi_number?: string;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
    content: PIContent;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    currency: string;
    version: number;
    created_by?: { id: number; display_name: string };
    created_at?: string;
    updated_at?: string;
    reviewed_by?: { id: number; display_name: string };
    reviewed_at?: string;
    review_comment?: string;
}

const DEFAULT_CONTENT: PIContent = {
    header: {
        title: 'KINEFINITY TECHNOLOGY CO., LTD.',
        subtitle: 'Proforma Invoice / 形式发票'
    },
    customer_info: {
        name: '',
        address: '',
        contact: '',
        email: ''
    },
    device_info: {
        product_name: '',
        serial_number: '',
        firmware_version: ''
    },
    items: [],
    other_fees: [],
    terms: {
        payment_terms: '100% Prepayment',
        delivery_terms: 'Express Shipping',
        valid_days: 7
    },
    notes: ''
};

export const PIEditor: React.FC<PIEditorProps> = ({
    isOpen, onClose, ticketId, ticketNumber, piId, onSuccess
}) => {
    const { token, user } = useAuthStore();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [systemSettings, setSystemSettings] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [importing, setImporting] = useState(false); // 导入状态
    const [showPdfSettings, setShowPdfSettings] = useState(false); // PDF设置面板
    // Confirm modal state - 支持多种确认类型
    const [confirmAction, setConfirmAction] = useState<{
        type: 'recall' | 'import_replace' | 'import_append' | 'import_success' | 'import_empty' | 'no_report' | 'custom' | null;
        isOpen: boolean;
        data?: any;
    }>({ type: null, isOpen: false });
    
    const confirmModalResultRef = useRef<((value: boolean) => void) | null>(null);
    const showConfirm = (title: string, message: string, type: 'danger' | 'warning' | 'info' = 'warning', confirmText = '确认', cancelText = '取消') => {
        return new Promise<boolean>((resolve) => {
            confirmModalResultRef.current = resolve;
            setConfirmAction({
                type: 'custom',
                isOpen: true,
                data: { title, message, type, confirmText, cancelText }
            });
        });
    };

    // 待导入的项目（用于确认后处理）
    const [pendingImportItems, setPendingImportItems] = useState<PIItem[]>([]);
    const [pendingImportOtherFees, setPendingImportOtherFees] = useState<PIOtherFee[]>([]);
    // 存储当前导入的维修报告数据
    const [importSourceReport, setImportSourceReport] = useState<any>(null);
    // PDF export settings - 扩展设置项
    const [pdfSettings, setPdfSettings] = useState({
        format: 'a4' as 'a4' | 'letter',
        orientation: 'portrait' as 'portrait' | 'landscape',
        language: 'original' as 'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE',
        showHeader: true,
        showFooter: true,
        headerText: 'Kinefinity',
        footerText: ''
    });

    const [piData, setPIData] = useState<PIData>({
        status: 'draft',
        content: DEFAULT_CONTENT,
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        currency: 'CNY',
        version: 1
    });

    // 预览语言设置（独立于PDF设置，用于实时预览）
    const [previewLanguage, setPreviewLanguage] = useState<'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE'>('original');

    // Translations state - 存储各字段的翻译
    const [translations] = useState<Record<string, Record<string, any>>>({});

    // Load existing PI or initialize from ticket data
    useEffect(() => {
        if (isOpen) {
            // 加载系统设置（用于获取汇率）
            axios.get('/api/v1/system/public-settings').then(res => {
                if (res.data?.success) {
                    setSystemSettings(res.data.data);
                }
            }).catch(() => {});

            if (piId) {
                loadPI();
            } else {
                initializeFromTicket();
            }
        }
    }, [isOpen, piId, ticketId]);

    const loadPI = async () => {
        if (!piId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/rma-documents/pi/${piId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const incomingData = res.data.data;
                // Defensive merge to ensure all content structure exists
                setPIData({
                    ...incomingData,
                    content: {
                        ...DEFAULT_CONTENT,
                        ...(incomingData.content || {}),
                        header: { ...DEFAULT_CONTENT.header, ...(incomingData.content?.header || {}) },
                        customer_info: { ...DEFAULT_CONTENT.customer_info, ...(incomingData.content?.customer_info || {}) },
                        device_info: { ...DEFAULT_CONTENT.device_info, ...(incomingData.content?.device_info || {}) },
                        terms: { ...DEFAULT_CONTENT.terms, ...(incomingData.content?.terms || {}) }
                    }
                });

                // 同步服务端最新配件外币价格（未发布状态下）
                if (['draft', 'pending_review', 'rejected', ''].includes(incomingData.status || '')) {
                    const items = incomingData.content?.items || [];
                    const skus = items.filter((p: any) => p.part_number).map((p: any) => p.part_number);
                    if (skus.length > 0) {
                        try {
                            const pricesRes = await axios.post(`/api/v1/parts-master/batch`, { skus }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            if (pricesRes.data?.success) {
                                const priceMap = pricesRes.data.data.reduce((acc: any, part: any) => {
                                    let targetPrice = part.price_cny;
                                    if (incomingData.currency === 'USD') targetPrice = part.price_usd;
                                    else if (incomingData.currency === 'EUR') targetPrice = part.price_eur;
                                    acc[part.sku] = Number(targetPrice || 0);
                                    return acc;
                                }, {});

                                setPIData(prev => {
                                    const newItems = prev.content.items.map((item: any) => {
                                        if (item.part_number && priceMap[item.part_number] !== undefined) {
                                            const newPrice = priceMap[item.part_number];
                                            return {
                                                ...item,
                                                unit_price: newPrice,
                                                total: Number(item.quantity || 1) * newPrice
                                            };
                                        }
                                        return item;
                                    });

                                    const itemsSubtotal = newItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
                                    const otherFeesTotal = prev.content.other_fees.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0);
                                    const subtotal = itemsSubtotal + otherFeesTotal;
                                    const taxAmount = subtotal * (Number(prev.tax_rate || 0) / 100);
                                    const totalAmount = subtotal + taxAmount - Number(prev.discount_amount || 0);

                                    return {
                                        ...prev,
                                        content: { ...prev.content, items: newItems },
                                        subtotal,
                                        tax_amount: taxAmount,
                                        total_amount: totalAmount
                                    };
                                });
                            }
                        } catch (err) {
                            console.error('Failed to sync latest PI prices on load:', err);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load PI:', err);
            alert('加载PI失败');
        } finally {
            setLoading(false);
        }
    };

    const initializeFromTicket = async () => {
        setLoading(true);
        try {
            // Fetch ticket data to pre-populate
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const ticket = res.data.data;
                console.log('PIEditor: Ticket data loaded:', { 
                    account_name: ticket.account_name, 
                    contact_name: ticket.contact_name, 
                    reporter_name: ticket.reporter_name,
                    account: ticket.account
                });

                // Construct address from ticket if available
                let customerAddress = ticket.account_address || '';
                if (!customerAddress && ticket.billing_address) {
                    customerAddress = ticket.billing_address;
                }
                
                // Get customer name from account_name or account.name
                const customerName = ticket.account_name || ticket.account?.name || '';
                // Get contact name from contact_name or reporter_name or reporter_snapshot
                const contactName = ticket.contact_name || ticket.reporter_name || ticket.reporter_snapshot?.name || '';
                // Get email from contact_email or contact.email or reporter_snapshot
                const email = ticket.contact_email || ticket.contact?.email || ticket.reporter_snapshot?.email || '';

                // 生成 PI 编号：PI-工单号-V1（草稿时显示准备发布的版本号）
                const generatedPINumber = `PI-${ticketNumber}-V1`;

                setPIData(prev => ({
                    ...prev,
                    pi_number: generatedPINumber,
                    content: {
                        ...prev.content,
                        customer_info: {
                            name: customerName,
                            address: customerAddress,
                            contact: contactName,
                            email: email
                        },
                        device_info: {
                            product_name: ticket.product_name || '',
                            product_name_en: ticket.product_name_en || '',
                            serial_number: ticket.serial_number || '',
                            firmware_version: ticket.firmware_version || ''
                        }
                    }
                }));

                // Try to fetch latest published repair report to import items
                try {
                    const reportRes = await axios.get(`/api/v1/rma-documents/repair-reports?ticket_id=${ticketId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (reportRes.data.success && reportRes.data.data.length > 0) {
                        // Get the latest one (usually the first if sorted by created_at DESC)
                        const latestReportMeta = reportRes.data.data[0];

                        // Fetch the full content of this report
                        const fullReportRes = await axios.get(`/api/v1/rma-documents/repair-reports/${latestReportMeta.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        if (fullReportRes.data.success) {
                            const report = fullReportRes.data.data;
                            const reportContent = report.content;

                            const newItems: PIItem[] = [];

                            // 1. Add parts
                            if (reportContent.repair_process?.parts_replaced) {
                                reportContent.repair_process.parts_replaced.forEach((part: any) => {
                                    newItems.push({
                                        id: `part-${part.id || Date.now() + Math.random()}`,
                                        part_id: part.part_id,  // 关联 parts_master.id
                                        description: part.part_number ? `${part.name} (${part.part_number})` : part.name,
                                        quantity: part.quantity || 1,
                                        unit_price: part.unit_price || 0,
                                        total: (part.quantity || 1) * (part.unit_price || 0)
                                    });
                                });
                            }

                            // 2. Add labor
                            if (reportContent.labor_charges) {
                                reportContent.labor_charges.forEach((labor: any, idx: number) => {
                                    newItems.push({
                                        id: `labor-${idx}-${Date.now()}`,
                                        description: `Labor: ${labor.description}`,
                                        quantity: labor.hours || 1,
                                        unit_price: labor.rate || 0,
                                        total: labor.total || 0
                                    });
                                });
                            }

                            // 3. Add shipping fee (logistics)
                            if (reportContent.logistics?.shipping_fee && reportContent.logistics.shipping_fee > 0) {
                                newItems.push({
                                    id: `shipping-${Date.now()}`,
                                    description: `Shipping: ${reportContent.logistics.shipping_method || 'Express'}`,
                                    quantity: 1,
                                    unit_price: reportContent.logistics.shipping_fee,
                                    total: reportContent.logistics.shipping_fee
                                });
                            }

                            if (newItems.length > 0) {
                                const taxRate = piData.tax_rate || 0;
                                const discountAmount = piData.discount_amount || 0;
                                const { subtotal, taxAmount, total } = calculateTotals(newItems, piData.content.other_fees, taxRate, discountAmount);
                                setPIData(prev => ({
                                    ...prev,
                                    content: {
                                        ...prev.content,
                                        items: newItems
                                    },
                                    subtotal,
                                    tax_amount: taxAmount,
                                    total_amount: total
                                }));
                            }
                        }
                    }
                } catch (reportErr) {
                    console.error('Failed to auto-import items from repair report:', reportErr);
                }
            }
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    // 从维修报告导入费用数据
    const importFromRepairReport = async () => {
        setImporting(true);
        try {
            const reportRes = await axios.get(`/api/v1/rma-documents/repair-reports?ticket_id=${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!reportRes.data.success || reportRes.data.data.length === 0) {
                setConfirmAction({ type: 'no_report', isOpen: true });
                return;
            }
            
            // 获取最新的维修报告（优先已发布，其次草稿）
            // 注：状态只有 published 和 draft 两种
            const reports = reportRes.data.data;
            const publishedReport = reports.find((r: any) => r.status === 'published');
            const draftReport = reports.find((r: any) => r.status === 'draft');
            const targetReport = publishedReport || draftReport || reports[0];
            
            if (!targetReport) {
                setConfirmAction({ type: 'no_report', isOpen: true });
                return;
            }
            
            // 获取报告详情
            const fullReportRes = await axios.get(`/api/v1/rma-documents/repair-reports/${targetReport.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!fullReportRes.data.success) {
                setConfirmAction({ type: 'no_report', isOpen: true, data: { message: '无法获取维修报告详情' } });
                return;
            }
            
            const report = fullReportRes.data.data;
            const reportContent = report.content;
            const newItems: PIItem[] = [];
            const newOtherFees: PIOtherFee[] = [];
            
            // 1. 导入更换零件
            if (reportContent.repair_process?.parts_replaced) {
                reportContent.repair_process.parts_replaced.forEach((part: any) => {
                    newItems.push({
                        id: `part-${Date.now()}-${Math.random()}`,
                        part_id: part.part_id,
                        part_number: part.part_number,  // 保存 SKU 用于查询英文名
                        description: `零件: ${part.name}${part.part_number ? ` (${part.part_number})` : ''}`,
                        description_en: part.part_number ? undefined : undefined,  // 配件英文名通过 SKU 查询
                        quantity: part.quantity || 1,
                        unit_price: part.unit_price || 0,
                        total: (part.quantity || 1) * (part.unit_price || 0)
                    });
                });
            }
            
            // 2. 导入工时费用
            if (reportContent.labor_charges && reportContent.labor_charges.length > 0) {
                reportContent.labor_charges.forEach((labor: any, idx: number) => {
                    newItems.push({
                        id: `labor-${Date.now()}-${idx}`,
                        description: `工时: ${labor.description || '维修工时'}`,
                        description_en: labor.description_en ? `Labor: ${labor.description_en}` : undefined,
                        quantity: labor.hours || 1,
                        unit_price: labor.rate || 0,
                        total: labor.total || (labor.hours || 1) * (labor.rate || 0)
                    });
                });
            }
            
            // 3. 导入其他费用 (新结构)
            if (reportContent.other_fees && reportContent.other_fees.length > 0) {
                reportContent.other_fees.forEach((fee: any, idx: number) => {
                    newOtherFees.push({
                        id: `fee-${Date.now()}-${idx}`,
                        description: fee.description || '其他费用',
                        description_en: fee.description_en,
                        amount: fee.amount || 0
                    });
                });
            }
            // 兼容旧结构: logistics.shipping_fee
            else if (reportContent.logistics?.shipping_fee && reportContent.logistics.shipping_fee > 0) {
                newOtherFees.push({
                    id: `shipping-${Date.now()}`,
                    description: reportContent.logistics.shipping_method || '运费',
                    amount: reportContent.logistics.shipping_fee
                });
            }
            
            if (newItems.length === 0 && newOtherFees.length === 0) {
                setConfirmAction({ type: 'import_empty', isOpen: true });
                return;
            }
            
            // 保存待导入项目
            setPendingImportItems(newItems);
            setPendingImportOtherFees(newOtherFees);
            setImportSourceReport(report);
            
            // 确认是否覆盖现有项目
            if (piData.content.items.length > 0 || piData.content.other_fees.length > 0) {
                setConfirmAction({ type: 'import_replace', isOpen: true, data: { count: newItems.length + newOtherFees.length } });
            } else {
                // 直接导入（无现有项目）
                applyImportItems(newItems, newOtherFees, true, report);
            }
        } catch (err) {
            console.error('Failed to import from repair report:', err);
            setConfirmAction({ type: 'no_report', isOpen: true, data: { message: '导入失败，请重试' } });
        } finally {
            setImporting(false);
        }
    };

    // 应用导入项目并保存
    const applyImportItems = async (items: PIItem[], otherFees: PIOtherFee[], replace: boolean, sourceReport?: any) => {
        const finalItems = replace ? items : [...piData.content.items, ...items];
        const finalOtherFees = replace ? otherFees : [...piData.content.other_fees, ...otherFees];
        
        // 从维修报告导入税率和优惠金额（如果存在）
        const importedTaxRate = sourceReport?.tax_rate ?? piData.tax_rate ?? 0;
        const importedDiscount = sourceReport?.discount_amount ?? piData.discount_amount ?? 0;
        
        const { subtotal, taxAmount, total } = calculateTotals(finalItems, finalOtherFees, importedTaxRate, importedDiscount);
        
        const newPIData = {
            ...piData,
            content: { ...piData.content, items: finalItems, other_fees: finalOtherFees },
            tax_rate: importedTaxRate,
            discount_amount: importedDiscount,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total
        };
        
        setPIData(newPIData);
        
        // 立即保存到服务器
        try {
            const payload = {
                ticket_id: ticketId,
                content: newPIData.content,
                subtotal: newPIData.subtotal,
                tax_rate: newPIData.tax_rate,
                tax_amount: newPIData.tax_amount,
                discount_amount: newPIData.discount_amount,
                total_amount: newPIData.total_amount,
                currency: newPIData.currency,
                valid_until: new Date(Date.now() + newPIData.content.terms.valid_days * 24 * 60 * 60 * 1000).toISOString()
            };
            
            if (piId) {
                await axios.patch(`/api/v1/rma-documents/pi/${piId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                const res = await axios.post('/api/v1/rma-documents/pi', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // 更新本地 PI 数据，不关闭窗口
                if (res.data.data?.id) {
                    setPIData(prev => ({
                        ...prev,
                        id: res.data.data.id,
                        pi_number: res.data.data.pi_number || prev.pi_number
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to save imported items:', err);
        }
        
        // 显示成功提示
        setConfirmAction({ type: 'import_success', isOpen: true, data: { count: items.length + otherFees.length, action: replace ? '导入' : '追加' } });
        setPendingImportItems([]);
        setPendingImportOtherFees([]);
        setImportSourceReport(null);
    };

    const handleCurrencyChange = async (newCurrency: string) => {
        if (!canEdit || saving || newCurrency === piData.currency) return;
        if (piId && !['draft', 'rejected', ''].includes(piData.status || '')) return;

        try {
            const confirmed = await showConfirm(
                `切换货币单位`,
                `确定要将计价货币从 ${piData.currency} 切换为 ${newCurrency} 吗？系统将尝试按最新汇率和价目表重新计算所有价格，可能会产生差值。`,
                'info',
                '确认切换',
                '取消'
            );
            if (!confirmed) return;

            setSaving(true);
            const currentCurrency = piData.currency;
            const factor = systemSettings?.currency_conversion_factor || 5;
            let multiplier = 1;

            if (currentCurrency === 'CNY' && (newCurrency === 'USD' || newCurrency === 'EUR')) {
                multiplier = 1 / factor;
            } else if ((currentCurrency === 'USD' || currentCurrency === 'EUR') && newCurrency === 'CNY') {
                multiplier = factor;
            } else if ((currentCurrency === 'USD' && newCurrency === 'EUR') || (currentCurrency === 'EUR' && newCurrency === 'USD')) {
                multiplier = 1;
            }

            const newContent = { ...piData.content };

            // 重算备件费用
            if (newContent.items && newContent.items.length > 0) {
                const skus = newContent.items.filter(p => p.part_number).map(p => p.part_number);

                if (skus.length > 0) {
                    const pricesRes = await axios.post(`/api/v1/parts-master/batch`, { skus }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (pricesRes.data?.success) {
                        const priceMap = pricesRes.data.data.reduce((acc: any, part: any) => {
                            let targetPrice = part.price_cny;
                            if (newCurrency === 'USD') targetPrice = part.price_usd;
                            else if (newCurrency === 'EUR') targetPrice = part.price_eur;
                            acc[part.sku] = Number(targetPrice || 0);
                            return acc;
                        }, {});

                        newContent.items = newContent.items.map(part => {
                            if (part.part_number && priceMap[part.part_number] !== undefined) {
                                const newPrice = priceMap[part.part_number];
                                return { ...part, unit_price: newPrice, total: Number(part.quantity || 1) * newPrice };
                            }
                            return { ...part, unit_price: Number(part.unit_price || 0) * multiplier, total: Number(part.quantity || 1) * Number(part.unit_price || 0) * multiplier };
                        });
                    }
                } else {
                    newContent.items = newContent.items.map(part => ({
                        ...part,
                        unit_price: Number(part.unit_price || 0) * multiplier,
                        total: Number(part.quantity || 1) * Number(part.unit_price || 0) * multiplier
                    }));
                }
            }

            // 其他费用
            if (newContent.other_fees && newContent.other_fees.length > 0) {
                newContent.other_fees = newContent.other_fees.map(fee => ({
                    ...fee,
                    amount: Number(fee.amount || 0) * multiplier
                }));
            }

            const itemsSubtotal = (newContent.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
            const otherFeesTotal = (newContent.other_fees || []).reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
            const subtotal = itemsSubtotal + otherFeesTotal;
            const discount = Number(piData.discount_amount || 0) * multiplier;
            const taxAmount = subtotal * (Number(piData.tax_rate || 0) / 100);
            const total = subtotal + taxAmount - discount;

            setPIData(prev => ({
                ...prev,
                currency: newCurrency,
                content: newContent,
                subtotal,
                tax_amount: taxAmount,
                total_amount: total,
                discount_amount: discount
            }));

        } catch (err) {
            console.error('Failed to change PI currency:', err);
            showToast('切换币种失败，请检查网络或刷新重试。', 'error');
        } finally {
            setSaving(false);
        }
    };

    const calculateTotals = (items: PIItem[], otherFees: PIOtherFee[], taxRate: number = 0, discount: number = 0) => {
        const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
        const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
        const subtotal = itemsSubtotal + otherFeesTotal;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount - discount;
        return { subtotal, taxAmount, total };
    };

    const updateItem = (id: string, field: keyof PIItem, value: any) => {
        const newItems = piData.content.items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unit_price') {
                    updated.total = Number(updated.quantity || 0) * Number(updated.unit_price || 0);
                }
                return updated;
            }
            return item;
        });

        const taxRate = Number(piData.tax_rate) || 0;
        const discountAmount = Number(piData.discount_amount) || 0;
        const { subtotal, taxAmount, total } = calculateTotals(newItems, piData.content.other_fees, taxRate, discountAmount);

        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, items: newItems },
            subtotal,
            tax_amount: taxAmount,
            total_amount: total
        }));
    };

    const addItem = () => {
        const newItem: PIItem = {
            id: Date.now().toString(),
            description: '',
            quantity: 1,
            unit_price: 0,
            total: 0
        };
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, items: [...prev.content.items, newItem] }
        }));
    };

    const removeItem = (id: string) => {
        const newItems = piData.content.items.filter(item => item.id !== id);
        const taxRate = Number(piData.tax_rate) || 0;
        const discountAmount = Number(piData.discount_amount) || 0;
        const { subtotal, taxAmount, total } = calculateTotals(newItems, piData.content.other_fees, taxRate, discountAmount);

        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, items: newItems },
            subtotal,
            tax_amount: taxAmount,
            total_amount: total
        }));
    };

    // Other fees management
    const addOtherFee = () => {
        const newFee: PIOtherFee = {
            id: Date.now().toString(),
            description: '',
            amount: 0
        };
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, other_fees: [...prev.content.other_fees, newFee] }
        }));
    };

    const updateOtherFee = (id: string, field: keyof PIOtherFee, value: any) => {
        const newFees = piData.content.other_fees.map(fee => {
            if (fee.id === id) {
                return { ...fee, [field]: value };
            }
            return fee;
        });
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, other_fees: newFees }
        }));
    };

    const removeOtherFee = (id: string) => {
        const newFees = piData.content.other_fees.filter(fee => fee.id !== id);
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, other_fees: newFees }
        }));
    };

    const saveDraft = async () => {
        setSaving(true);
        try {
            const payload = {
                ticket_id: ticketId,
                content: piData.content,
                subtotal: piData.subtotal,
                tax_rate: piData.tax_rate,
                tax_amount: piData.tax_amount,
                discount_amount: piData.discount_amount,
                total_amount: piData.total_amount,
                currency: piData.currency,
                valid_until: new Date(Date.now() + piData.content.terms.valid_days * 24 * 60 * 60 * 1000).toISOString()
            };

            if (piId) {
                await axios.patch(`/api/v1/rma-documents/pi/${piId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/v1/rma-documents/pi', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const submitForReview = async () => {
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/pi/${piId}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '提交审核失败');
        } finally {
            setSubmitting(false);
        }
    };



    const recallPI = async () => {
        setConfirmAction({ type: null, isOpen: false });
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/pi/${piId}/recall`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // 撤回后递增 PI 版本号
            const currentVersion = piData.version || 1;
            const nextVersion = currentVersion + 1;
            const newPINumber = `PI-${ticketNumber}-V${nextVersion}`;
            
            // 更新本地状态
            setPIData(prev => ({
                ...prev,
                pi_number: newPINumber,
                version: nextVersion,
                status: 'draft'
            }));
            
            // 同步到后端（更新 pi_number 和 version）
            await axios.put(`/api/v1/rma-documents/pi/${piId}`, {
                pi_number: newPINumber,
                version: nextVersion
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            loadPI();
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '撤回失败');
        } finally {
            setSubmitting(false);
        }
    };

    const exportPDF = async () => {
        // 直接导出，不弹确认框
        try {
            const previewElement = document.getElementById('pi-preview-content');
            if (!previewElement) {
                alert('请先切换到预览模式');
                return;
            }

            await exportToPDF({
                filename: `${piData.pi_number || 'PI'}.pdf`,
                element: previewElement,
                orientation: pdfSettings.orientation,
                format: pdfSettings.format
            });
        } catch (err) {
            console.error('PDF export error:', err);
            alert('导出失败，请重试');
        }
    };

    if (!isOpen) return null;

    const isReadOnly = piData.status === 'published' || piData.status === 'approved' || piData.status === 'pending_review';
    const canEdit = !isReadOnly && (piData.status === 'draft' || piData.status === 'rejected');
    const canExport = piData.content.items.length > 0; // 有内容就可以导出

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{
                    width: 900, height: '90vh', background: 'var(--modal-bg)', borderRadius: 16,
                    border: '1px solid var(--modal-border)', overflow: 'hidden',
                    boxShadow: 'var(--glass-shadow-lg)',
                    display: 'flex', flexDirection: 'column'
                }}>
                    {/* Header */}
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={18} color="#10B981" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>
                                    {isReadOnly ? '查看 PI' : (piId ? '编辑 PI' : '制作PI发票')}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>工单 {ticketNumber}</span>
                                    {piData.pi_number && (
                                        <span style={{ fontSize: 11, color: 'var(--status-blue)', background: 'var(--accent-blue-subtle)', padding: '2px 8px', borderRadius: 4 }}>
                                            {piData.pi_number}
                                        </span>
                                    )}
                                    <StatusBadge status={piData.status} />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                onClick={() => setActiveTab('edit')}
                                style={{
                                    padding: '6px 16px', background: activeTab === 'edit' ? 'var(--glass-bg-light)' : 'transparent',
                                    border: 'none', color: activeTab === 'edit' ? 'var(--text-main)' : 'var(--text-secondary)', borderRadius: 6,
                                    cursor: 'pointer', fontSize: 13
                                }}
                            >
                                编辑
                            </button>
                            <button
                                onClick={() => setActiveTab('preview')}
                                style={{
                                    padding: '6px 16px', background: activeTab === 'preview' ? 'var(--glass-bg-light)' : 'transparent',
                                    border: 'none', color: activeTab === 'preview' ? 'var(--text-main)' : 'var(--text-secondary)', borderRadius: 6,
                                    cursor: 'pointer', fontSize: 13
                                }}
                            >
                                预览
                            </button>
                            {/* 编辑/预览Tab与关闭按钮间距24px+ */}
                            <div style={{ width: 24 }} />
                            {/* X圆形关闭按钮 */}
                            <button
                                onClick={onClose}
                                title="关闭"
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                    e.currentTarget.style.color = '#EF4444';
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                        {loading ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                加载中...
                            </div>
                        ) : activeTab === 'edit' ? (
                            <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Customer Info */}
                                <Section title="客户信息">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <Input label="客户名称" value={piData.content.customer_info.name} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, name: v } } }))} disabled={!canEdit} />
                                        <Input label="联系人" value={piData.content.customer_info.contact} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, contact: v } } }))} disabled={!canEdit} />
                                        <Input label="邮箱" value={piData.content.customer_info.email} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, email: v } } }))} disabled={!canEdit} />
                                        <Input label="地址" value={piData.content.customer_info.address} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, address: v } } }))} disabled={!canEdit} />
                                    </div>
                                </Section>

                                {/* Device Info */}
                                <Section title="设备信息">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <Input label="产品型号" value={piData.content.device_info.product_name} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, device_info: { ...prev.content.device_info, product_name: v } } }))} disabled={!canEdit} />
                                        <Input label="序列号" value={piData.content.device_info.serial_number} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, device_info: { ...prev.content.device_info, serial_number: v } } }))} disabled={!canEdit} />
                                    </div>
                                </Section>

                                {/* Items */}
                                <Section title="服务项目" action={
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {canEdit && (
                                            <>
                                                <button
                                                    onClick={importFromRepairReport}
                                                    disabled={importing}
                                                    style={{ padding: '4px 12px', background: '#FFD200', border: 'none', borderRadius: 4, color: '#000', fontSize: 12, cursor: importing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                                                >
                                                    <FileInput size={14} /> {importing ? '导入中...' : '从维修报告导入'}
                                                </button>
                                                <button onClick={addItem} style={{ padding: '4px 12px', background: '#FFD200', border: 'none', borderRadius: 4, color: '#000', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                                    <Plus size={14} /> 添加
                                                </button>
                                            </>
                                        )}
                                    </div>
                                }>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {piData.content.items.map((item) => (
                                            <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, background: 'var(--glass-bg-light)', borderRadius: 8 }}>
                                                <div style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                        placeholder="服务/零件描述"
                                                        disabled={!canEdit}
                                                        style={{ width: '100%', padding: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                </div>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                                    placeholder="数量"
                                                    disabled={!canEdit}
                                                    style={{ width: 70, padding: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'center' }}
                                                />
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    placeholder="单价"
                                                    disabled={!canEdit}
                                                    style={{ width: 100, padding: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'right' }}
                                                />
                                                <div style={{ width: 100, padding: 8, textAlign: 'right', color: 'var(--text-main)', fontWeight: 500, fontSize: 13 }}>
                                                    {piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(item.total || 0).toFixed(2)}
                                                </div>
                                                {canEdit && (
                                                    <button onClick={() => removeItem(item.id)} style={{ padding: 8, background: 'var(--status-red-subtle)', border: 'none', borderRadius: 4, color: 'var(--status-red)', cursor: 'pointer' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {piData.content.items.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                                                暂无服务项目，点击"从维修报告导入"或"添加"按钮
                                            </div>
                                        )}
                                    </div>
                                </Section>

                                {/* Other Fees */}
                                <Section title="其他费用" action={
                                    canEdit && (
                                        <button onClick={addOtherFee} style={{ padding: '4px 12px', background: '#FFD200', border: 'none', borderRadius: 4, color: '#000', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                            <Plus size={14} /> 添加
                                        </button>
                                    )
                                }>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {piData.content.other_fees.map((fee) => (
                                            <div key={fee.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, background: 'var(--glass-bg-light)', borderRadius: 8 }}>
                                                <div style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        value={fee.description}
                                                        onChange={e => updateOtherFee(fee.id, 'description', e.target.value)}
                                                        placeholder="费用说明"
                                                        disabled={!canEdit}
                                                        style={{ width: '100%', padding: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    />
                                                </div>
                                                <input
                                                    type="number"
                                                    value={fee.amount}
                                                    onChange={e => updateOtherFee(fee.id, 'amount', parseFloat(e.target.value) || 0)}
                                                    placeholder="金额"
                                                    disabled={!canEdit}
                                                    style={{ width: 120, padding: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'right' }}
                                                />
                                                {canEdit && (
                                                    <button onClick={() => removeOtherFee(fee.id)} style={{ padding: 8, background: 'var(--status-red-subtle)', border: 'none', borderRadius: 4, color: 'var(--status-red)', cursor: 'pointer' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {piData.content.other_fees.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
                                                暂无其他费用
                                            </div>
                                        )}
                                    </div>
                                </Section>

                                {/* Financial Summary */}
                                <Section title="财务汇总">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280, marginLeft: 'auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 13 }}>
                                            <span>小计</span>
                                            <span>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.subtotal || 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>税率 (%)</span>
                                            <input
                                                type="number"
                                                value={piData.tax_rate}
                                                onChange={e => {
                                                    const rate = parseFloat(e.target.value) || 0;
                                                    const { taxAmount, total } = calculateTotals(piData.content.items, piData.content.other_fees, rate, piData.discount_amount);
                                                    setPIData(prev => ({ ...prev, tax_rate: rate, tax_amount: taxAmount, total_amount: total }));
                                                }}
                                                disabled={!canEdit}
                                                style={{ width: 50, padding: 4, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, textAlign: 'right' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 13 }}>
                                            <span>税额</span>
                                            <span>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.tax_amount || 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>优惠金额</span>
                                            <input
                                                type="number"
                                                value={piData.discount_amount}
                                                onChange={e => {
                                                    const discount = parseFloat(e.target.value) || 0;
                                                    const { taxAmount, total } = calculateTotals(piData.content.items, piData.content.other_fees, piData.tax_rate, discount);
                                                    setPIData(prev => ({ ...prev, discount_amount: discount, tax_amount: taxAmount, total_amount: total }));
                                                }}
                                                disabled={!canEdit}
                                                style={{ width: 80, padding: 4, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, textAlign: 'right' }}
                                            />
                                        </div>
                                        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 14 }}>合计</span>
                                                <select
                                                    value={piData.currency || 'CNY'}
                                                    onChange={e => handleCurrencyChange(e.target.value)}
                                                    disabled={!canEdit}
                                                    style={{ padding: '4px 8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12 }}
                                                >
                                                    <option value="CNY">CNY</option>
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                </select>
                                            </div>
                                            <span style={{ color: 'var(--text-main)', fontSize: 18, fontWeight: 700 }}>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.total_amount || 0).toFixed(2)}</span>

                                        </div>
                                    </div>
                                </Section>

                                {/* Terms */}
                                <Section title="条款">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <Input label="付款条款" value={piData.content.terms.payment_terms} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, terms: { ...prev.content.terms, payment_terms: v } } }))} disabled={!canEdit} />
                                        <Input label="交付条款" value={piData.content.terms.delivery_terms} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, terms: { ...prev.content.terms, delivery_terms: v } } }))} disabled={!canEdit} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>有效期 (天)</span>
                                            <input
                                                type="number"
                                                value={piData.content.terms.valid_days}
                                                onChange={e => setPIData(prev => ({ ...prev, content: { ...prev.content, terms: { ...prev.content.terms, valid_days: parseInt(e.target.value) || 7 } } }))}
                                                disabled={!canEdit}
                                                style={{ width: 80, padding: 8, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                            />
                                        </div>
                                    </div>
                                </Section>

                                {/* Notes */}
                                <Section title="备注">
                                    <textarea
                                        value={piData.content.notes}
                                        onChange={e => setPIData(prev => ({ ...prev, content: { ...prev.content, notes: e.target.value } }))}
                                        disabled={!canEdit}
                                        placeholder="添加备注信息..."
                                        style={{ width: '100%', minHeight: 80, padding: 12, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-main)', fontSize: 13, resize: 'vertical' }}
                                    />
                                </Section>
                            </div>
                        ) : (
                            <PIPreview 
                                piData={piData} 
                                language={previewLanguage}
                                translations={translations}
                                onLanguageChange={(lang) => {
                                    // 保存滚动位置
                                    const previewEl = document.querySelector('#pi-preview-scroll');
                                    if (previewEl) {
                                        const scrollPosition = (previewEl as HTMLElement).scrollTop;
                                        setTimeout(() => {
                                            const newPreviewEl = document.querySelector('#pi-preview-scroll');
                                            if (newPreviewEl) {
                                                (newPreviewEl as HTMLElement).scrollTop = scrollPosition;
                                            }
                                        }, 0);
                                    }
                                    setPreviewLanguage(lang);
                                }}
                            />
                        )}
                    </div>

                    {/* Footer - 左侧设置按钮，右侧操作按钮 */}
                    <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                        {/* 左侧：设置按钮 */}
                        <button
                            onClick={() => setShowPdfSettings(true)}
                            title="PDF导出设置"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                e.currentTarget.style.color = 'var(--text-main)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            <Settings size={18} />
                        </button>
                        {/* 右侧：操作按钮组 */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {/* 导出PDF按钮 - 仅预览模式下显示 */}
                            {canExport && activeTab === 'preview' && (
                                <button
                                    onClick={exportPDF}
                                    style={{ padding: '8px 20px', background: 'var(--glass-bg-light)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-main)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Download size={16} /> 导出 PDF
                                </button>
                            )}
                            {canEdit && (
                                <button
                                    onClick={saveDraft}
                                    disabled={saving}
                                    style={{ padding: '8px 20px', background: 'var(--glass-bg-light)', border: 'none', borderRadius: 6, color: 'var(--text-main)', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Save size={16} /> {saving ? '保存中...' : '保存草稿'}
                                </button>
                            )}
                            {canEdit && piData.content.items.length > 0 && (
                                <button
                                    onClick={async () => {
                                        // If no piId, save first then submit
                                        if (!piId) {
                                            setSaving(true);
                                            try {
                                                const payload = {
                                                    ticket_id: ticketId,
                                                    content: piData.content,
                                                    subtotal: piData.subtotal,
                                                    tax_rate: piData.tax_rate,
                                                    tax_amount: piData.tax_amount,
                                                    discount_amount: piData.discount_amount,
                                                    total_amount: piData.total_amount,
                                                    currency: piData.currency,
                                                    valid_until: new Date(Date.now() + piData.content.terms.valid_days * 24 * 60 * 60 * 1000).toISOString()
                                                };
                                                const res = await axios.post('/api/v1/rma-documents/pi', payload, {
                                                    headers: { Authorization: `Bearer ${token}` }
                                                });
                                                // Now submit (directly publishes)
                                                if (res.data.data?.id) {
                                                    await axios.post(`/api/v1/rma-documents/pi/${res.data.data.id}/submit`, {}, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    onSuccess();
                                                }
                                            } catch (err: any) {
                                                alert(err.response?.data?.error || '提交发布失败');
                                            } finally {
                                                setSaving(false);
                                            }
                                        } else {
                                            submitForReview();
                                        }
                                    }}
                                    disabled={submitting || saving}
                                    style={{ padding: '8px 20px', background: '#FFD200', border: 'none', borderRadius: 6, color: '#000', fontWeight: 600, cursor: (submitting || saving) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Send size={16} /> {submitting ? '提交中...' : '提交发布'}
                                </button>
                            )}
                            {piData.status === 'published' && ['Lead', 'Admin'].includes(user?.role || '') && (
                                <button
                                    onClick={() => setConfirmAction({ type: 'recall', isOpen: true })}
                                    disabled={submitting}
                                    style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <X size={16} /> 撤回发布
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirm Recall Modal */}
            {confirmAction.isOpen && confirmAction.type === 'recall' && (
                <ConfirmModal
                    title="确认撤回"
                    message="确认撤回 PI 为草稿状态？撤回后可重新编辑。"
                    confirmText="确认撤回"
                    cancelText="取消"
                    isDanger={true}
                    onConfirm={recallPI}
                    onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                    loading={submitting}
                />
            )}

            {/* Import Replace Confirm Modal */}
            {confirmAction.isOpen && confirmAction.type === 'import_replace' && (
                <ConfirmModal
                    title="导入确认"
                    message={`将从维修报告导入 ${confirmAction.data?.count || 0} 个费用项目。\n\n是否覆盖现有项目？`}
                    confirmText="覆盖"
                    cancelText="追加到后面"
                    isDanger={false}
                    onConfirm={() => {
                        setConfirmAction({ type: null, isOpen: false });
                        applyImportItems(pendingImportItems, pendingImportOtherFees, true, importSourceReport);
                    }}
                    onCancel={() => {
                        setConfirmAction({ type: null, isOpen: false });
                        applyImportItems(pendingImportItems, pendingImportOtherFees, false, importSourceReport);
                    }}
                />
            )}

            {/* Import Success Modal */}
            {confirmAction.isOpen && confirmAction.type === 'import_success' && (
                <ConfirmModal
                    title="导入成功"
                    message={`已${confirmAction.data?.action || '导入'} ${confirmAction.data?.count || 0} 个费用项目（零件、工时、物流）`}
                    confirmText="确定"
                    showCancel={false}
                    onConfirm={() => setConfirmAction({ type: null, isOpen: false })}
                    onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                />
            )}

            {/* Import Empty Modal */}
            {confirmAction.isOpen && confirmAction.type === 'import_empty' && (
                <ConfirmModal
                    title="无可导入项目"
                    message="维修报告中没有费用项目可导入。\n\n请先在维修报告中添加零件、工时或物流费用。"
                    confirmText="知道了"
                    showCancel={false}
                    onConfirm={() => setConfirmAction({ type: null, isOpen: false })}
                    onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                />
            )}

            {confirmAction.isOpen && confirmAction.type === 'no_report' && (
                <ConfirmModal
                    title="无法导入"
                    message={confirmAction.data?.message || '未找到维修报告，请先创建维修报告。'}
                    confirmText="知道了"
                    showCancel={false}
                    onConfirm={() => setConfirmAction({ type: null, isOpen: false })}
                    onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                />
            )}

            {confirmAction.type === 'custom' && confirmAction.isOpen && confirmAction.data && (
                <ConfirmModal 
                    title={confirmAction.data.title}
                    message={confirmAction.data.message}
                    isDanger={confirmAction.data.type === 'danger'}
                    confirmText={confirmAction.data.confirmText || '确定'}
                    cancelText={confirmAction.data.cancelText || '取消'}
                    onConfirm={() => {
                        setConfirmAction({ type: null, isOpen: false });
                        if (confirmModalResultRef.current) confirmModalResultRef.current(true);
                    }}
                    onCancel={() => {
                        setConfirmAction({ type: null, isOpen: false });
                        if (confirmModalResultRef.current) confirmModalResultRef.current(false);
                    }}
                />
            )}

            {/* PDF Settings Panel */}
            {showPdfSettings && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 440, background: '#2c2c2e', borderRadius: 12, padding: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>PDF导出设置</h3>
                            <button onClick={() => setShowPdfSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>纸张尺寸</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setPdfSettings(prev => ({ ...prev, format: opt.value as any }))}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: 8,
                                            background: pdfSettings.format === opt.value ? 'rgba(255,210,0,0.1)' : 'var(--glass-bg-light)',
                                            border: `1px solid ${pdfSettings.format === opt.value ? 'rgba(255,210,0,0.4)' : 'var(--glass-bg-light)'}`,
                                            color: pdfSettings.format === opt.value ? '#FFD200' : '#888',
                                            fontSize: 14, fontWeight: pdfSettings.format === opt.value ? 600 : 400,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>方向</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[{ value: 'portrait', label: '纵向' }, { value: 'landscape', label: '横向' }].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setPdfSettings(prev => ({ ...prev, orientation: opt.value as any }))}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: 8,
                                            background: pdfSettings.orientation === opt.value ? 'rgba(255,210,0,0.1)' : 'var(--glass-bg-light)',
                                            border: `1px solid ${pdfSettings.orientation === opt.value ? 'rgba(255,210,0,0.4)' : 'var(--glass-bg-light)'}`,
                                            color: pdfSettings.orientation === opt.value ? '#FFD200' : '#888',
                                            fontSize: 14, fontWeight: pdfSettings.orientation === opt.value ? 600 : 400,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>语言</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {[{ value: 'original', label: '原文' }, { value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }, { value: 'ja-JP', label: '日本語' }, { value: 'de-DE', label: 'Deutsch' }].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setPdfSettings(prev => ({ ...prev, language: opt.value as any }))}
                                        style={{
                                            padding: '8px 16px', borderRadius: 6,
                                            background: pdfSettings.language === opt.value ? 'rgba(255,210,0,0.1)' : 'var(--glass-bg-light)',
                                            border: `1px solid ${pdfSettings.language === opt.value ? 'rgba(255,210,0,0.4)' : 'var(--glass-bg-light)'}`,
                                            color: pdfSettings.language === opt.value ? '#FFD200' : '#888',
                                            fontSize: 13, cursor: 'pointer'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>提示: AI翻译功能开发中...</div>
                        </div>

                        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={pdfSettings.showHeader} onChange={e => setPdfSettings(prev => ({ ...prev, showHeader: e.target.checked }))} />
                                显示页眉
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={pdfSettings.showFooter} onChange={e => setPdfSettings(prev => ({ ...prev, showFooter: e.target.checked }))} />
                                显示页脚
                            </label>
                        </div>

                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowPdfSettings(false)}
                                style={{ padding: '10px 24px', background: '#FFD200', border: 'none', borderRadius: 8, color: '#000', fontWeight: 600, cursor: 'pointer' }}
                            >
                                完成
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};

// Helper Components
const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
    <div style={{ background: 'var(--glass-bg-light)', padding: 20, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{title}</h4>
            {action}
        </div>
        {children}
    </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
    <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', padding: 10, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 13, outline: 'none' }}
        />
    </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const configs: Record<string, { text: string; color: string; bg: string }> = {
        'draft': { text: '草稿', color: 'var(--text-secondary)', bg: 'var(--glass-bg-light)' },
        'pending_review': { text: '审核中', color: 'var(--accent-gold)', bg: 'var(--accent-gold-subtle)' },
        'approved': { text: '已发布', color: 'var(--accent-green)', bg: 'var(--accent-green-subtle)' },
        'rejected': { text: '已驳回', color: 'var(--status-red)', bg: 'var(--status-red-subtle)' },
        'published': { text: '已发布', color: 'var(--accent-green)', bg: 'var(--accent-green-subtle)' }
    };
    const config = configs[status] || configs['draft'];
    return (
        <span style={{ fontSize: 11, color: config.color, background: config.bg, padding: '2px 8px', borderRadius: 4 }}>
            {config.text}
        </span>
    );
};

// UI标签多语言映射表
const PREVIEW_LABELS: Record<string, Record<string, string>> = {
    'original': {
        title: 'Proforma Invoice',
        subtitle: '形式发票',
        piNumber: 'PI编号',
        date: '日期',
        validUntil: '有效期至',
        billTo: '账单抬头',
        customerName: '客户名称',
        address: '地址',
        contact: '联系人',
        email: '邮箱',
        deviceInfo: '设备信息',
        product: '产品',
        serialNumber: '序列号',
        description: '描述',
        qty: '数量',
        unitPrice: '单价',
        total: '合计',
        noItems: '无项目',
        otherFees: '其他费用',
        amount: '金额',
        subtotal: '小计',
        tax: '税额',
        discount: '优惠',
        totalAmount: '总计',
        terms: '条款',
        paymentTerms: '付款条款',
        deliveryTerms: '交付条款',
        validity: '有效期',
        validDays: '此PI有效期为 {days} 天',
        notes: '备注',
        footer: '本文件由电脑生成，无需签名',
        company: 'KINEFINITY INC.',
        pendingTranslation: '[待翻译]'
    },
    'zh-CN': {
        title: '形式发票',
        subtitle: '',
        piNumber: 'PI编号',
        date: '日期',
        validUntil: '有效期至',
        billTo: '账单抬头',
        customerName: '客户名称',
        address: '地址',
        contact: '联系人',
        email: '邮箱',
        deviceInfo: '设备信息',
        product: '产品',
        serialNumber: '序列号',
        description: '描述',
        qty: '数量',
        unitPrice: '单价',
        total: '合计',
        noItems: '无项目',
        otherFees: '其他费用',
        amount: '金额',
        subtotal: '小计',
        tax: '税额',
        discount: '优惠',
        totalAmount: '总计',
        terms: '条款',
        paymentTerms: '付款条款',
        deliveryTerms: '交付条款',
        validity: '有效期',
        validDays: '此PI有效期为 {days} 天',
        notes: '备注',
        footer: '本文件由电脑生成，无需签名',
        company: 'KINEFINITY INC.',
        pendingTranslation: '[待翻译]'
    },
    'en-US': {
        title: 'Proforma Invoice',
        subtitle: '',
        piNumber: 'PI Number',
        date: 'Date',
        validUntil: 'Valid Until',
        billTo: 'Bill To',
        customerName: 'Customer Name',
        address: 'Address',
        contact: 'Contact',
        email: 'Email',
        deviceInfo: 'Device Information',
        product: 'Product',
        serialNumber: 'Serial Number',
        description: 'Description',
        qty: 'Qty',
        unitPrice: 'Unit Price',
        total: 'Total',
        noItems: 'No items',
        otherFees: 'Other Fees',
        amount: 'Amount',
        subtotal: 'Subtotal',
        tax: 'Tax',
        discount: 'Discount',
        totalAmount: 'Total Amount',
        terms: 'Terms & Conditions',
        paymentTerms: 'Payment Terms',
        deliveryTerms: 'Delivery Terms',
        validity: 'Validity',
        validDays: 'This PI is valid for {days} days',
        notes: 'Notes',
        footer: 'This is a computer-generated document. No signature required.',
        company: 'KINEFINITY INC.',
        pendingTranslation: '[Pending Translation]'
    },
    'ja-JP': {
        title: 'プロフォーマインボイス',
        subtitle: '',
        piNumber: 'PI番号',
        date: '日付',
        validUntil: '有効期限',
        billTo: '請求先',
        customerName: '顧客名',
        address: '住所',
        contact: '担当者',
        email: 'メール',
        deviceInfo: '機器情報',
        product: '製品',
        serialNumber: 'シリアル番号',
        description: '説明',
        qty: '数量',
        unitPrice: '単価',
        total: '合計',
        noItems: '項目なし',
        otherFees: 'その他の費用',
        amount: '金額',
        subtotal: '小計',
        tax: '税額',
        discount: '割引',
        totalAmount: '合計金額',
        terms: '条件',
        paymentTerms: '支払条件',
        deliveryTerms: '配送条件',
        validity: '有効期間',
        validDays: 'このPIの有効期間は {days} 日間です',
        notes: '備考',
        footer: 'この文書はコンピューターで生成されています。署名は不要です。',
        company: 'KINEFINITY INC.',
        pendingTranslation: '[翻訳待ち]'
    },
    'de-DE': {
        title: 'Proforma-Rechnung',
        subtitle: '',
        piNumber: 'PI-Nummer',
        date: 'Datum',
        validUntil: 'Gültig bis',
        billTo: 'Rechnungsadresse',
        customerName: 'Kundenname',
        address: 'Adresse',
        contact: 'Kontakt',
        email: 'E-Mail',
        deviceInfo: 'Geräteinformationen',
        product: 'Produkt',
        serialNumber: 'Seriennummer',
        description: 'Beschreibung',
        qty: 'Menge',
        unitPrice: 'Einzelpreis',
        total: 'Gesamt',
        noItems: 'Keine Artikel',
        otherFees: 'Sonstige Gebühren',
        amount: 'Betrag',
        subtotal: 'Zwischensumme',
        tax: 'Steuer',
        discount: 'Rabatt',
        totalAmount: 'Gesamtbetrag',
        terms: 'Bedingungen',
        paymentTerms: 'Zahlungsbedingungen',
        deliveryTerms: 'Lieferbedingungen',
        validity: 'Gültigkeit',
        validDays: 'Diese PI ist {days} Tage gültig',
        notes: 'Anmerkungen',
        footer: 'Dieses Dokument wurde computergeneriert und benötigt keine Unterschrift.',
        company: 'KINEFINITY INC.',
        pendingTranslation: '[Übersetzung ausstehend]'
    }
};

// 语言切换按钮组件
const LanguageSwitcher: React.FC<{
    currentLanguage: string;
    onLanguageChange: (lang: 'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE') => void;
}> = ({ currentLanguage, onLanguageChange }) => {
    const languages = [
        { value: 'original', label: '原文' },
        { value: 'zh-CN', label: '中文' },
        { value: 'en-US', label: 'English' },
        { value: 'ja-JP', label: '日本語' },
        { value: 'de-DE', label: 'Deutsch' }
    ];

    return (
        <div style={{
            display: 'flex',
            gap: 8,
            padding: '12px 16px',
            background: '#fff',
            borderBottom: '1px solid #ddd',
            justifyContent: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 10
        }}>
            {languages.map(lang => (
                <button
                    key={lang.value}
                    onClick={() => onLanguageChange(lang.value as any)}
                    style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        background: currentLanguage === lang.value ? 'rgba(255,215,0,0.15)' : 'transparent',
                        border: `1px solid ${currentLanguage === lang.value ? '#FFD200' : '#ddd'}`,
                        color: currentLanguage === lang.value ? '#333' : '#888',
                        fontSize: 13,
                        fontWeight: currentLanguage === lang.value ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
};

const PIPreview: React.FC<{
    piData: PIData;
    language: 'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE';
    translations: Record<string, Record<string, any>>;
    onLanguageChange: (lang: 'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE') => void;
}> = ({ piData, language, translations, onLanguageChange }) => {
    // 获取UI标签
    const t = PREVIEW_LABELS[language] || PREVIEW_LABELS['original'];

    // 配件英文名称缓存（通过 SKU 索引，用于非中文预览）
    const [partNamesEnBySku, setPartNamesEnBySku] = useState<Record<string, string>>({});
    const { token } = useAuthStore();

    // 非中文预览时，通过 SKU 查询配件英文名称
    useEffect(() => {
        if (language === 'zh-CN' || language === 'original') return;
        
        // 收集所有 SKU（从 part_number 字段或从 description 中提取）
        const skus: string[] = [];
        piData.content.items.forEach(item => {
            if (item.part_number) {
                skus.push(item.part_number);
            } else if (item.description.startsWith('零件:')) {
                // 从 description 中提取 SKU，如 "零件: EAGLE 主板 (S2-119-015-01)"
                const match = item.description.match(/\(([^)]+)\)$/);
                if (match) skus.push(match[1]);
            }
        });
        
        if (skus.length === 0) return;

        // 通过 SKU 查询配件英文名称
        const fetchPartNames = async () => {
            try {
                const res = await axios.post('/api/v1/parts-master/batch', { skus }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.success) {
                    const nameMap: Record<string, string> = {};
                    res.data.data.forEach((part: any) => {
                        if (part.sku && part.name_en) {
                            nameMap[part.sku] = part.name_en;
                        }
                    });
                    setPartNamesEnBySku(nameMap);
                }
            } catch (err) {
                // 静默失败
            }
        };
        fetchPartNames();
    }, [piData.content.items, language, token]);

    // 获取翻译内容（PI预览不显示未翻译标记）
    const getTranslatedContent = (fieldKey: string, originalValue: string): string => {
        if (!originalValue || language === 'original' || language === 'zh-CN') {
            return originalValue || '';
        }
        const translated = translations[language]?.[fieldKey];
        return translated || originalValue;
    };

    // 渲染翻译内容（不显示待翻译标记）
    const renderTranslatedContent = (fieldKey: string, originalValue: string) => {
        return getTranslatedContent(fieldKey, originalValue);
    };

    // 获取产品型号显示值（非中文语言使用英文名称）
    const getProductName = () => {
        const { product_name, product_name_en } = piData.content.device_info;
        if (language !== 'original' && language !== 'zh-CN' && product_name_en) {
            return product_name_en;
        }
        return product_name || '-';
    };

    // 获取配件显示名称（非中文时优先使用英文名称）
    const getPartDisplayName = (item: PIItem): React.ReactNode => {
        const isNonChinese = language !== 'original' && language !== 'zh-CN';
        
        // 工时条目：使用 description_en
        if (item.description.startsWith('工时:') && isNonChinese && item.description_en) {
            return item.description_en;
        }
        
        // 零件条目：通过 SKU 查找英文名称
        if (item.description.startsWith('零件:') && isNonChinese) {
            // 优先使用 part_number 字段
            if (item.part_number && partNamesEnBySku[item.part_number]) {
                const sku = item.part_number;
                return (
                    <span>
                        Part: {partNamesEnBySku[sku]} <span style={{ fontVariantNumeric: 'tabular-nums' }}>({sku})</span>
                    </span>
                );
            }
            // 尝试从 description 中提取 SKU
            const match = item.description.match(/\(([^)]+)\)$/);
            if (match && partNamesEnBySku[match[1]]) {
                const sku = match[1];
                return (
                    <span>
                        Part: {partNamesEnBySku[sku]} <span style={{ fontVariantNumeric: 'tabular-nums' }}>({sku})</span>
                    </span>
                );
            }
        }
        
        return item.description;
    };

    return (
        <div id="pi-preview-scroll" style={{ flex: 1, overflow: 'auto', background: '#f5f5f5' }}>
            {/* 语言切换按钮 */}
            <LanguageSwitcher currentLanguage={language} onLanguageChange={onLanguageChange} />
            
            <div id="pi-preview-content" style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 60, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#333', fontSize: 13 }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 36, borderBottom: '2px solid #333', paddingBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{t.title}</h1>
                {t.subtitle && <p style={{ margin: '6px 0 0 0', fontSize: 14, color: '#666' }}>{t.subtitle}</p>}
            </div>

            {/* PI Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 13 }}>
                <div>
                    <div style={{ fontSize: 12, color: '#666' }}>{t.piNumber}:</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{piData.pi_number || 'DRAFT'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#666' }}>{t.date}:</div>
                    <div>{new Date().toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language)}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{t.validUntil}:</div>
                    <div>{new Date(Date.now() + piData.content.terms.valid_days * 24 * 60 * 60 * 1000).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language)}</div>
                </div>
            </div>

            {/* Customer Info */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 10 }}>{t.billTo}:</h3>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{piData.content.customer_info.name || `[${t.customerName}]`}</div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{piData.content.customer_info.address || `[${t.address}]`}</div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{t.contact}: {piData.content.customer_info.contact || '-'}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{t.email}: {piData.content.customer_info.email || '-'}</div>
                </div>
            </div>

            {/* Device Info */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 10 }}>{t.deviceInfo}:</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                    <div><span style={{ color: '#666' }}>{t.product}:</span> {getProductName()}</div>
                    <div><span style={{ color: '#666' }}>{t.serialNumber}:</span> {piData.content.device_info.serial_number || '-'}</div>
                </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
                <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #333', fontSize: 12 }}>{t.description}</th>
                        <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #333', fontSize: 12, width: 60 }}>{t.qty}</th>
                        <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #333', fontSize: 12, width: 100 }}>{t.unitPrice}</th>
                        <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #333', fontSize: 12, width: 100 }}>{t.total}</th>
                    </tr>
                </thead>
                <tbody>
                    {piData.content.items.map((item, index) => (
                        <tr key={item.id}>
                            <td style={{ padding: 10, borderBottom: '1px solid #ddd' }}>
                                {getPartDisplayName(item) || `[${t.description} ${index + 1}]`}
                            </td>
                            <td style={{ padding: 10, borderBottom: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ padding: 10, borderBottom: '1px solid #ddd', textAlign: 'right' }}>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(item.unit_price || 0).toFixed(2)}</td>
                            <td style={{ padding: 10, borderBottom: '1px solid #ddd', textAlign: 'right' }}>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(item.total || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                    {piData.content.items.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#999' }}>{t.noItems}</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Other Fees Table */}
            {piData.content.other_fees.length > 0 && (
                <>
                    <h3 style={{ fontSize: 13, color: '#333', marginBottom: 12 }}>{t.otherFees}</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5' }}>
                                <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #333', fontSize: 12 }}>{t.description}</th>
                                <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #333', fontSize: 12, width: 120 }}>{t.amount}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {piData.content.other_fees.map((fee, index) => {
                                // 非中文时优先使用 description_en
                                const isNonChinese = language !== 'original' && language !== 'zh-CN';
                                const feeDescription = (isNonChinese && fee.description_en) ? fee.description_en : fee.description;
                                return (
                                    <tr key={fee.id}>
                                        <td style={{ padding: 10, borderBottom: '1px solid #ddd' }}>
                                            {feeDescription || `[费用 ${index + 1}]`}
                                        </td>
                                        <td style={{ padding: 10, borderBottom: '1px solid #ddd', textAlign: 'right' }}>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(fee.amount || 0).toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </>
            )}

            {/* Totals */}
            <div style={{ marginLeft: 'auto', width: 280, marginBottom: 24, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                    <span>{t.subtotal}:</span>
                    <span>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                    <span>{t.tax} ({piData.tax_rate}%):</span>
                    <span>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.tax_amount || 0).toFixed(2)}</span>
                </div>
                {piData.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', color: '#10B981' }}>
                        <span>{t.discount}:</span>
                        <span>-{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.discount_amount || 0).toFixed(2)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #333', fontSize: 14, fontWeight: 700 }}>
                    <span>{t.totalAmount}:</span>
                    <span>{piData.currency === 'USD' ? '$' : piData.currency === 'EUR' ? '€' : '¥'}{Number(piData.total_amount || 0).toFixed(2)}</span>
                </div>
            </div>

            {/* Terms */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 10 }}>{t.terms}:</h3>
                <div style={{ fontSize: 13 }}>
                    <div><strong>{t.paymentTerms}:</strong> {renderTranslatedContent('terms.payment_terms', piData.content.terms.payment_terms)}</div>
                    <div style={{ marginTop: 6 }}><strong>{t.deliveryTerms}:</strong> {renderTranslatedContent('terms.delivery_terms', piData.content.terms.delivery_terms)}</div>
                    <div style={{ marginTop: 6 }}><strong>{t.validity}:</strong> {t.validDays.replace('{days}', String(piData.content.terms.valid_days))}</div>
                </div>
            </div>

            {/* Notes */}
            {piData.content.notes && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 10 }}>{t.notes}:</h3>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{renderTranslatedContent('notes', piData.content.notes)}</div>
                </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 50, paddingTop: 16, borderTop: '1px solid #ddd', textAlign: 'center', fontSize: 11, color: '#999' }}>
                <p>{t.company}</p>
            </div>
        </div>
    </div>
    );
};
