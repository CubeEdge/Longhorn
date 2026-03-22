import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Wrench, AlertCircle, Save, X, Download, Send, FileText, Stethoscope, Plus, Trash2, Settings, ChevronDown, ChevronUp, DollarSign, Package, Globe, Check, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../store/useToast';
import { exportToPDF } from '../../utils/pdfExport';
import ConfirmModal from '../Service/ConfirmModal';
import { CustomDatePicker } from '../UI/CustomDatePicker';
// Duplicated import removed
// Local PartUsed definition removed to use the one from PartsSelector.tsx

interface RepairReportEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    reportId?: number | null;
    currentNode?: string;
    onSuccess: () => void;
}

import { PartsSelector, type PartUsed } from './PartsSelector';

interface LaborCharge {
    description: string;
    description_en?: string;    // 英文描述（用于非中文预览）
    hours: number;
    rate: number;
    total: number;
}

interface OtherFee {
    id: string;
    description: string;
    description_en?: string;    // 英文描述（用于非中文预览）
    amount: number;
}

interface ReportContent {
    header: {
        title: string;
        subtitle: string;
    };
    device_info: {
        product_name: string;
        product_name_en?: string;
        serial_number: string;
        firmware_version: string;
        hardware_version: string;
    };
    issue_description: {
        customer_reported: string;
    };
    diagnosis: {
        findings: string;
        root_cause: string;
        troubleshooting_steps: string;
    };
    repair_process: {
        actions_taken: string;
        parts_replaced: PartUsed[];
        testing_results: string;
    };
    labor_charges: LaborCharge[];
    other_fees: OtherFee[];
    qa_result: {
        passed: boolean;
        test_duration: string;
        notes: string;
    };
    warranty_terms: {
        repair_warranty_days: number;
        exclusions: string[];
    };
}

interface ReportData {
    id?: number;
    report_number?: string;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
    content: ReportContent;
    service_type: 'warranty' | 'paid' | 'goodwill';
    total_cost: number;
    currency: string;
    warranty_status: string;
    repair_warranty_days: number;
    payment_status: 'pending' | 'paid' | 'waived';
    parts_total: number;
    labor_total: number;
    shipping_total: number;
    // 财务汇总字段
    tax_rate: number;
    tax_amount: number;
    discount_amount: number;
    version: number;
    created_by?: { id: number; display_name: string };
    created_at?: string;
    updated_at?: string;
    reviewed_by?: { id: number; display_name: string };
    reviewed_at?: string;
    review_comment?: string;
    // 日期字段（可从工单同步或手动编辑）
    received_date?: string;
    diagnosis_date?: string;
    repair_date?: string;
    // 工单创建日期（可编辑）
    ticket_created_date?: string;
    // 编制人（MS closing节点负责人或MS部门其他人员）
    prepared_by?: { id: number; display_name: string } | null;
}

const DEFAULT_CONTENT: ReportContent = {
    header: {
        title: 'KINEFINITY 官方维修报告',
        subtitle: 'Official Repair Report'
    },
    device_info: {
        product_name: '',
        serial_number: '',
        firmware_version: '',
        hardware_version: ''
    },
    issue_description: {
        customer_reported: ''
    },
    diagnosis: {
        findings: '',
        root_cause: '',
        troubleshooting_steps: ''
    },
    repair_process: {
        actions_taken: '',
        parts_replaced: [],
        testing_results: ''
    },
    qa_result: {
        passed: true,
        test_duration: '48 hours',
        notes: ''
    },
    warranty_terms: {
        repair_warranty_days: 90,
        exclusions: ['Physical damage caused by misuse', 'Water damage', 'Unauthorized modifications']
    },
    labor_charges: [],
    other_fees: []
};

export const RepairReportEditor: React.FC<RepairReportEditorProps> = ({
    isOpen, onClose, ticketId, ticketNumber, reportId: initialReportId, currentNode, onSuccess
}) => {
    const { token, user } = useAuthStore();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [importingFromRepair, setImportingFromRepair] = useState(false);
    // 缓存的 op_repair_report 数据，用于一键导入按鈕
    const [cachedOpRepairData, setCachedOpRepairData] = useState<any>(null);
    // 默认工时时薪（从系统设置获取）
    const [defaultLaborRate, setDefaultLaborRate] = useState<number>(100);
    // 一键导入确认弹窗状态
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [ticketInfo, setTicketInfo] = useState<any>(null);
    
    // 状态保持：编辑区域滚动位置
    const editScrollRef = useRef<HTMLDivElement>(null);
    const [editScrollPosition, setEditScrollPosition] = useState(0);
    // 状态保持：预览区域滚动位置
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [previewScrollPosition, setPreviewScrollPosition] = useState(0);
    // 状态保持：翻译框展开状态（fieldKey -> boolean）
    const [translationPanelExpanded, setTranslationPanelExpanded] = useState<Record<string, boolean>>({});
    // MS部门用户列表（用于编制人选择）
    const [msUsers, setMsUsers] = useState<Array<{ id: number; display_name: string; department_name?: string }>>([]);
    // Confirm modal state for publish/recall actions
    const [confirmAction, setConfirmAction] = useState<{ type: 'publish' | 'recall' | 'changeCurrency' | null; isOpen: boolean; payload?: any }>({
        type: null,
        isOpen: false
    });
    const [systemSettings, setSystemSettings] = useState<any>(null);

    // PDF settings panel visibility
    const [showPdfSettings, setShowPdfSettings] = useState(false);
    // Local state to track report ID after creation
    const [localReportId, setLocalReportId] = useState<number | undefined>(initialReportId || undefined);
    
    // ---- 币种切换逻辑 ----
    const handleCurrencyChange = async (newCurrency: string) => {
        if (!canEdit || saving || newCurrency === reportData.currency) return;
        
        // 1. 如果已发布 (非pending/draft状态等，此处根据 canEdit 已拦截大部分，再加锁)
        // 维修报告不应在已提交给客户后随意改变价格基础数据
        if (localReportId && !['draft', 'rejected', ''].includes(reportData.status || '')) {
            showToast('当前报告受保护（已提交或已发布），不支持动态汇率换算。', 'warning');
            return;
        }

        setConfirmAction({
            type: 'changeCurrency',
            isOpen: true,
            payload: { newCurrency }
        });
    };

    const executeCurrencyChange = async (newCurrency: string) => {
        setConfirmAction({ type: null, isOpen: false });
        setSaving(true);
        try {
            const currentCurrency = reportData.currency;
            const factor = systemSettings?.currency_conversion_factor || 5;
            
            // 计算倍率：当前切到新币种
            // 例：CNY -> USD: multiplier = 1/5; USD -> CNY: multiplier = 5
            let multiplier = 1;
            if (currentCurrency === 'CNY' && ['USD','EUR'].includes(newCurrency)) multiplier = 1 / factor;
            else if (['USD','EUR'].includes(currentCurrency) && newCurrency === 'CNY') multiplier = factor;
            // 对于 USD <-> EUR：需求未定义直接换算汇率，统一基于 CNY 基准做跳板（或暂不互转，当前等价计算）：
            else if (['USD','EUR'].includes(currentCurrency) && ['USD','EUR'].includes(newCurrency)) multiplier = 1;

            const newContent = { ...reportData.content };

            // 2. 转换其他费用 (Other Fees) - 金额跟随转换系数直接变动
            if (newContent.other_fees && newContent.other_fees.length > 0) {
                newContent.other_fees = newContent.other_fees.map(fee => ({
                    ...fee,
                    amount: Number(fee.amount || 0) * multiplier
                }));
            }

            // 3. 转换工时费 (Labor Charges) - 重新应用该币种的标准时薪
            if (newContent.labor_charges && newContent.labor_charges.length > 0) {
                let defaultCny = systemSettings?.default_labor_rate_cny || 100;
                let defaultUsd = systemSettings?.default_labor_rate_usd || 20;
                let defaultEur = systemSettings?.default_labor_rate_eur || 20;
                
                let targetRate = defaultCny;
                if (newCurrency === 'USD') targetRate = defaultUsd;
                else if (newCurrency === 'EUR') targetRate = defaultEur;

                newContent.labor_charges = newContent.labor_charges.map(labor => ({
                    ...labor,
                    rate: targetRate,
                    total: Number(labor.hours || 0) * targetRate
                }));
            }

            // 4. 重算备件费用 (Parts Replaced) - 用 SKU 调用批量查询接口获取新币种价格
            if (newContent.repair_process?.parts_replaced && newContent.repair_process.parts_replaced.length > 0) {
                const skus = newContent.repair_process.parts_replaced
                                .filter(p => p.part_number)
                                .map(p => p.part_number);

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

                        newContent.repair_process.parts_replaced = newContent.repair_process.parts_replaced.map(part => {
                            if (part.part_number && priceMap[part.part_number] !== undefined) {
                                const newPrice = priceMap[part.part_number];
                                return { ...part, unit_price: newPrice, total: Number(part.quantity || 1) * newPrice };
                            }
                            // 如果是手工件（无 SKU），直接按比例转换
                            return { ...part, unit_price: Number(part.unit_price || 0) * multiplier, total: Number(part.quantity || 1) * Number(part.unit_price || 0) * multiplier };
                        });
                    }
                } else {
                    // 全是手工件，直接转换系数
                    newContent.repair_process.parts_replaced = newContent.repair_process.parts_replaced.map(part => ({
                        ...part,
                        unit_price: Number(part.unit_price || 0) * multiplier,
                        total: Number(part.quantity || 1) * Number(part.unit_price || 0) * multiplier
                    }));
                }
            }

            // 5. 应用状态更新
            setReportData(prev => ({
                ...prev,
                currency: newCurrency,
                content: newContent,
                // discount / tax 暂时原样保留或需做倍率转换？这里将折扣也直接按乘速应用
                discount_amount: Number(prev.discount_amount || 0) * multiplier
            }));

        } catch (err) {
            console.error('Failed to change currency:', err);
            showToast('切换币种失败，请检查网络或刷新重试。', 'error');
        } finally {
            setSaving(false);
        }
    };
    
    // ---- 审批流程相关 ----
    // Sync with prop when it changes
    useEffect(() => {
        setLocalReportId(initialReportId || undefined);
    }, [initialReportId]);

    const [reportData, setReportData] = useState<ReportData>({
        status: 'draft',
        content: DEFAULT_CONTENT,
        service_type: 'warranty',
        total_cost: 0,
        currency: 'CNY',
        warranty_status: '',
        repair_warranty_days: 90,
        payment_status: 'pending',
        parts_total: 0,
        labor_total: 0,
        shipping_total: 0,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        version: 1
    });

    // PDF export settings - 扩展设置项
    const [pdfSettings, setPdfSettings] = useState({
        format: 'a4' as 'a4' | 'letter',
        orientation: 'portrait' as 'portrait' | 'landscape',
        showHeader: true,
        showFooter: true
    });
    
    // 预览语言设置（独立于PDF设置，用于实时预览）
    const [previewLanguage, setPreviewLanguage] = useState<'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE'>('original');

    // Translations state
    const [translations, setTranslations] = useState<Record<string, Record<string, any>>>({});
    const [activeTranslationLang, setActiveTranslationLang] = useState('en-US');
    const [translatingFields, setTranslatingFields] = useState<Set<string>>(new Set());
    // Re-translate confirmation modal state
    const [retranslateConfirm, setRetranslateConfirm] = useState<{
        isOpen: boolean;
        fieldKey: string;
        langCode: string;
        sourceText: string;
        currentTranslation: string;
        countdown: number;
    }>({ isOpen: false, fieldKey: '', langCode: '', sourceText: '', currentTranslation: '', countdown: 5 });

    // Countdown timer for re-translate confirmation
    useEffect(() => {
        if (retranslateConfirm.isOpen && retranslateConfirm.countdown > 0) {
            const timer = setInterval(() => {
                setRetranslateConfirm(prev => ({
                    ...prev,
                    countdown: prev.countdown - 1
                }));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [retranslateConfirm.isOpen, retranslateConfirm.countdown]);

    // 恢复编辑区域滚动位置
    useEffect(() => {
        if (activeTab === 'edit' && editScrollRef.current) {
            editScrollRef.current.scrollTop = editScrollPosition;
        }
    }, [activeTab, editScrollPosition]);

    // 恢复预览区域滚动位置
    useEffect(() => {
        if (activeTab === 'preview' && previewScrollRef.current) {
            previewScrollRef.current.scrollTop = previewScrollPosition;
        }
    }, [activeTab, previewScrollPosition]);

    const handleAITranslate = async (fieldKey: string, langCode: string, sourceText: string, currentEditValue?: string) => {
        if (!sourceText.trim()) return;
        
        const fieldLangKey = `${fieldKey}-${langCode}`;
        // Use current edit value if provided (from textarea), otherwise fall back to saved translation
        const currentTranslation = currentEditValue !== undefined ? currentEditValue : (translations[langCode]?.[fieldKey] || '');
        
        // 如果文本框有内容，显示确认弹窗
        if (currentTranslation.trim()) {
            setRetranslateConfirm({
                isOpen: true,
                fieldKey,
                langCode,
                sourceText,
                currentTranslation,
                countdown: 5
            });
            return;
        }
        
        setTranslatingFields(prev => new Set(prev).add(fieldLangKey));
        
        try {
            // Directly call Bokeh AI for translation
            await callBokehAI(fieldKey, langCode, sourceText);
        } catch (err) {
            console.error('Translation error:', err);
            showToast('Bokeh翻译失败，请稍后重试', 'error');
        } finally {
            setTranslatingFields(prev => {
                const next = new Set(prev);
                next.delete(fieldLangKey);
                return next;
            });
        }
    };

    // Handle confirmed re-translate
    const handleConfirmedRetranslate = async () => {
        const { fieldKey, langCode, sourceText } = retranslateConfirm;
        const fieldLangKey = `${fieldKey}-${langCode}`;
        
        setRetranslateConfirm(prev => ({ ...prev, isOpen: false }));
        setTranslatingFields(prev => new Set(prev).add(fieldLangKey));
        
        try {
            await callBokehAI(fieldKey, langCode, sourceText);
        } catch (err) {
            console.error('Translation error:', err);
            showToast('Bokeh翻译失败，请稍后重试', 'error');
        } finally {
            setTranslatingFields(prev => {
                const next = new Set(prev);
                next.delete(fieldLangKey);
                return next;
            });
        }
    };

    const callBokehAI = async (fieldKey: string, langCode: string, sourceText: string) => {
        try {
            const langNames: Record<string, string> = {
                'en-US': 'English',
                'ja-JP': '日本語',
                'de-DE': 'Deutsch'
            };
            
            const res = await axios.post('/api/v1/bokeh/chat', {
                message: `请将以下维修报告内容翻译成${langNames[langCode]}，保持专业术语准确，只返回翻译结果：\n\n${sourceText}`,
                stream: false
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.response) {
                const translatedText = res.data.response.trim();
                const updated = {
                    ...translations,
                    [langCode]: {
                        ...translations[langCode],
                        [fieldKey]: translatedText,
                        _meta: {
                            updated_at: new Date().toISOString(),
                            updated_by: 'Bokeh AI',
                            is_manual_edit: false
                        }
                    }
                };
                setTranslations(updated);
                // 如果有localReportId则保存到后端，否则只存本地state（随报告保存时提交）
                if (localReportId) {
                    await saveTranslation(fieldKey, langCode, translatedText, false);
                }
                // Show success message
                const langDisplayNames: Record<string, string> = {
                    'en-US': 'English',
                    'ja-JP': '日本語',
                    'de-DE': 'Deutsch'
                };
                showToast(`Bokeh翻译完成：已翻译成${langDisplayNames[langCode]}`, 'success');
            }
        } catch (err) {
            console.error('Bokeh AI error:', err);
            showToast('Bokeh翻译服务暂时不可用，请稍后重试', 'error');
        }
    };

    const saveTranslation = async (fieldKey: string, langCode: string, text: string, isManual: boolean) => {
        // Update local state first for immediate UI feedback
        const updated = {
            ...translations,
            [langCode]: {
                ...translations[langCode],
                [fieldKey]: text,
                _meta: {
                    updated_at: new Date().toISOString(),
                    updated_by: isManual ? 'Manual Edit' : 'Bokeh AI',
                    is_manual_edit: isManual
                }
            }
        };
        setTranslations(updated);
        
        // Save to backend if report exists
        if (!localReportId) return;
        try {
            await axios.post(
                `/api/v1/rma-documents/repair-reports/${localReportId}/translations`,
                {
                    lang: langCode,
                    translations: { [fieldKey]: text },
                    is_manual_edit: isManual
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) {
            console.error('Save translation error:', err);
        }
    };

    const isReadOnly = reportData.status === 'published' || reportData.status === 'approved' || reportData.status === 'pending_review';
    const isOpMode = currentNode === 'op_repairing';
    const canEdit = !isReadOnly && (reportData.status === 'draft' || reportData.status === 'rejected');
    const canSubmit = canEdit && reportData.content.diagnosis.findings;
    const canExport = true; // 任何时候都可以导出

    // Auto-save logic - auto-save for both new and existing reports
    useEffect(() => {
        if (!isOpen || isReadOnly) return;

        const debounceTimer = setTimeout(() => {
            saveDraft(true); // silent auto-save, don't close modal
        }, 5000); // 5 seconds debounce

        return () => clearTimeout(debounceTimer);
    }, [reportData.content, reportData.service_type, reportData.currency, reportData.payment_status, reportData.prepared_by, translations, localReportId]);

    useEffect(() => {
        if (isOpen) {
            fetchTicketInfo();
            fetchMSUsers();
            // 获取系统默认工时时薪
            axios.get('/api/v1/system/public-settings').then(res => {
                if (res.data?.success && res.data.data?.default_labor_rate_cny) {
                    setDefaultLaborRate(parseFloat(res.data.data.default_labor_rate_cny) || 100);
                }
            }).catch(() => {});
            // 一并加载设置
            const loadSystemSettings = async () => {
                try {
                    const res = await axios.get('/api/v1/system/public-settings');
                    if (res.data?.success) {
                        setSystemSettings(res.data.data);
                    }
                } catch (err) {
                    console.error('Failed to load system settings:', err);
                }
            };
            loadSystemSettings();
            
            if (localReportId) {
                loadReport();
            } else {
                initializeFromTicket();
            }
        }
    }, [isOpen, localReportId, ticketId]);

    const fetchTicketInfo = async () => {
        try {
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setTicketInfo(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load ticket info for headers:', err);
        }
    };

    // 获取MS部门用户列表
    const fetchMSUsers = async () => {
        try {
            const res = await axios.get('/api/v1/system/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                // 过滤MS部门用户
                const msDeptUsers = res.data.data.filter((u: any) => {
                    const dept = (u.department_name || u.department || '').toLowerCase();
                    return dept.includes('市场') || dept.includes('ms') || dept.includes('market');
                }).map((u: any) => ({
                    id: u.id,
                    display_name: u.display_name || u.name,
                    department_name: u.department_name || u.department
                }));
                setMsUsers(msDeptUsers);
            }
        } catch (err) {
            console.error('Failed to fetch MS users:', err);
        }
    };

    const loadReport = async () => {
        if (!localReportId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/rma-documents/repair-reports/${localReportId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const incomingData = res.data.data;
                
                // Load translations if available
                if (incomingData.translations) {
                    try {
                        const parsedTranslations = typeof incomingData.translations === 'string' 
                            ? JSON.parse(incomingData.translations) 
                            : incomingData.translations;
                        setTranslations(parsedTranslations);
                    } catch (e) {
                        console.error('Failed to parse translations:', e);
                    }
                }
                
                // Defensive merge to ensure all content structure exists
                // 保留 prepared_by 和 ticket_created_date 字段（如果后端没有返回）
                setReportData(prev => ({
                    ...incomingData,
                    prepared_by: incomingData.prepared_by || prev.prepared_by,
                    ticket_created_date: incomingData.ticket_created_date || prev.ticket_created_date,
                    content: {
                        ...DEFAULT_CONTENT,
                        ...(incomingData.content || {}),
                        header: { ...DEFAULT_CONTENT.header, ...(incomingData.content?.header || {}) },
                        device_info: { ...DEFAULT_CONTENT.device_info, ...(incomingData.content?.device_info || {}) },
                        issue_description: { ...DEFAULT_CONTENT.issue_description, ...(incomingData.content?.issue_description || {}) },
                        diagnosis: { ...DEFAULT_CONTENT.diagnosis, ...(incomingData.content?.diagnosis || {}) },
                        repair_process: { ...DEFAULT_CONTENT.repair_process, ...(incomingData.content?.repair_process || {}) },
                        other_fees: incomingData.content?.other_fees || DEFAULT_CONTENT.other_fees,
                        qa_result: { ...DEFAULT_CONTENT.qa_result, ...(incomingData.content?.qa_result || {}) },
                        warranty_terms: { ...DEFAULT_CONTENT.warranty_terms, ...(incomingData.content?.warranty_terms || {}) }
                    }
                }));

                // 同步最新的 op_repair_report 配件数据（确保维修记录的最新配件能被导入）
                try {
                    const ticketRes = await axios.get(`/api/v1/tickets/${ticketId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const allActivities = ticketRes.data?.activities || [];
                    const opRepairActivity = allActivities.find((a: any) => a.activity_type === 'op_repair_report');
                    if (opRepairActivity?.metadata) {
                        const opData = typeof opRepairActivity.metadata === 'string'
                            ? JSON.parse(opRepairActivity.metadata) : opRepairActivity.metadata;
                        setCachedOpRepairData(opData); // 缓存用于一键导入按鈕
                        const rp = opData.repair_process;
                        if (rp) {
                            setReportData(prev => {
                                const newContent = { ...prev.content };
                                if (rp.parts_replaced && rp.parts_replaced.length > 0 && prev.content.repair_process.parts_replaced.length === 0) {
                                    newContent.repair_process = {
                                        ...newContent.repair_process,
                                        parts_replaced: rp.parts_replaced.map((part: any) => ({
                                            id: part.id || Date.now().toString() + Math.random(),
                                            part_id: part.part_id,
                                            name: part.name || '',
                                            part_number: part.part_number || '',
                                            quantity: part.quantity || 1,
                                            unit_price: part.price || part.unit_price || 0,
                                            status: part.status || 'new',
                                            source_type: 'hq_inventory'
                                        }))
                                    };
                                }
                                if (rp.labor_hours && rp.labor_hours > 0 && prev.content.labor_charges.length === 0) {
                                    const initialRate = defaultLaborRate;
                                    newContent.labor_charges = [{
                                        description: '维修工时',
                                        hours: rp.labor_hours,
                                        rate: initialRate,
                                        total: initialRate * rp.labor_hours
                                    }];
                                }
                                return { ...prev, content: newContent };
                            });
                        }
                    }
                } catch (e) {
                    console.error('Failed to sync op_repair_report parts:', e);
                }

                // ★ 最后一步：同步服务端最新配件货币价格（未发布状态下，确保草稿准确）
                // 关键修复：已发布状态直接读取 content 快照，不再同步，实现“财务锁定”
                const isPublishedFlag = incomingData.status === 'published' || incomingData.status === 'approved';
                if (!isPublishedFlag && ['draft', 'pending_review', 'rejected', ''].includes(incomingData.status || '')) {
                    try {
                        // 收集所有配件的 SKU（part_number）
                        const allSkus: string[] = [];
                        setReportData(prev => {
                            (prev.content?.repair_process?.parts_replaced || []).forEach((p: any) => {
                                if (p.part_number && !allSkus.includes(p.part_number)) allSkus.push(p.part_number);
                            });
                            return prev; // 不修改状态，只收集 SKU
                        });

                        // 等一个 tick 确保 allSkus 被填充
                        await new Promise(r => setTimeout(r, 50));

                        // 重新收集（因为 setState 是异步的，直接从 incomingData 兜底）
                        const skusToFetch: string[] = [];
                        // op_repair_report 可能已覆盖，所以从 prev 收集
                        // 但 prev 可能还没更新，所以也从 incomingData 收集
                        (incomingData.content?.repair_process?.parts_replaced || []).forEach((p: any) => {
                            if (p.part_number && !skusToFetch.includes(p.part_number)) skusToFetch.push(p.part_number);
                        });

                        if (skusToFetch.length > 0) {
                            const pricesRes = await axios.post(`/api/v1/parts-master/batch`, { skus: skusToFetch }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            
                            if (pricesRes.data?.success) {
                                const currency = incomingData.currency || 'CNY';
                                const priceMap: Record<string, number> = {};
                                pricesRes.data.data.forEach((part: any) => {
                                    let targetPrice = Number(part.price_cny || 0);
                                    if (currency === 'USD') targetPrice = Number(part.price_usd || 0);
                                    else if (currency === 'EUR') targetPrice = Number(part.price_eur || 0);
                                    priceMap[part.sku] = targetPrice;
                                });

                                setReportData(prev => {
                                    const newContent = JSON.parse(JSON.stringify(prev.content));
                                    if (newContent.repair_process?.parts_replaced) {
                                        newContent.repair_process.parts_replaced = newContent.repair_process.parts_replaced.map((part: any) => {
                                            if (part.part_number && priceMap[part.part_number] !== undefined) {
                                                const newPrice = priceMap[part.part_number];
                                                return {
                                                    ...part,
                                                    unit_price: newPrice,
                                                    total: Number(part.quantity || 1) * newPrice
                                                };
                                            }
                                            return part;
                                        });
                                        const pTotal = newContent.repair_process.parts_replaced.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
                                        const lTotal = (newContent.labor_charges || []).reduce((sum: number, l: any) => sum + Number(l.total || 0), 0);
                                        const oTotal = (newContent.other_fees || []).reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0);
                                        const sub = pTotal + lTotal + oTotal;
                                        const taxA = sub * (Number(prev.tax_rate || 0) / 100);
                                        return {
                                            ...prev,
                                            content: newContent,
                                            parts_total: pTotal,
                                            labor_total: lTotal,
                                            shipping_total: oTotal,
                                            tax_amount: taxA,
                                            total_cost: sub + taxA - Number(prev.discount_amount || 0)
                                        };
                                    }
                                    return prev;
                                });
                            }
                        }
                    } catch (err) {
                        console.error('[loadReport] Failed to sync latest currency prices:', err);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load report:', err);
            alert('加载维修报告失败');
        } finally {
            setLoading(false);
        }
    };

    const initializeFromTicket = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const ticket = res.data.data;

                // Parse warranty calculation for service type
                let serviceType: 'warranty' | 'paid' | 'goodwill' = 'paid';
                if (ticket.warranty_calculation) {
                    try {
                        const warranty = JSON.parse(ticket.warranty_calculation);
                        if (warranty.final_warranty_status === 'warranty_valid') {
                            serviceType = 'warranty';
                        }
                    } catch (e) { }
                }

                // 查找MS closing节点的负责人
                const allActivities = res.data.activities || [];
                const msClosingActivity = allActivities.find((a: any) => 
                    a.activity_type === 'node_transition' && 
                    a.metadata && 
                    (typeof a.metadata === 'string' ? JSON.parse(a.metadata).to_node === 'ms_closing' : a.metadata.to_node === 'ms_closing')
                );
                
                // 调试日志
                console.log('[DEBUG] Ticket assigned_to:', ticket.assigned_to, 'assigned_name:', ticket.assigned_name);
                console.log('[DEBUG] Ticket current_node:', ticket.current_node);
                console.log('[DEBUG] msClosingActivity:', msClosingActivity);
                
                let defaultPreparedBy = null;
                if (msClosingActivity && msClosingActivity.actor) {
                    defaultPreparedBy = {
                        id: msClosingActivity.actor.id,
                        display_name: msClosingActivity.actor.display_name || msClosingActivity.actor.name
                    };
                    console.log('[DEBUG] Using msClosingActivity actor:', defaultPreparedBy);
                } else if (ticket.current_node === 'ms_closing' && ticket.assigned_to && ticket.assigned_name) {
                    // 如果工单当前在 ms_closing 节点，使用当前对接人作为编制人
                    defaultPreparedBy = {
                        id: ticket.assigned_to,
                        display_name: ticket.assigned_name
                    };
                    console.log('[DEBUG] Using current ms_closing assigned:', defaultPreparedBy);
                } else if (ticket.assigned_to && ticket.assigned_name) {
                    // 兜底：使用当前对接人
                    defaultPreparedBy = {
                        id: ticket.assigned_to,
                        display_name: ticket.assigned_name
                    };
                    console.log('[DEBUG] Using fallback assigned:', defaultPreparedBy);
                } else {
                    console.log('[DEBUG] No defaultPreparedBy found');
                }

                // 如果 defaultPreparedBy 不在 msUsers 列表中，添加进去
                if (defaultPreparedBy) {
                    setMsUsers(prev => {
                        const exists = prev.find(u => u.id === defaultPreparedBy.id);
                        if (exists) return prev;
                        return [...prev, { 
                            id: defaultPreparedBy.id, 
                            display_name: defaultPreparedBy.display_name,
                            department_name: 'MS'
                        }];
                    });
                }
                
                setReportData(prev => ({
                    ...prev,
                    service_type: serviceType,
                    warranty_status: serviceType === 'warranty' ? 'In Warranty' : 'Out of Warranty',
                    ticket_created_date: ticket.created_at ? ticket.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                    prepared_by: defaultPreparedBy,
                    content: {
                        ...prev.content,
                        device_info: {
                            product_name: ticket.product_name || '',
                            product_name_en: ticket.product_name_en || '',
                            serial_number: ticket.serial_number || '',
                            firmware_version: ticket.firmware_version || '',
                            hardware_version: ticket.hardware_version || ''
                        },
                        issue_description: {
                            customer_reported: ticket.problem_description || ''
                        }
                    }
                }));

                // Find the latest diagnostic report activity
                const activities = res.data.activities || [];
                const diagnosticActivity = activities.find((a: any) => a.activity_type === 'diagnostic_report');
                let diagnosticMetadata = null;
                if (diagnosticActivity && diagnosticActivity.metadata) {
                    diagnosticMetadata = typeof diagnosticActivity.metadata === 'string'
                        ? JSON.parse(diagnosticActivity.metadata)
                        : diagnosticActivity.metadata;
                }

                // If diagnostic data exists in activity metadata, import it as initial findings
                if (diagnosticMetadata) {
                    try {
                        if (diagnosticMetadata.diagnosis) {
                            setReportData((prev: ReportData) => ({
                                ...prev,
                                content: {
                                    ...prev.content,
                                    diagnosis: {
                                        ...prev.content.diagnosis,
                                        findings: diagnosticMetadata.diagnosis,
                                        root_cause: diagnosticMetadata.root_cause || '',
                                        troubleshooting_steps: Array.isArray(diagnosticMetadata.troubleshooting_steps) 
                                            ? diagnosticMetadata.troubleshooting_steps.join('\n') 
                                            : (diagnosticMetadata.troubleshooting_steps || '')
                                    },
                                    repair_process: {
                                        ...prev.content.repair_process,
                                        actions_taken: diagnosticMetadata.repair_advice 
                                            ? diagnosticMetadata.repair_advice 
                                            : (Array.isArray(diagnosticMetadata.actions_taken) 
                                                ? diagnosticMetadata.actions_taken.join('\n') 
                                                : (diagnosticMetadata.actions_taken || ''))
                                    }
                                }
                            }));
                        }
                    } catch (e) {
                        console.error('Failed to parse diagnostic metadata:', e);
                    }
                }

                // Find op_repair_report activity and import repair data (actions, parts, testing results, QA)
                const opRepairActivity = activities.find((a: any) => a.activity_type === 'op_repair_report');
                if (opRepairActivity && opRepairActivity.metadata) {
                    try {
                        const opRepairData = typeof opRepairActivity.metadata === 'string'
                            ? JSON.parse(opRepairActivity.metadata)
                            : opRepairActivity.metadata;
                        setCachedOpRepairData(opRepairData); // 缓存用于一键导入按鈕
                        
                        setReportData((prev: ReportData) => {
                            const newContent = { ...prev.content };
                            
                            // Import repair process data
                            if (opRepairData.repair_process) {
                                const rp = opRepairData.repair_process;
                                // Merge actions_taken (concatenate strings with newline)
                                const existingActions = newContent.repair_process.actions_taken || '';
                                const repairActions = rp.actions_taken || '';
                                const combinedActions = [existingActions, repairActions].filter(Boolean).join('\n');
                                newContent.repair_process.actions_taken = combinedActions;
                                
                                // Import parts_replaced with unit_price default
                                if (rp.parts_replaced && rp.parts_replaced.length > 0) {
                                    newContent.repair_process.parts_replaced = rp.parts_replaced.map((part: any) => ({
                                        id: part.id || Date.now().toString() + Math.random(),
                                        part_id: part.part_id,
                                        name: part.name || '',
                                        part_number: part.part_number || '',
                                        quantity: part.quantity || 1,
                                        unit_price: part.price || part.unit_price || 0,  // 正式报告需要价格
                                        status: part.status || 'new'
                                    }));
                                }
                                
                                // Import labor_hours 为 labor_charges
                                if (rp.labor_hours && rp.labor_hours > 0) {
                                    newContent.labor_charges = [{
                                        description: '维修工时',
                                        hours: rp.labor_hours,
                                        rate: 0,
                                        total: 0
                                    }];
                                }
                                
                                // Import testing_results
                                if (rp.testing_results) {
                                    newContent.repair_process.testing_results = rp.testing_results;
                                }
                            }
                            
                            // Import QA result
                            if (opRepairData.qa_result) {
                                newContent.qa_result = {
                                    passed: opRepairData.qa_result.passed ?? true,
                                    test_duration: opRepairData.qa_result.test_duration || '48 hours',
                                    notes: opRepairData.qa_result.notes || ''
                                };
                            }
                            
                            // Import warranty terms
                            if (opRepairData.warranty_terms) {
                                newContent.warranty_terms = {
                                    ...newContent.warranty_terms,
                                    repair_warranty_days: opRepairData.warranty_terms.repair_warranty_days || 90
                                };
                            }
                            
                            return { ...prev, content: newContent };
                        });
                    } catch (e) {
                        console.error('Failed to parse op_repair_report metadata:', e);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateContent = (path: string, value: any) => {
        setReportData((prev: ReportData) => {
            const keys = path.split('.');
            // 深拷贝 content 以确保不可变更新
            const newContent = JSON.parse(JSON.stringify(prev.content));
            let target: any = newContent;
            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
            return { ...prev, content: newContent };
        });
    };

    // 使用 useMemo 进行高性能合计计算，消除 useEffect 导致的自循环渲染
    const totals = useMemo(() => {
        const partsTotal = (reportData.content?.repair_process?.parts_replaced || []).reduce(
            (sum: number, part: PartUsed) => sum + (Number(part.quantity || 0) * (Number(part.unit_price || 0))), 0
        );
        const laborTotal = (reportData.content?.labor_charges || []).reduce(
            (sum: number, labor: LaborCharge) => sum + (Number(labor.total || 0)), 0
        );
        const otherFeesTotal = (reportData.content?.other_fees || []).reduce(
            (sum: number, fee: OtherFee) => sum + (Number(fee.amount || 0)), 0
        );
        
        const subtotal = partsTotal + laborTotal + otherFeesTotal;
        const taxRate = Number(reportData.tax_rate || 0);
        const discountAmount = Number(reportData.discount_amount || 0);
        const taxAmount = (subtotal * taxRate) / 100;
        const total = subtotal + taxAmount - discountAmount;

        return { partsTotal, laborTotal, otherFeesTotal, subtotal, taxAmount, total };
    }, [reportData.content.repair_process.parts_replaced, reportData.content.labor_charges, reportData.content.other_fees, reportData.tax_rate, reportData.discount_amount]);

    // 一键导入维修记录的配件和工时，覆盖当前数据
    const importFromRepairRecord = useCallback(async () => {
        setImportingFromRepair(true);
        try {
            // 使用缓存数据，或重新请求
            let opData = cachedOpRepairData;
            if (!opData) {
                const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const acts = res.data?.activities || [];
                const act = acts.find((a: any) => a.activity_type === 'op_repair_report');
                if (act?.metadata) {
                    opData = typeof act.metadata === 'string' ? JSON.parse(act.metadata) : act.metadata;
                    setCachedOpRepairData(opData);
                }
            }
            if (!opData) { alert('未找到维修记录数据'); return; }
            const rp = opData.repair_process;
            setReportData(prev => {
                const newContent = { ...prev.content };
                if (rp?.parts_replaced && rp.parts_replaced.length > 0) {
                    newContent.repair_process = {
                        ...newContent.repair_process,
                        parts_replaced: rp.parts_replaced.map((part: any) => ({
                            id: part.id || Date.now().toString() + Math.random(),
                            part_id: part.part_id,
                            name: part.name || '',
                            part_number: part.part_number || '',
                            quantity: part.quantity || 1,
                            unit_price: part.unit_price || part.price || 0,
                            status: part.status || 'new',
                            source_type: 'hq_inventory'
                        }))
                    };
                }
                if (rp?.labor_hours && rp.labor_hours > 0) {
                    const rate = prev.content.labor_charges?.[0]?.rate || defaultLaborRate;
                    newContent.labor_charges = [{
                        description: '维修工时',
                        hours: rp.labor_hours,
                        rate: rate,
                        total: rate * rp.labor_hours
                    }];
                }
                return { ...prev, content: newContent };
            });
        } catch (e) {
            console.error('importFromRepairRecord error:', e);
        } finally {
            setImportingFromRepair(false);
        }
    }, [cachedOpRepairData, ticketId, token]);

    const addLaborCharge = () => {
        let defaultRate = 100;
        if (systemSettings) {
            if (reportData.currency === 'USD') defaultRate = systemSettings.default_labor_rate_usd || 20;
            else if (reportData.currency === 'EUR') defaultRate = systemSettings.default_labor_rate_eur || 20;
            else defaultRate = systemSettings.default_labor_rate_cny || 100;
        }

        const newCharge: LaborCharge = {
            description: '',
            hours: 0,
            rate: defaultRate,
            total: 0
        };
        updateContent('labor_charges', [...reportData.content.labor_charges, newCharge]);
    };

    const updateLaborCharge = (index: number, field: keyof LaborCharge, value: any) => {
        const charges = [...reportData.content.labor_charges];
        charges[index] = { ...charges[index], [field]: value };
        if (field === 'hours' || field === 'rate') {
            charges[index].total = charges[index].hours * charges[index].rate;
        }
        updateContent('labor_charges', charges);
    };

    const removeLaborCharge = (index: number) => {
        const charges = reportData.content.labor_charges.filter((_: LaborCharge, i: number) => i !== index);
        updateContent('labor_charges', charges);
    };

    const addOtherFee = () => {
        const newFee: OtherFee = {
            id: `fee_${Date.now()}`,
            description: '',
            amount: 0
        };
        updateContent('other_fees', [...reportData.content.other_fees, newFee]);
    };

    const updateOtherFee = (index: number, field: keyof OtherFee, value: any) => {
        const fees = [...reportData.content.other_fees];
        fees[index] = { ...fees[index], [field]: value };
        updateContent('other_fees', fees);
    };

    const removeOtherFee = (index: number) => {
        const fees = reportData.content.other_fees.filter((_: OtherFee, i: number) => i !== index);
        updateContent('other_fees', fees);
    };

    const saveDraft = async (silent = false) => {
        // Auto-save is now enabled for both new and existing reports
        if (!silent) setSaving(true);
        try {
            // 在保存/发布前，如果是草稿状态，强制校准一遍 SKU 价格（防止烧录错误数值）
            // 关键修复：已发布或审批通过的报告不再重复校准，实现“价格锁定”
            let currentContent = { ...reportData.content };
            const isUnpublished = ['draft', 'rejected', ''].includes(reportData.status || '');
            if (isUnpublished) {
                const skus = currentContent.repair_process.parts_replaced
                                .filter(p => p.part_number)
                                .map(p => p.part_number);
                if (skus.length > 0) {
                    const pricesRes = await axios.post(`/api/v1/parts-master/batch`, { skus }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (pricesRes.data?.success) {
                        const priceMap = pricesRes.data.data.reduce((acc: any, part: any) => {
                            let targetPrice = part.price_cny;
                            if (reportData.currency === 'USD') targetPrice = part.price_usd;
                            else if (reportData.currency === 'EUR') targetPrice = part.price_eur;
                            acc[part.sku] = Number(targetPrice || 0);
                            return acc;
                        }, {});

                        currentContent.repair_process.parts_replaced = currentContent.repair_process.parts_replaced.map(part => {
                            if (part.part_number && priceMap[part.part_number] !== undefined) {
                                const newPrice = priceMap[part.part_number];
                                return { ...part, unit_price: newPrice, total: Number(part.quantity || 1) * newPrice };
                            }
                            return part;
                        });
                        
                        // 同步更新状态，以便 UI 保持一致
                        setReportData(prev => ({ 
                            ...prev, 
                            content: currentContent,
                            parts_total: totals.partsTotal, // 顺便同步合计
                            total_cost: totals.total
                        }));
                    }
                }
            }

            // 使用最新的 currentContent 计算合计，避免依赖异步的 state
            const partsTotal = currentContent.repair_process.parts_replaced.reduce((sum: number, p: any) => sum + (Number(p.total) || 0), 0);
            const laborTotal = currentContent.labor_charges.reduce((sum: number, l: any) => sum + (Number(l.total) || 0), 0);
            const otherTotal = currentContent.other_fees.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
            
            const subtotal = partsTotal + laborTotal + otherTotal;
            const taxAmount = (subtotal * (Number(reportData.tax_rate) || 0)) / 100;
            const discountAmount = Number(reportData.discount_amount) || 0;
            const totalCost = subtotal + taxAmount - discountAmount;

            const payload = {
                ticket_id: ticketId,
                content: currentContent,
                service_type: reportData.service_type,
                total_cost: totalCost,
                currency: reportData.currency,
                status: reportData.status, // 显式传递当前状态
                warranty_status: reportData.warranty_status,
                repair_warranty_days: reportData.repair_warranty_days,
                payment_status: reportData.payment_status,
                parts_total: partsTotal,
                labor_total: laborTotal,
                shipping_total: otherTotal,
                prepared_by: reportData.prepared_by,
                translations: translations,
                tax_rate: reportData.tax_rate,
                tax_amount: taxAmount,
                discount_amount: discountAmount
            };

            if (localReportId) {
                await axios.patch(`/api/v1/rma-documents/repair-reports/${localReportId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                const res = await axios.post('/api/v1/rma-documents/repair-reports', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Store the new report ID for subsequent saves
                if (res.data.data?.id) {
                    setLocalReportId(res.data.data.id);
                }
            }
            // Only call onSuccess for manual saves (non-silent), not for auto-saves
            if (!silent) {
                onSuccess();
            }
        } catch (err: any) {
            if (!silent) {
                alert(err.response?.data?.error || '保存失败');
            } else {
                console.error('Auto-save failed:', err);
            }
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const submitForReview = async () => {
        // 先执行保存，确保最新的校准价格（快照）已写入后端数据库
        setSubmitting(true);
        try {
            await saveDraft(true); 
            await axios.post(`/api/v1/rma-documents/repair-reports/${localReportId}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await loadReport();
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '提交审核失败');
        } finally {
            setSubmitting(false);
        }
    };



    const recallReport = async () => {
        setConfirmAction({ type: null, isOpen: false });
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/repair-reports/${localReportId}/recall`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await loadReport();
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
            const previewElement = document.getElementById('repair-report-preview-content');
            if (!previewElement) {
                alert('请先切换到预览模式');
                return;
            }

            await exportToPDF({
                filename: `${reportData.report_number || 'RepairReport'}.pdf`,
                element: previewElement,
                orientation: pdfSettings.orientation,
                format: pdfSettings.format
            });
        } catch (err) {
            console.error('PDF export error:', err);
            alert('PDF导出失败');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 900, height: '90vh', background: 'var(--glass-bg)', borderRadius: 16,
                border: '1px solid var(--glass-border)', overflow: 'hidden',
                boxShadow: '0 30px 60px var(--glass-shadow-lg)',
                display: 'flex', flexDirection: 'column', position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--glass-bg)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>
                                {isReadOnly ? '查看 正式维修报告' : (localReportId ? '编辑 正式维修报告' : '新建 正式维修报告')}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>工单 {ticketNumber}</span>
                                {reportData.report_number && (
                                    <span style={{ fontSize: 11, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                                        {reportData.report_number}
                                    </span>
                                )}
                                <StatusBadge status={reportData.status} />
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isOpMode && (
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 8 }}>
                                本节点修改后会自动保存
                            </span>
                        )}
                        <button
                            onClick={() => {
                                // 保存预览滚动位置
                                if (previewScrollRef.current) {
                                    setPreviewScrollPosition(previewScrollRef.current.scrollTop);
                                }
                                setActiveTab('edit');
                            }}
                            style={{
                                padding: '6px 16px', background: activeTab === 'edit' ? 'var(--glass-bg-hover)' : 'transparent',
                                border: 'none', color: activeTab === 'edit' ? 'var(--text-main)' : 'var(--text-secondary)', borderRadius: 6,
                                cursor: 'pointer', fontSize: 13
                            }}
                        >
                            编辑
                        </button>
                        {!isOpMode && (
                            <button
                                onClick={() => {
                                    // 保存编辑滚动位置
                                    if (editScrollRef.current) {
                                        setEditScrollPosition(editScrollRef.current.scrollTop);
                                    }
                                    setActiveTab('preview');
                                }}
                                style={{
                                    padding: '6px 16px', background: activeTab === 'preview' ? 'var(--glass-bg-hover)' : 'transparent',
                                    border: 'none', color: activeTab === 'preview' ? 'var(--text-main)' : 'var(--text-secondary)', borderRadius: 6,
                                    cursor: 'pointer', fontSize: 13
                                }}
                            >
                                预览
                            </button>
                        )}
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
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)',
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
                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                            加载中...
                        </div>
                    ) : activeTab === 'edit' ? (
                        <div 
                            ref={editScrollRef}
                            onScroll={(e) => setEditScrollPosition(e.currentTarget.scrollTop)}
                            style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                            {/* Header Info Panel */}
                            {isOpMode ? (
                                <div style={{
                                    background: 'var(--glass-bg)', padding: '16px 20px',
                                    borderRadius: 12, border: '1px solid var(--glass-border)',
                                    display: 'flex', gap: 48, alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>机器型号 / 序列号</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                                            {reportData.content.device_info.product_name || '-'} / {reportData.content.device_info.serial_number || '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>RMA建单日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo?.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-'}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>收到日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {ticketInfo?.returned_date ? new Date(ticketInfo.returned_date).toLocaleDateString('zh-CN') : (ticketInfo?.created_at ? new Date(ticketInfo.created_at).toLocaleDateString('zh-CN') : '-')}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }} />
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>检测日期</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                                            {new Date().toLocaleDateString('zh-CN')}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {saving && (
                                <div style={{ position: 'absolute', top: 120, right: 40, fontSize: 12, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--glass-bg-light)', padding: '4px 12px', borderRadius: 20, zIndex: 10 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', animation: 'pulse 1.5s infinite' }} />
                                    草稿已自动保存
                                </div>
                            )}

                            {/* RMA基本信息Header Panel - 优化排版 */}
                            {!isOpMode && ticketInfo && (
                                <div style={{
                                    background: 'var(--glass-bg)', padding: '20px',
                                    borderRadius: 12, border: '1px solid var(--glass-border)',
                                    marginBottom: 20
                                }}>
                                    {/* 第一行：设备信息 + 编制人 */}
                                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--glass-border)' }}>
                                        {/* 机器型号/序列号 - 占据更多空间 */}
                                        <div style={{ flex: 2, minWidth: 200 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>机器型号 / 序列号</div>
                                            <div style={{ fontSize: 15, color: 'var(--text-main)', fontWeight: 600 }}>
                                                {reportData.content.device_info.product_name || '-'} / {reportData.content.device_info.serial_number || '-'}
                                            </div>
                                        </div>
                                        {/* 编制人 - MS部门人员选择 */}
                                        <div style={{ flex: 1, minWidth: 140 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>编制人</div>
                                            {canEdit ? (
                                                <select
                                                    value={reportData.prepared_by?.id || ''}
                                                    onChange={(e) => {
                                                        const selectedId = parseInt(e.target.value);
                                                        const selectedUser = msUsers.find(u => u.id === selectedId);
                                                        setReportData(prev => ({
                                                            ...prev,
                                                            prepared_by: selectedUser ? {
                                                                id: selectedUser.id,
                                                                display_name: selectedUser.display_name
                                                            } : null
                                                        }));
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--glass-border)',
                                                        background: 'var(--glass-bg-light)',
                                                        color: 'var(--text-main)',
                                                        fontSize: 14,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">请选择编制人</option>
                                                    {msUsers.map(user => (
                                                        <option key={user.id} value={user.id}>
                                                            {user.display_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div style={{ fontSize: 14, color: 'var(--text-main)', padding: '10px 0' }}>
                                                    {reportData.prepared_by?.display_name || '-'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* 第二行：关键日期信息（包含工单日期） */}
                                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1, minWidth: 120 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>工单日期</div>
                                            {canEdit ? (
                                                <CustomDatePicker
                                                    label=""
                                                    value={reportData.ticket_created_date || ticketInfo.created_at || ''}
                                                    onChange={(val) => setReportData(prev => ({ ...prev, ticket_created_date: val }))}
                                                    maxDate={new Date().toISOString().split('T')[0]}
                                                />
                                            ) : (
                                                <div style={{ fontSize: 14, color: 'var(--text-main)', padding: '10px 0' }}>
                                                    {(reportData.ticket_created_date || ticketInfo.created_at || '-').split('T')[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 120 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>收到日期</div>
                                            {canEdit ? (
                                                <CustomDatePicker
                                                    label=""
                                                    value={reportData.received_date || ticketInfo.received_date || ticketInfo.returned_date || ''}
                                                    onChange={(val) => setReportData(prev => ({ ...prev, received_date: val }))}
                                                    minDate={reportData.ticket_created_date}
                                                    maxDate={new Date().toISOString().split('T')[0]}
                                                />
                                            ) : (
                                                <div style={{ fontSize: 14, color: 'var(--text-main)', padding: '10px 0' }}>
                                                    {(reportData.received_date || ticketInfo.received_date || ticketInfo.returned_date || '-').split('T')[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 120 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>检测日期</div>
                                            {canEdit ? (
                                                <CustomDatePicker
                                                    label=""
                                                    value={reportData.diagnosis_date || ticketInfo.repair_started_at || ''}
                                                    onChange={(val) => setReportData(prev => ({ ...prev, diagnosis_date: val }))}
                                                    minDate={reportData.received_date}
                                                    maxDate={new Date().toISOString().split('T')[0]}
                                                />
                                            ) : (
                                                <div style={{ fontSize: 14, color: 'var(--text-main)', padding: '10px 0' }}>
                                                    {(reportData.diagnosis_date || ticketInfo.repair_started_at || '-').split('T')[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 120 }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>维修日期</div>
                                            {canEdit ? (
                                                <CustomDatePicker
                                                    label=""
                                                    value={reportData.repair_date || ticketInfo.repair_completed_at || new Date().toISOString().split('T')[0]}
                                                    onChange={(val) => setReportData(prev => ({ ...prev, repair_date: val }))}
                                                    minDate={reportData.diagnosis_date}
                                                    maxDate={new Date().toISOString().split('T')[0]}
                                                />
                                            ) : (
                                                <div style={{ fontSize: 14, color: 'var(--text-main)', padding: '10px 0' }}>
                                                    {(reportData.repair_date || ticketInfo.repair_completed_at || new Date().toISOString().split('T')[0]).split('T')[0]}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Device Info */}
                            {!isOpMode && (
                                <Section title="设备信息" icon={<Wrench size={16} />}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                        <Input label="产品型号" value={reportData.content.device_info.product_name} onChange={v => updateContent('device_info.product_name', v)} disabled={!canEdit} />
                                        <Input label="序列号" value={reportData.content.device_info.serial_number} onChange={v => updateContent('device_info.serial_number', v)} disabled={!canEdit} />
                                        <Input label="固件版本" value={reportData.content.device_info.firmware_version} onChange={v => updateContent('device_info.firmware_version', v)} disabled={!canEdit} />
                                    </div>
                                </Section>
                            )}

                            {/* Issue Description */}
                            {!isOpMode && (
                                <Section title="故障描述" icon={<AlertCircle size={16} />}>
                                    <TextArea
                                        label="客户报修描述"
                                        value={reportData.content.issue_description.customer_reported}
                                        onChange={v => updateContent('issue_description.customer_reported', v)}
                                        disabled={!canEdit}
                                        placeholder="客户原始报修描述..."
                                        fieldKey="issue_description.customer_reported"
                                        translations={translations}
                                        onTranslationsUpdate={setTranslations}
                                        activeTranslationLang={activeTranslationLang}
                                        onActiveTranslationLangChange={setActiveTranslationLang}
                                        translatingFields={translatingFields}
                                        onAITranslate={handleAITranslate}
                                        onSaveTranslation={saveTranslation}
                                        translationPanelExpanded={translationPanelExpanded['issue_description.customer_reported']}
                                        onTranslationPanelExpandedChange={(expanded) => setTranslationPanelExpanded(prev => ({ ...prev, 'issue_description.customer_reported': expanded }))}
                                    />
                                </Section>
                            )}

                            {/* Diagnosis */}
                            <Section title="技术诊断" icon={<Stethoscope size={16} />}>
                                <TextArea
                                    label="检测发现"
                                    value={reportData.content.diagnosis.findings}
                                    onChange={v => updateContent('diagnosis.findings', v)}
                                    disabled={!canEdit}
                                    placeholder="详细的检测发现..."
                                    fieldKey="diagnosis.findings"
                                    translations={translations}
                                    onTranslationsUpdate={setTranslations}
                                    activeTranslationLang={activeTranslationLang}
                                    onActiveTranslationLangChange={setActiveTranslationLang}
                                    translatingFields={translatingFields}
                                    onAITranslate={handleAITranslate}
                                    onSaveTranslation={saveTranslation}
                                    translationPanelExpanded={translationPanelExpanded['diagnosis.findings']}
                                    onTranslationPanelExpandedChange={(expanded) => setTranslationPanelExpanded(prev => ({ ...prev, 'diagnosis.findings': expanded }))}
                                />
                                <TextArea
                                    label="根本原因"
                                    value={reportData.content.diagnosis.root_cause}
                                    onChange={v => updateContent('diagnosis.root_cause', v)}
                                    disabled={!canEdit}
                                    placeholder="故障根本原因分析..."
                                    fieldKey="diagnosis.root_cause"
                                    translations={translations}
                                    onTranslationsUpdate={setTranslations}
                                    activeTranslationLang={activeTranslationLang}
                                    onActiveTranslationLangChange={setActiveTranslationLang}
                                    translatingFields={translatingFields}
                                    onAITranslate={handleAITranslate}
                                    onSaveTranslation={saveTranslation}
                                    translationPanelExpanded={translationPanelExpanded['diagnosis.root_cause']}
                                    onTranslationPanelExpandedChange={(expanded) => setTranslationPanelExpanded(prev => ({ ...prev, 'diagnosis.root_cause': expanded }))}
                                />
                                <TextArea
                                    label="排故步骤"
                                    value={reportData.content.diagnosis.troubleshooting_steps}
                                    onChange={v => updateContent('diagnosis.troubleshooting_steps', v)}
                                    disabled={!canEdit}
                                    placeholder="记录排故步骤，每行一个步骤..."
                                    fieldKey="diagnosis.troubleshooting_steps"
                                    translations={translations}
                                    onTranslationsUpdate={setTranslations}
                                    activeTranslationLang={activeTranslationLang}
                                    onActiveTranslationLangChange={setActiveTranslationLang}
                                    translatingFields={translatingFields}
                                    onAITranslate={handleAITranslate}
                                    onSaveTranslation={saveTranslation}
                                    translationPanelExpanded={translationPanelExpanded['diagnosis.troubleshooting_steps']}
                                    onTranslationPanelExpandedChange={(expanded) => setTranslationPanelExpanded(prev => ({ ...prev, 'diagnosis.troubleshooting_steps': expanded }))}
                                />
                            </Section>

                            {/* Repair Process */}
                            <Section title="维修过程" icon={<Wrench size={16} />}>
                                <TextArea
                                    label="执行操作"
                                    value={reportData.content.repair_process.actions_taken}
                                    onChange={v => updateContent('repair_process.actions_taken', v)}
                                    disabled={!canEdit}
                                    placeholder="记录维修操作，每行一个操作..."
                                    fieldKey="repair_process.actions_taken"
                                    translations={translations}
                                    onTranslationsUpdate={setTranslations}
                                    activeTranslationLang={activeTranslationLang}
                                    onActiveTranslationLangChange={setActiveTranslationLang}
                                    translatingFields={translatingFields}
                                    onAITranslate={handleAITranslate}
                                    onSaveTranslation={saveTranslation}
                                    translationPanelExpanded={translationPanelExpanded['repair_process.actions_taken']}
                                    onTranslationPanelExpandedChange={(expanded) => setTranslationPanelExpanded(prev => ({ ...prev, 'repair_process.actions_taken': expanded }))}
                                />
                                <TextArea
                                    label="测试结果"
                                    value={reportData.content.repair_process.testing_results}
                                    onChange={v => updateContent('repair_process.testing_results', v)}
                                    disabled={!canEdit}
                                    placeholder="老化测试及功能验证结果..."
                                    fieldKey="repair_process.testing_results"
                                    translations={translations}
                                    onTranslationsUpdate={setTranslations}
                                    activeTranslationLang={activeTranslationLang}
                                    onActiveTranslationLangChange={setActiveTranslationLang}
                                    translatingFields={translatingFields}
                                    onAITranslate={handleAITranslate}
                                    onSaveTranslation={saveTranslation}
                                    translationPanelExpanded={translationPanelExpanded['repair_process.testing_results']}
                                    onTranslationPanelExpandedChange={(expanded) => setTranslationPanelExpanded(prev => ({ ...prev, 'repair_process.testing_results': expanded }))}
                                />
                                {/* 更换零件只读展示 - 在维修过程中展示零件信息 */}
                                {reportData.content.repair_process.parts_replaced.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>更换零件</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {reportData.content.repair_process.parts_replaced.map((part: PartUsed, i: number) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--glass-bg-light)', borderRadius: 6, border: '1px solid var(--glass-border)' }}>
                                                    <span style={{ flex: 1, color: 'var(--text-main)', fontSize: 13 }}>{part.name}</span>
                                                    {part.part_number && <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{part.part_number}</span>}
                                                    <span style={{ color: 'var(--text-main)', fontSize: 12, fontWeight: 500 }}>x{part.quantity}</span>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, padding: '2px 6px', background: 'var(--glass-border)', borderRadius: 4 }}>{part.status === 'new' ? '新件' : '翻新'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>* 零件费用详情请查看下方"费用明细"</div>
                                    </div>
                                )}
                            </Section>

                            {/* MS only sections */}
                            {!isOpMode && (
                                <>
                                    {/* Fee Details - Unified Section */}
                                    <Section title="费用明细" icon={<DollarSign size={16} />}>
                                        {/* 一键导入维修记录按鈕 */}
                                        {canEdit && cachedOpRepairData && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                                <button
                                                    onClick={() => setShowImportConfirm(true)}
                                                    disabled={importingFromRepair}
                                                    style={{
                                                        padding: '4px 12px',
                                                        background: '#EAB308',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        color: '#000',
                                                        fontSize: 12,
                                                        cursor: importingFromRepair ? 'wait' : 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    {importingFromRepair
                                                        ? <>导入中...</>
                                                        : <>↺ 从维修记录导入（覆盖）</>
                                                    }
                                                </button>
                                            </div>
                                        )}
                                        {/* Parts Sub-section - Using PartsSelector */}
                                        <FeeSubSection 
                                            title="更换零件" 
                                            icon={<Package size={14} />}
                                            subtotal={totals.partsTotal}
                                            currency={reportData.currency}
                                            defaultOpen={true}
                                        >
                                            <PartsSelector
                                                ticketId={ticketId}
                                                productModel={ticketInfo?.product_name || reportData.content.device_info.product_name}
                                                productModelId={ticketInfo?.product_model_id}
                                                selectedParts={reportData.content.repair_process.parts_replaced}
                                                onPartsChange={(parts) => updateContent('repair_process.parts_replaced', parts)}
                                                canEdit={canEdit}
                                                currency={reportData.currency}
                                                isWarranty={ticketInfo?.warranty_status === 'in_warranty'}
                                            />
                                        </FeeSubSection>

                                        {/* Labor Sub-section */}
                                        <FeeSubSection 
                                            title="工时费用" 
                                            icon={<Wrench size={14} />}
                                            subtotal={totals.laborTotal}
                                            currency={reportData.currency}
                                            defaultOpen={true}
                                        >
                                            {canEdit && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                                    <button
                                                        onClick={addLaborCharge}
                                                        style={{ padding: '4px 12px', background: '#FFD200', border: 'none', borderRadius: 4, color: '#000', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                                                    >
                                                        <Plus size={14} /> 添加工时
                                                    </button>
                                                </div>
                                            )}
                                            {reportData.content.labor_charges.length > 0 && (
                                                <div style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '8px 12px', background: 'var(--glass-bg-light)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                    <span style={{ flex: 1 }}>工作内容</span>
                                                    <span style={{ width: 70, textAlign: 'center' }}>工时</span>
                                                    <span style={{ width: 80, textAlign: 'right' }}>时薪</span>
                                                    <span style={{ width: 80, textAlign: 'right' }}>小计</span>
                                                    {canEdit && <span style={{ width: 36 }}></span>}
                                                </div>
                                            )}
                                            {reportData.content.labor_charges.map((charge: LaborCharge, index: number) => (
                                                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8, padding: 10, background: 'var(--glass-bg-light)', borderRadius: 6 }}>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <input
                                                            type="text"
                                                            value={charge.description}
                                                            onChange={e => updateLaborCharge(index, 'description', e.target.value)}
                                                            placeholder="工作内容描述"
                                                            disabled={!canEdit}
                                                            style={{ flex: 1, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={charge.hours}
                                                            onChange={e => updateLaborCharge(index, 'hours', parseFloat(e.target.value) || 0)}
                                                            disabled={!canEdit}
                                                            style={{ width: 70, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'center' }}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={charge.rate}
                                                            onChange={e => updateLaborCharge(index, 'rate', parseFloat(e.target.value) || 0)}
                                                            disabled={!canEdit}
                                                            style={{ width: 80, padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13, textAlign: 'right' }}
                                                        />
                                                        <div style={{ width: 80, textAlign: 'right', color: 'var(--text-main)', fontWeight: 600, fontSize: 13 }}>
                                                            {reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(charge.total || 0).toFixed(2)}
                                                        </div>
                                                        {canEdit && (
                                                            <button onClick={() => removeLaborCharge(index)} style={{ padding: 6, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {canEdit && (
                                                        <input
                                                            type="text"
                                                            value={charge.description_en || ''}
                                                            onChange={e => updateLaborCharge(index, 'description_en', e.target.value)}
                                                            placeholder="English description (for non-Chinese preview)"
                                                            style={{ padding: '5px 8px', background: 'var(--glass-bg-light)', border: '1px dashed var(--glass-border)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11, marginLeft: 0 }}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            {reportData.content.labor_charges.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无工时费用</div>
                                            )}
                                        </FeeSubSection>

                                        {/* Other Charges Sub-section */}
                                        <FeeSubSection 
                                            title="其他费用" 
                                            icon={<DollarSign size={14} />}
                                            subtotal={totals.otherFeesTotal}
                                            currency={reportData.currency}
                                            defaultOpen={true}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {reportData.content.other_fees.map((fee, index) => (
                                                    <div key={fee.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
                                                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>费用说明</label>
                                                                <input
                                                                    type="text"
                                                                    value={fee.description}
                                                                    onChange={e => updateOtherFee(index, 'description', e.target.value)}
                                                                    disabled={!canEdit}
                                                                    placeholder="如：运费、包装费、检测费..."
                                                                    style={{ width: '100%', padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                                />
                                                            </div>
                                                            <div style={{ width: 120 }}>
                                                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>费用金额</label>
                                                                <input
                                                                    type="number"
                                                                    value={fee.amount}
                                                                    onChange={e => updateOtherFee(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                    disabled={!canEdit}
                                                                    style={{ width: '100%', padding: 8, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                                />
                                                            </div>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => removeOtherFee(index)}
                                                                    style={{ padding: 8, background: 'var(--status-red-subtle)', border: 'none', borderRadius: 4, color: 'var(--status-red)', cursor: 'pointer', marginBottom: 0 }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {canEdit && (
                                                            <input
                                                                type="text"
                                                                value={fee.description_en || ''}
                                                                onChange={e => updateOtherFee(index, 'description_en', e.target.value)}
                                                                placeholder="English description (for non-Chinese preview)"
                                                                style={{ padding: '5px 8px', background: 'var(--glass-bg-light)', border: '1px dashed var(--glass-border)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11 }}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            {canEdit && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                                    <button
                                                        onClick={addOtherFee}
                                                        style={{ padding: '4px 12px', background: '#FFD200', border: 'none', borderRadius: 4, color: '#000', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                                                    >
                                                        <Plus size={14} /> 添加费用
                                                    </button>
                                                </div>
                                            )}
                                                {reportData.content.other_fees.length === 0 && (
                                                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无其他费用</div>
                                                )}
                                            </div>
                                        </FeeSubSection>

                                        {/* 财务汇总 */}
                                        <div style={{ marginTop: 16, padding: 16, background: 'var(--glass-bg-light)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <span>小计</span>
                                                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(totals.subtotal).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>税率 (%)</span>
                                                    <input
                                                        type="number"
                                                        value={reportData.tax_rate}
                                                        onChange={e => setReportData((prev: ReportData) => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                                                        disabled={!canEdit}
                                                        style={{ width: 50, padding: 4, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, textAlign: 'right' }}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <span>税额</span>
                                                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(totals.taxAmount).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>优惠金额</span>
                                                    <input
                                                        type="number"
                                                        value={reportData.discount_amount}
                                                        onChange={e => setReportData((prev: ReportData) => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                                                        disabled={!canEdit}
                                                        style={{ width: 80, padding: 4, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, textAlign: 'right' }}
                                                    />
                                                </div>
                                                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 14 }}>合计</span>
                                                        <select
                                                            value={reportData.currency}
                                                            onChange={e => handleCurrencyChange(e.target.value)}
                                                            disabled={!canEdit || Boolean(localReportId) && !['draft', 'rejected', ''].includes(reportData.status || '')}
                                                            style={{ padding: '4px 8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12 }}
                                                        >
                                                            <option value="CNY">CNY</option>
                                                            <option value="USD">USD</option>
                                                            <option value="EUR">EUR</option>
                                                        </select>
                                                    </div>
                                                    <span style={{ color: 'var(--text-main)', fontSize: 18, fontWeight: 700 }}>
                                                        {reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}
                                                        {Number(totals.total).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--glass-border)' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>支付状态</span>
                                                    <select
                                                        value={reportData.payment_status}
                                                        onChange={e => setReportData((prev: ReportData) => ({ ...prev, payment_status: e.target.value as 'pending' | 'paid' | 'waived' }))}
                                                        disabled={!canEdit}
                                                        style={{ padding: '6px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 13 }}
                                                    >
                                                        <option value="pending">待支付</option>
                                                        <option value="paid">已支付</option>
                                                        <option value="waived">已减免</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </Section>

                                    {/* 维修保修条款 - 放在报告最后 */}
                                    <div style={{ marginTop: 16, padding: 16, background: 'var(--glass-bg)', borderRadius: 8, border: '1px dashed var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>维修保修条款</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>质保期:</span>
                                                <input
                                                    type="number"
                                                    value={reportData.content.warranty_terms.repair_warranty_days}
                                                    onChange={e => updateContent('warranty_terms.repair_warranty_days', parseInt(e.target.value) || 90)}
                                                    disabled={!canEdit}
                                                    style={{ width: 50, padding: '4px 6px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-main)', fontSize: 12, textAlign: 'center' }}
                                                />
                                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>天</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            本次维修服务自客户签收之日起享有 <strong style={{ color: 'var(--accent-blue)' }}>{reportData.content.warranty_terms.repair_warranty_days || 90}</strong> 天质保期，仅限于本次维修所涉及的部件及服务。质保不包括：人为损坏、流体侵入、擅自拆修或改装、电压异常等非正常使用导致的损坏。如有疑问，请联系售后服务。
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <ReportPreview 
                            ref={previewScrollRef}
                            reportData={reportData} 
                            ticketInfo={ticketInfo} 
                            language={previewLanguage}
                            translations={translations}
                            onLanguageChange={(lang) => {
                                // 保存滚动位置
                                if (previewScrollRef.current) {
                                    setPreviewScrollPosition(previewScrollRef.current.scrollTop);
                                }
                                setPreviewLanguage(lang);
                            }}
                        />
                    )}
                </div>

                {/* Footer - 左侧设置按钮，右侧操作按钮 */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)' }}>
                    {/* 左侧：设置按钮 */}
                    <button
                        onClick={() => setShowPdfSettings(true)}
                        title="PDF导出设置"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'transparent',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--accent-blue-subtle)';
                            e.currentTarget.style.color = 'var(--text-main)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <Settings size={18} />
                    </button>
                    {/* 右侧：操作按钮组 */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        {canEdit && activeTab === 'edit' && (
                            <button
                                onClick={() => saveDraft(false)}
                                disabled={saving}
                                style={{ padding: '8px 20px', background: 'var(--glass-bg-hover)', border: 'none', borderRadius: 6, color: 'var(--text-main)', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Save size={16} /> {saving ? '保存中...' : '保存草稿'}
                            </button>
                        )}
                        {canSubmit && activeTab === 'edit' && (
                            <button
                                onClick={async () => {
                                    // If no reportId, save first then submit
                                    if (!localReportId) {
                                        setSaving(true);
                                        try {
                                            const payload = {
                                                ticket_id: ticketId,
                                                content: reportData.content,
                                                service_type: reportData.service_type,
                                                currency: reportData.currency,
                                                payment_status: reportData.payment_status,
                                                parts_total: reportData.parts_total,
                                                labor_total: reportData.labor_total,
                                                shipping_total: reportData.content.other_fees.reduce((sum, fee) => sum + fee.amount, 0),
                                                total_cost: reportData.total_cost,
                                                tax_rate: reportData.tax_rate,
                                                discount_amount: reportData.discount_amount,
                                                warranty_status: Boolean(reportData.warranty_status),
                                                repair_warranty_days: reportData.content.warranty_terms?.repair_warranty_days || 90
                                            };
                                            const res = await axios.post('/api/v1/rma-documents/repair-reports', payload, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            if (res.data.data?.id) {
                                                await axios.post(`/api/v1/rma-documents/repair-reports/${res.data.data.id}/submit`, {}, {
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
                                style={{
                                    padding: '10px 24px', background: '#FFD200', border: 'none', borderRadius: 8,
                                    color: '#000', fontSize: 14, fontWeight: 600, cursor: (submitting || saving) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, opacity: (submitting || saving) ? 0.6 : 1
                                }}
                            >
                                <Send size={16} /> {submitting ? '提交中...' : '提交发布'}
                            </button>
                        )}
                        {/* Export PDF only shown in preview mode */}
                        {canExport && activeTab === 'preview' && (
                            <button
                                onClick={exportPDF}
                                style={{
                                    padding: '10px 20px', background: 'var(--glass-border)',
                                    border: '1px solid var(--glass-border)', borderRadius: 8,
                                    color: 'var(--text-main)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
                                }}
                            >
                                <Download size={16} /> 导出 PDF
                            </button>
                        )}

                        {reportData.status === 'published' && ['Lead', 'Admin'].includes(user?.role || '') && (
                            <button
                                onClick={() => setConfirmAction({ type: 'recall', isOpen: true })}
                                disabled={submitting}
                                style={{
                                    padding: '10px 24px', background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                                    color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, opacity: submitting ? 0.6 : 1
                                }}
                            >
                                <X size={16} /> 撤回发布
                            </button>
                        )}
                    </div>
                </div>

                {/* Confirm Recall Modal */}
                {confirmAction.isOpen && confirmAction.type === 'recall' && (
                    <ConfirmModal
                        title="确认撤回"
                        message="确认撤回维修报告为草稿状态？撤回后可重新编辑。"
                        confirmText="确认撤回"
                        cancelText="取消"
                        isDanger={true}
                        onConfirm={recallReport}
                        onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                        loading={submitting}
                    />
                )}

                {/* 币种切换确认弹窗 */}
                {confirmAction.isOpen && confirmAction.type === 'changeCurrency' && (
                    <ConfirmModal
                        title="切换币种"
                        message={`切换到 ${confirmAction.payload?.newCurrency} 将会重新计算所有工时和费用，并且根据最新系统价格更新配件金额。是否继续？`}
                        confirmText="确认切换"
                        cancelText="取消"
                        isDanger={false}
                        onConfirm={() => executeCurrencyChange(confirmAction.payload.newCurrency)}
                        onCancel={() => setConfirmAction({ type: null, isOpen: false })}
                    />
                )}

                {/* 从维修记录导入确认弹窗 */}
                {showImportConfirm && (
                    <ConfirmModal
                        title="从维修记录导入"
                        message={`将从维修记录导入更换零件和工时数据，覆盖当前的费用明细中的‘更换零件’和‘工时费用’。\n\n确认覆盖？`}
                        confirmText="确认导入"
                        cancelText="取消"
                        isDanger={false}
                        onConfirm={() => { setShowImportConfirm(false); importFromRepairRecord(); }}
                        onCancel={() => setShowImportConfirm(false)}
                    />
                )}

                {/* Re-translate Confirmation Modal */}
                {retranslateConfirm.isOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 480, maxWidth: '90%', background: 'var(--modal-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Sparkles size={20} color="#3B82F6" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>确认重新翻译</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Bokeh翻译将覆盖当前内容</p>
                                </div>
                            </div>
                            
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>当前译文（将被覆盖）</label>
                                <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--text-main)', maxHeight: 100, overflow: 'auto' }}>
                                    {retranslateConfirm.currentTranslation}
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>源文本</label>
                                <div style={{ padding: 12, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', maxHeight: 80, overflow: 'auto' }}>
                                    {retranslateConfirm.sourceText}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                    onClick={() => setRetranslateConfirm(prev => ({ ...prev, isOpen: false }))}
                                    style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleConfirmedRetranslate}
                                    disabled={retranslateConfirm.countdown > 0}
                                    style={{ 
                                        padding: '10px 20px', borderRadius: 8, background: '#EAB308', border: 'none', 
                                        color: '#000', fontSize: 13, cursor: retranslateConfirm.countdown > 0 ? 'not-allowed' : 'pointer',
                                        opacity: retranslateConfirm.countdown > 0 ? 0.6 : 1,
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        fontWeight: 500
                                    }}
                                >
                                    <Sparkles size={14} />
                                    {retranslateConfirm.countdown > 0 ? `确认重新翻译 (${retranslateConfirm.countdown}s)` : '确认重新翻译'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PDF Settings Panel */}
                {showPdfSettings && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 440, background: 'var(--modal-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>PDF导出设置</h3>
                                <button onClick={() => setShowPdfSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
                            </div>
                            
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>纸张尺寸</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }].map(opt => (
                                        <button key={opt.value} onClick={() => setPdfSettings(prev => ({ ...prev, format: opt.value as any }))} style={{ flex: 1, padding: '10px', borderRadius: 8, background: pdfSettings.format === opt.value ? 'var(--accent-gold-subtle)' : 'var(--glass-bg-light)', border: `1px solid ${pdfSettings.format === opt.value ? 'var(--accent-gold-muted)' : 'var(--glass-border)'}`, color: pdfSettings.format === opt.value ? 'var(--text-main)' : 'var(--text-secondary)', fontSize: 14, fontWeight: pdfSettings.format === opt.value ? 600 : 400, cursor: 'pointer' }}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>方向</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[{ value: 'portrait', label: '纵向' }, { value: 'landscape', label: '横向' }].map(opt => (
                                        <button key={opt.value} onClick={() => setPdfSettings(prev => ({ ...prev, orientation: opt.value as any }))} style={{ flex: 1, padding: '10px', borderRadius: 8, background: pdfSettings.orientation === opt.value ? 'var(--accent-gold-subtle)' : 'var(--glass-bg-light)', border: `1px solid ${pdfSettings.orientation === opt.value ? 'var(--accent-gold-muted)' : 'var(--glass-border)'}`, color: pdfSettings.orientation === opt.value ? 'var(--text-main)' : 'var(--text-secondary)', fontSize: 14, fontWeight: pdfSettings.orientation === opt.value ? 600 : 400, cursor: 'pointer' }}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={pdfSettings.showHeader} onChange={e => setPdfSettings(prev => ({ ...prev, showHeader: e.target.checked }))} />显示页眉
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={pdfSettings.showFooter} onChange={e => setPdfSettings(prev => ({ ...prev, showFooter: e.target.checked }))} />显示页脚
                                </label>
                            </div>

                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowPdfSettings(false)} style={{ padding: '10px 24px', background: 'var(--accent-gold)', border: 'none', borderRadius: 8, color: '#000', fontWeight: 600, cursor: 'pointer' }}>完成</button>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};

// Helper Components
const Section: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <div style={{ background: 'var(--glass-bg)', padding: 20, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {icon && <span style={{ color: 'var(--accent-blue)' }}>{icon}</span>}
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{title}</h4>
        </div>
        {children}
    </div>
);

// Auto-resizing textarea component
const AutoResizeTextarea: React.FC<{ 
    value: string; 
    onChange: (v: string) => void; 
    disabled?: boolean; 
    placeholder?: string;
}> = ({ value, onChange, disabled, placeholder }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            // Reset height to auto to get the correct scrollHeight
            textareaRef.current.style.height = 'auto';
            // Set height to scrollHeight (minimum 40px for one line)
            textareaRef.current.style.height = Math.max(40, textareaRef.current.scrollHeight) + 'px';
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            style={{ 
                width: '100%', 
                minHeight: 40, 
                padding: 12, 
                background: 'var(--glass-bg-hover)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: 6, 
                color: 'var(--text-main)', 
                fontSize: 13, 
                resize: 'none', 
                outline: 'none',
                overflow: 'hidden'
            }}
        />
    );
};

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
    <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', padding: 10, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 6, color: 'var(--text-main)', fontSize: 13, outline: 'none' }}
        />
    </div>
);

const TextArea: React.FC<{ 
    label: string; 
    value: string; 
    onChange: (v: string) => void; 
    disabled?: boolean; 
    placeholder?: string;
    fieldKey?: string;
    translations?: Record<string, Record<string, any>>;
    onTranslationsUpdate?: (translations: Record<string, Record<string, any>>) => void;
    activeTranslationLang?: string;
    onActiveTranslationLangChange?: (lang: string) => void;
    translatingFields?: Set<string>;
    onAITranslate?: (fieldKey: string, lang: string, text: string) => void;
    onSaveTranslation?: (fieldKey: string, lang: string, text: string, isManual: boolean) => void;
    translationPanelExpanded?: boolean;
    onTranslationPanelExpandedChange?: (expanded: boolean) => void;
}> = ({ 
    label, 
    value, 
    onChange, 
    disabled, 
    placeholder,
    fieldKey,
    translations,
    onTranslationsUpdate,
    activeTranslationLang,
    onActiveTranslationLangChange,
    translatingFields,
    onAITranslate,
    onSaveTranslation,
    translationPanelExpanded,
    onTranslationPanelExpandedChange
}) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
        <AutoResizeTextarea
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
        />
        {/* Inline Translation Panel */}
        {fieldKey && translations && onTranslationsUpdate && activeTranslationLang && onActiveTranslationLangChange && translatingFields && onAITranslate && onSaveTranslation && (
            <InlineTranslationPanel
                fieldKey={fieldKey}
                originalText={value}
                translations={translations}
                activeLang={activeTranslationLang}
                onActiveLangChange={onActiveTranslationLangChange}
                translatingFields={translatingFields}
                onAITranslate={onAITranslate}
                onSaveTranslation={onSaveTranslation}
                isExpanded={translationPanelExpanded}
                onExpandedChange={onTranslationPanelExpandedChange}
            />
        )}
    </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const configs: Record<string, { text: string; color: string; bg: string }> = {
        'draft': { text: '草稿', color: 'var(--text-secondary)', bg: 'var(--glass-border)' },
        'pending_review': { text: '审核中', color: '#FFD200', bg: 'rgba(245,158,11,0.15)' },
        'approved': { text: '已发布', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
        'rejected': { text: '已驳回', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
        'published': { text: '已发布', color: '#10B981', bg: 'rgba(16,185,129,0.15)' }
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
        title: '维修报告',
        subtitle: '',
        reportNumber: '报告编号',
        serviceType: '服务类型',
        warranty: '保内服务',
        outOfWarranty: '保外服务',
        reportDate: '报告日期',
        preparedBy: '编制',
        ticketDate: '工单日期',
        receivedDate: '收货日期',
        diagnosisDate: '诊断日期',
        completionDate: '完成日期',
        section1: '1. 客户信息',
        customerName: '客户名称',
        contact: '联系人',
        phone: '联系电话',
        email: '联系邮箱',
        section2: '2. 设备信息',
        productModel: '产品型号',
        serialNumber: '序列号',
        firmwareVersion: '固件版本',
        section3: '3. 问题描述',
        customerReported: '客户报修',
        notProvided: '[未提供]',
        section4: '4. 技术诊断',
        findings: '检测结果',
        rootCause: '故障原因',
        troubleshootingSteps: '排查步骤',
        section5: '5. 维修过程',
        actionsTaken: '维修操作',
        testingResults: '测试结果',
        section6: '6. 费用明细',
        item: '项目',
        spec: '规格/编号',
        quantity: '数量',
        unitPrice: '单价',
        subtotal: '小计',
        part: '零件',
        labor: '工时',
        other: '其他',
        noFees: '未记录费用项目',
        partsSubtotal: '零件小计',
        laborSubtotal: '工时小计',
        otherFees: '其他费用',
        totalAmount: '合计金额',
        warrantyNote: '* 本次为保内服务，以上费用仅供记录，实际免收。',
        repairWarranty: '维修保修',
        days: '天',
        warrantyExclusions: '本保修仅适用于本次维修更换的部件，不包括:',
        footer: '本报告由卓曜科技（深圳）有限公司出具 | KINEFINITY INC.',
        footerContact: '如有疑问，请联系 service@kinefinity.com',
        pendingTranslation: '[待翻译]'
    },
    'zh-CN': {
        title: '维修报告',
        subtitle: '',
        reportNumber: '报告编号',
        serviceType: '服务类型',
        warranty: '保内服务',
        outOfWarranty: '保外服务',
        reportDate: '报告日期',
        preparedBy: '编制',
        ticketDate: '工单日期',
        receivedDate: '收货日期',
        diagnosisDate: '诊断日期',
        completionDate: '完成日期',
        section1: '1. 客户信息',
        customerName: '客户名称',
        contact: '联系人',
        phone: '联系电话',
        email: '联系邮箱',
        section2: '2. 设备信息',
        productModel: '产品型号',
        serialNumber: '序列号',
        firmwareVersion: '固件版本',
        section3: '3. 问题描述',
        customerReported: '客户报修',
        notProvided: '[未提供]',
        section4: '4. 技术诊断',
        findings: '检测结果',
        rootCause: '故障原因',
        troubleshootingSteps: '排查步骤',
        section5: '5. 维修过程',
        actionsTaken: '维修操作',
        testingResults: '测试结果',
        section6: '6. 费用明细',
        item: '项目',
        spec: '规格/编号',
        quantity: '数量',
        unitPrice: '单价',
        subtotal: '小计',
        part: '零件',
        labor: '工时',
        other: '其他',
        noFees: '未记录费用项目',
        partsSubtotal: '零件小计',
        laborSubtotal: '工时小计',
        otherFees: '其他费用',
        totalAmount: '合计金额',
        warrantyNote: '* 本次为保内服务，以上费用仅供记录，实际免收。',
        repairWarranty: '维修保修',
        days: '天',
        warrantyExclusions: '本保修仅适用于本次维修更换的部件，不包括:',
        footer: '本报告由卓曜科技（深圳）有限公司出具 | KINEFINITY INC.',
        footerContact: '如有疑问，请联系 service@kinefinity.com',
        pendingTranslation: '[待翻译]'
    },
    'en-US': {
        title: 'Repair Report',
        subtitle: '',
        reportNumber: 'Report No.',
        serviceType: 'Service Type',
        warranty: 'In Warranty',
        outOfWarranty: 'Out of Warranty',
        reportDate: 'Report Date',
        preparedBy: 'Prepared by',
        ticketDate: 'Ticket Date',
        receivedDate: 'Received Date',
        diagnosisDate: 'Diagnosis Date',
        completionDate: 'Completion Date',
        section1: '1. Customer Information',
        customerName: 'Customer Name',
        contact: 'Contact Person',
        phone: 'Phone',
        email: 'Email',
        section2: '2. Device Information',
        productModel: 'Product Model',
        serialNumber: 'Serial Number',
        firmwareVersion: 'Firmware Version',
        section3: '3. Issue Description',
        customerReported: 'Customer Reported',
        notProvided: '[Not Provided]',
        section4: '4. Technical Diagnosis',
        findings: 'Findings',
        rootCause: 'Root Cause',
        troubleshootingSteps: 'Troubleshooting Steps',
        section5: '5. Repair Process',
        actionsTaken: 'Actions Taken',
        testingResults: 'Testing Results',
        section6: '6. Cost Details',
        item: 'Item',
        spec: 'Spec/Part No.',
        quantity: 'Qty',
        unitPrice: 'Unit Price',
        subtotal: 'Subtotal',
        part: 'Part',
        labor: 'Labor',
        other: 'Other',
        noFees: 'No fees recorded',
        partsSubtotal: 'Parts Subtotal',
        laborSubtotal: 'Labor Subtotal',
        otherFees: 'Other Fees',
        totalAmount: 'Total Amount',
        warrantyNote: '* This is a warranty service. Above costs are for record only.',
        repairWarranty: 'Repair Warranty',
        days: 'days',
        warrantyExclusions: 'This warranty applies only to parts replaced in this repair, excluding:',
        footer: 'Issued by KINEFINITY INC.',
        footerContact: 'For inquiries, contact service@kinefinity.com',
        pendingTranslation: '[Pending Translation]',
    },
    'ja-JP': {
        title: '修理報告書',
        subtitle: '',
        reportNumber: '報告番号',
        serviceType: 'サービスタイプ',
        warranty: '保証期内',
        outOfWarranty: '保証期外',
        reportDate: '報告日',
        preparedBy: '作成者',
        ticketDate: 'チケット日',
        receivedDate: '受領日',
        diagnosisDate: '診断日',
        completionDate: '完了日',
        section1: '1. 顧客情報',
        customerName: '顧客名',
        contact: '担当者',
        phone: '電話',
        email: 'メール',
        section2: '2. 機器情報',
        productModel: '製品型番',
        serialNumber: 'シリアル番号',
        firmwareVersion: 'ファームウェア',
        section3: '3. 問題の説明',
        customerReported: '顧客報告',
        notProvided: '[未提供]',
        section4: '4. 技術診断',
        findings: '検査結果',
        rootCause: '根本原因',
        troubleshootingSteps: 'トラブルシューティング',
        section5: '5. 修理プロセス',
        actionsTaken: '実施した作業',
        testingResults: 'テスト結果',
        section6: '6. 費用明細',
        item: '項目',
        spec: '仕様/部品番号',
        quantity: '数量',
        unitPrice: '単価',
        subtotal: '小計',
        part: '部品',
        labor: '工数',
        other: 'その他',
        noFees: '費用記録なし',
        partsSubtotal: '部品小計',
        laborSubtotal: '工数小計',
        otherFees: 'その他費用',
        totalAmount: '合計金額',
        warrantyNote: '* 保証サービスのため、上記費用は記録用です。',
        repairWarranty: '修理保証',
        days: '日間',
        warrantyExclusions: '本保証は今回の修理で交換された部品にのみ適用され、以下を除きます:',
        footer: 'KINEFINITY INC. 発行',
        footerContact: 'お問い合わせ: service@kinefinity.com',
        pendingTranslation: '[翻訳待ち]',
    },
    'de-DE': {
        title: 'Reparaturbericht',
        subtitle: '',
        reportNumber: 'Bericht Nr.',
        serviceType: 'Serviceart',
        warranty: 'Garantie',
        outOfWarranty: 'Außerhalb Garantie',
        reportDate: 'Berichtsdatum',
        preparedBy: 'Erstellt von',
        ticketDate: 'Ticketdatum',
        receivedDate: 'Empfangsdatum',
        diagnosisDate: 'Diagnosedatum',
        completionDate: 'Fertigstellungsdatum',
        section1: '1. Kundeninformation',
        customerName: 'Kundenname',
        contact: 'Ansprechpartner',
        phone: 'Telefon',
        email: 'E-Mail',
        section2: '2. Geräteinformation',
        productModel: 'Produktmodell',
        serialNumber: 'Seriennummer',
        firmwareVersion: 'Firmware-Version',
        section3: '3. Problembeschreibung',
        customerReported: 'Kundenmeldung',
        notProvided: '[Nicht angegeben]',
        section4: '4. Technische Diagnose',
        findings: 'Befund',
        rootCause: 'Ursache',
        troubleshootingSteps: 'Fehlerbehebung',
        section5: '5. Reparaturprozess',
        actionsTaken: 'Durchgeführte Arbeiten',
        testingResults: 'Testergebnisse',
        section6: '6. Kostendetails',
        item: 'Position',
        spec: 'Spez./Teil-Nr.',
        quantity: 'Menge',
        unitPrice: 'Einzelpreis',
        subtotal: 'Zwischensumme',
        part: 'Teil',
        labor: 'Arbeit',
        other: 'Sonstiges',
        noFees: 'Keine Kosten erfasst',
        partsSubtotal: 'Teile Zwischensumme',
        laborSubtotal: 'Arbeit Zwischensumme',
        otherFees: 'Sonstige Kosten',
        totalAmount: 'Gesamtbetrag',
        warrantyNote: '* Garantieservice. Obige Kosten nur zu Dokumentationszwecken.',
        repairWarranty: 'Reparaturgarantie',
        days: 'Tage',
        warrantyExclusions: 'Diese Garantie gilt nur für in dieser Reparatur ausgetauschte Teile, ausgenommen:',
        footer: 'Herausgegeben von KINEFINITY INC.',
        footerContact: 'Kontakt: service@kinefinity.com',
        pendingTranslation: '[Übersetzung ausstehend]',
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

const ReportPreview = React.forwardRef<HTMLDivElement, {
    reportData: ReportData;
    ticketInfo?: any;
    language: 'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE';
    translations: Record<string, Record<string, any>>;
    onLanguageChange: (lang: 'original' | 'zh-CN' | 'en-US' | 'ja-JP' | 'de-DE') => void;
}>(({ reportData, ticketInfo, language, translations, onLanguageChange }, ref) => {
    // 获取UI标签
    const t = PREVIEW_LABELS[language] || PREVIEW_LABELS['original'];

    // 配件英文名称缓存（通过 SKU 索引，用于非中文预览）
    const [partNamesEnBySku, setPartNamesEnBySku] = useState<Record<string, string>>({});
    const { token } = useAuthStore();

    // 非中文预览时，通过 SKU 查询配件英文名称
    useEffect(() => {
        if (language === 'zh-CN' || language === 'original') return;
        
        const skus = reportData.content.repair_process.parts_replaced
            .map(p => p.part_number)
            .filter(sku => sku && sku.trim());
        
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
                // 静默失败，使用中文名称
            }
        };
        fetchPartNames();
    }, [reportData.content.repair_process.parts_replaced, language, token]);

    // 获取翻译内容（带待翻译标记）
    const getTranslatedContent = (fieldKey: string, originalValue: string): { text: string; isPending: boolean } => {
        if (!originalValue || language === 'original' || language === 'zh-CN') {
            return { text: originalValue || '', isPending: false };
        }
        const translated = translations[language]?.[fieldKey];
        if (translated) {
            return { text: translated, isPending: false };
        }
        // 无翻译时返回原文 + [待翻译]标记
        return { text: originalValue, isPending: true };
    };
    
    // 渲染带待翻译标记的内容
    const renderTranslatedContent = (fieldKey: string, originalValue: string) => {
        const { text, isPending } = getTranslatedContent(fieldKey, originalValue);
        if (!isPending) return text;
        return (
            <>
                {text}
                <span style={{
                    color: '#EF4444',
                    fontWeight: 700,
                    fontSize: '0.85em',
                    marginLeft: 4,
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                    {t.pendingTranslation}
                </span>
            </>
        );
    };

    // 计算费用总计
    const totals = useMemo(() => {
        const partsTotal = (reportData.content?.repair_process?.parts_replaced || []).reduce(
            (sum, part) => sum + (part.quantity || 0) * (part.unit_price || 0),
            0
        );
        const laborTotal = (reportData.content?.labor_charges || []).reduce(
            (sum, charge) => sum + (charge.total || 0),
            0
        );
        const otherFeesTotal = (reportData.content?.other_fees || []).reduce(
            (sum, fee) => sum + (fee.amount || 0),
            0
        );
        const total = partsTotal + laborTotal + otherFeesTotal;
        return { partsTotal, laborTotal, otherFeesTotal, total };
    }, [reportData.content]);

    return (
        <div ref={ref} style={{ flex: 1, overflow: 'auto', background: '#f5f5f5' }}>
            {/* 语言切换按钮 */}
            <LanguageSwitcher currentLanguage={language} onLanguageChange={onLanguageChange} />
            
            <div id="repair-report-preview-content" style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 60, borderRadius: 8, boxShadow: 'var(--glass-shadow-lg)', color: '#333', fontSize: 13 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid #333', paddingBottom: 20 }}>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#333' }}>{t.title}</h1>
                    {t.subtitle && <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#666' }}>{t.subtitle}</p>}
                </div>

                {/* Report Info Header */}
                <div style={{ marginBottom: 30, padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e0e0e0' }}>
                        <div style={{ display: 'flex', gap: 32 }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#888' }}>{t.reportNumber}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{reportData.report_number || 'DRAFT'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#888' }}>{t.serviceType}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: reportData.service_type === 'warranty' ? '#38a169' : '#d69e2e' }}>
                                    {reportData.service_type === 'warranty' ? t.warranty : t.outOfWarranty}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888' }}>{t.reportDate}</div>
                            <div style={{ fontSize: 13 }}>{new Date().toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language)}</div>
                            {(reportData.prepared_by || reportData.created_by) && (
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                                    {t.preparedBy}: {reportData.prepared_by?.display_name || reportData.created_by?.display_name}
                                </div>
                            )}
                        </div>
                    </div>
                    {ticketInfo && (
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 10, color: '#888' }}>{t.ticketDate}</div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                    {reportData.ticket_created_date 
                                        ? new Date(reportData.ticket_created_date).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                        : ticketInfo.created_at 
                                            ? new Date(ticketInfo.created_at).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                            : '-'}
                                </div>
                            </div>
                            <div style={{ width: 1, background: '#e0e0e0' }} />
                            <div>
                                <div style={{ fontSize: 10, color: '#888' }}>{t.receivedDate}</div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                    {reportData.received_date 
                                        ? new Date(reportData.received_date).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                        : ticketInfo.received_date 
                                            ? new Date(ticketInfo.received_date).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                            : ticketInfo.returned_date 
                                                ? new Date(ticketInfo.returned_date).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                                : '-'}
                                </div>
                            </div>
                            <div style={{ width: 1, background: '#e0e0e0' }} />
                            <div>
                                <div style={{ fontSize: 10, color: '#888' }}>{t.diagnosisDate}</div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                    {reportData.diagnosis_date 
                                        ? new Date(reportData.diagnosis_date).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                        : ticketInfo.repair_started_at 
                                            ? new Date(ticketInfo.repair_started_at).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                            : '-'}
                                </div>
                            </div>
                            <div style={{ width: 1, background: '#e0e0e0' }} />
                            <div>
                                <div style={{ fontSize: 10, color: '#888' }}>{t.completionDate}</div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                    {reportData.repair_date 
                                        ? new Date(reportData.repair_date).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                        : ticketInfo.repair_completed_at 
                                            ? new Date(ticketInfo.repair_completed_at).toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language) 
                                            : new Date().toLocaleDateString(language === 'original' || language === 'zh-CN' ? 'zh-CN' : language)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 1. 客户信息 */}
                <SectionPreview title={t.section1}>
                    {/* 客户名称单独一行 */}
                    <div style={{ marginBottom: 12 }}>
                        <InfoRow label={t.customerName} value={ticketInfo?.customer_name || ticketInfo?.account_name || '-'} />
                    </div>
                    {/* 其他信息一行 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <InfoRow label={t.contact} value={ticketInfo?.contact_name || '-'} />
                        <InfoRow label={t.phone} value={ticketInfo?.contact_phone || '-'} />
                        <InfoRow label={t.email} value={ticketInfo?.contact_email || '-'} />
                    </div>
                </SectionPreview>

                {/* 2. 设备信息 */}
                <SectionPreview title={t.section2}>
                    {/* 产品型号单独一行 */}
                    <div style={{ marginBottom: 12 }}>
                        <InfoRow 
                            label={t.productModel} 
                            value={(language !== 'original' && language !== 'zh-CN' && reportData.content.device_info.product_name_en) 
                                ? reportData.content.device_info.product_name_en 
                                : reportData.content.device_info.product_name} 
                        />
                    </div>
                    {/* 其他信息一行 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <InfoRow label={t.serialNumber} value={reportData.content.device_info.serial_number} />
                        <InfoRow label={t.firmwareVersion} value={reportData.content.device_info.firmware_version} />
                    </div>
                </SectionPreview>

                {/* 3. 问题描述 */}
                <SectionPreview title={t.section3}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{t.customerReported}:</div>
                        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, fontStyle: 'italic', fontSize: 13 }}>
                            {reportData.content.issue_description.customer_reported 
                                ? renderTranslatedContent('issue_description.customer_reported', reportData.content.issue_description.customer_reported)
                                : t.notProvided}
                        </div>
                    </div>
                </SectionPreview>

                {/* 4. 技术诊断 */}
                <SectionPreview title={t.section4}>
                    <InfoBlock label={t.findings} value={renderTranslatedContent('diagnosis.findings', reportData.content.diagnosis.findings)} />
                    <InfoBlock label={t.rootCause} value={renderTranslatedContent('diagnosis.root_cause', reportData.content.diagnosis.root_cause)} />
                    {reportData.content.diagnosis.troubleshooting_steps && (
                        <div>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{t.troubleshootingSteps}:</div>
                            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                {renderTranslatedContent('diagnosis.troubleshooting_steps', reportData.content.diagnosis.troubleshooting_steps)}
                            </div>
                        </div>
                    )}
                </SectionPreview>

                {/* 5. 维修过程 */}
                <SectionPreview title={t.section5}>
                    {reportData.content.repair_process.actions_taken && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{t.actionsTaken}:</div>
                            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                {renderTranslatedContent('repair_process.actions_taken', reportData.content.repair_process.actions_taken)}
                            </div>
                        </div>
                    )}
                    <InfoBlock label={t.testingResults} value={renderTranslatedContent('repair_process.testing_results', reportData.content.repair_process.testing_results)} />
                </SectionPreview>

                {/* 6. 费用明细表 */}
                <SectionPreview title={t.section6}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                        <thead>
                            <tr style={{ background: '#f0f0f0' }}>
                                <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ccc', fontSize: 12 }}>{t.item}</th>
                                <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ccc', fontSize: 12 }}>{t.spec}</th>
                                <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ccc', fontSize: 12 }}>{t.quantity}</th>
                                <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #ccc', fontSize: 12 }}>{t.unitPrice}</th>
                                <th style={{ padding: 10, textAlign: 'right', borderBottom: '2px solid #ccc', fontSize: 12 }}>{t.subtotal}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(reportData.content?.repair_process?.parts_replaced || []).map((part: PartUsed, i: number) => {
                                const displayName = (language !== 'zh-CN' && language !== 'original' && part.part_number && partNamesEnBySku[part.part_number])
                                    ? partNamesEnBySku[part.part_number]
                                    : part.name;
                                return (
                                    <tr key={`part-${i}`}>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{t.part}: {displayName}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{part.part_number || '-'}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>{part.quantity}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'right' }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(part.unit_price || 0).toFixed(2)}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{((part.quantity || 1) * (part.unit_price || 0)).toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                            {(reportData.content?.labor_charges || []).map((charge: LaborCharge, i: number) => {
                                const isNonChinese = language !== 'zh-CN' && language !== 'original';
                                const laborDesc = isNonChinese ? (charge.description_en || charge.description) : charge.description;
                                return (
                                    <tr key={`labor-${i}`}>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{t.labor}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>{laborDesc}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>{charge.hours}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'right' }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(charge.rate || 0).toFixed(2)}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(charge.total || 0).toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                            {(reportData.content?.other_fees || []).map((fee: OtherFee, i: number) => {
                                const isNonChinese = language !== 'zh-CN' && language !== 'original';
                                const feeDesc = isNonChinese ? (fee.description_en || fee.description || 'Unnamed Fee') : (fee.description || '未命名费用');
                                return (
                                    <tr key={`fee-${i}`}>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{t.other}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>{feeDesc}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'center' }}>1</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'right' }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(fee.amount || 0).toFixed(2)}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(fee.amount || 0).toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                            {(!reportData.content?.repair_process?.parts_replaced?.length && !reportData.content?.labor_charges?.length && !reportData.content?.other_fees?.length) && (
                                <tr>
                                    <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#a0aec0' }}>{t.noFees}</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#fafafa' }}>
                                <td colSpan={3} style={{ padding: 10 }}></td>
                                <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#666' }}>{t.partsSubtotal}:</td>
                                <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(totals.partsTotal || 0).toFixed(2)}</td>
                            </tr>
                            <tr style={{ background: '#fafafa' }}>
                                <td colSpan={3} style={{ padding: 10 }}></td>
                                <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#666' }}>{t.laborSubtotal}:</td>
                                <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(totals.laborTotal || 0).toFixed(2)}</td>
                            </tr>
                            {totals.otherFeesTotal > 0 && (
                                <tr style={{ background: '#fafafa' }}>
                                    <td colSpan={3} style={{ padding: 10 }}></td>
                                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: '#666' }}>{t.otherFees}:</td>
                                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(totals.otherFeesTotal || 0).toFixed(2)}</td>
                                </tr>
                            )}
                            <tr style={{ background: '#ffffff', borderTop: '2px solid #333' }}>
                                <td colSpan={3} style={{ padding: 12 }}></td>
                                <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#333', fontSize: 14 }}>{t.totalAmount}:</td>
                                <td style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#333', fontSize: 14 }}>{reportData.currency === 'USD' ? 'US $' : reportData.currency === 'EUR' ? '€' : '¥'}{Number(totals.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                    {reportData.service_type === 'warranty' && (
                        <div style={{ fontSize: 12, color: '#38a169', fontStyle: 'italic', textAlign: 'right' }}>
                            {t.warrantyNote}
                        </div>
                    )}
                </SectionPreview>

                {/* Footer - 包含保修条款 */}
                <div style={{ marginTop: 40, paddingTop: 20, borderTop: '2px solid #e0e0e0' }}>
                    <div style={{ padding: 14, background: '#f5f5f5', borderRadius: 8, border: '1px solid #ddd', marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>
                            {t.repairWarranty}: {reportData.content.warranty_terms.repair_warranty_days} {t.days}
                        </div>
                        <div style={{ fontSize: 12, color: '#4a5568' }}>
                            {t.warrantyExclusions}
                        </div>
                        <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, fontSize: 12, color: '#4a5568' }}>
                            {reportData.content.warranty_terms.exclusions.map((e: string, i: number) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 12, color: '#a0aec0' }}>{t.footer}</p>
                        <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>{t.footerContact}</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

// Fee Sub-section Component with collapsible functionality
const FeeSubSection: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    subtotal: number; 
    currency?: string;
    defaultOpen?: boolean; 
    children: React.ReactNode 
}> = ({ title, icon, subtotal, currency = 'CNY', defaultOpen = true, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div style={{ marginBottom: 12, border: '1px solid var(--glass-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: 'var(--glass-bg-light)', cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isOpen ? <ChevronDown size={16} color="#888" /> : <ChevronUp size={16} color="#888" />}
                    <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>{title}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>小计 {currency === 'USD' ? 'US $' : currency === 'EUR' ? '€' : '¥'}{Number(subtotal || 0).toFixed(2)}</span>
            </div>
            {isOpen && (
                <div style={{ padding: 12 }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const SectionPreview: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#333', borderBottom: '2px solid #e0e0e0', paddingBottom: 6, marginBottom: 12 }}>{title}</h3>
        {children}
    </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <span style={{ fontSize: 12, color: '#666' }}>{label}: </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{value || '-'}</span>
    </div>
);

const InfoBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}:</div>
        <div style={{ padding: 10, background: '#f5f5f5', borderRadius: 6, lineHeight: 1.5, fontSize: 13 }}>
            {value || <span style={{ color: '#999', fontStyle: 'italic' }}>[未提供]</span>}
        </div>
    </div>
);

// Translation textarea with auto-resize
const TranslationTextarea: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    hasTranslation: boolean;
}> = ({ value, onChange, placeholder, hasTranslation }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.max(36, textareaRef.current.scrollHeight) + 'px';
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                width: '100%', 
                minHeight: 36, 
                padding: 10,
                borderRadius: 6, 
                background: 'var(--glass-bg-hover)',
                border: `1px solid ${hasTranslation ? 'var(--glass-border)' : 'var(--glass-border-subtle, var(--glass-border))'}`,
                color: 'var(--text-main)',
                fontSize: 12, 
                lineHeight: 1.5,
                resize: 'none', 
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                overflow: 'hidden'
            }}
        />
    );
};

// Inline Translation Panel Component
const InlineTranslationPanel: React.FC<{
    fieldKey: string;
    originalText: string;
    translations: Record<string, Record<string, any>>;
    activeLang: string;
    onActiveLangChange: (lang: string) => void;
    translatingFields: Set<string>;
    onAITranslate: (fieldKey: string, lang: string, text: string, currentEditValue?: string) => void;
    onSaveTranslation: (fieldKey: string, lang: string, text: string, isManual: boolean) => void;
    defaultExpanded?: boolean;
    isExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
}> = ({
    fieldKey,
    originalText,
    translations,
    activeLang,
    onActiveLangChange,
    translatingFields,
    onAITranslate,
    onSaveTranslation,
    defaultExpanded = false,
    isExpanded: controlledIsExpanded,
    onExpandedChange
}) => {
    const [internalIsExpanded, setInternalIsExpanded] = useState(defaultExpanded);
    const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;
    const setIsExpanded = (value: boolean) => {
        if (onExpandedChange) {
            onExpandedChange(value);
        } else {
            setInternalIsExpanded(value);
        }
    };
    // Direct editing: textarea value is synced with current translation
    const [editValue, setEditValue] = useState('');
    // Track if this is the initial mount
    const isInitialMount = useRef(true);

    const SUPPORTED_LANGUAGES = [
        { code: 'en-US', label: 'English', flag: '🇺🇸' },
        { code: 'ja-JP', label: '日本語', flag: '🇯🇵' },
        { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' }
    ];

    const getTranslationStatus = (langCode: string) => {
        const hasTranslation = translations[langCode]?.[fieldKey];
        const isManual = translations[langCode]?._meta?.is_manual_edit;
        
        if (!hasTranslation) return { status: 'none', icon: null };
        if (isManual) return { status: 'manual', icon: <Check size={10} style={{ color: '#10B981' }} /> };
        return { status: 'ai', icon: <Sparkles size={10} style={{ color: '#3B82F6' }} /> };
    };

    const currentTranslation = translations[activeLang]?.[fieldKey] || '';
    const isTranslating = translatingFields.has(`${fieldKey}-${activeLang}`);
    // Track if user has manually edited to prevent AI translation from overwriting
    const hasUserEdited = useRef(false);

    // Sync editValue when translation changes (from AI) or on initial mount
    // But don't overwrite if user has manually edited and translation is from AI
    useEffect(() => {
        const isManualTranslation = translations[activeLang]?._meta?.is_manual_edit;
        // Update if: initial mount, or translation is manual, or user hasn't edited yet
        if (isInitialMount.current || isManualTranslation || !hasUserEdited.current) {
            setEditValue(currentTranslation);
            if (isInitialMount.current) {
                isInitialMount.current = false;
            }
        }
    }, [currentTranslation]);

    // Update editValue when language changes (always update on language switch)
    useEffect(() => {
        if (!isInitialMount.current) {
            setEditValue(currentTranslation);
            hasUserEdited.current = false; // Reset user edit flag on language change
        }
    }, [activeLang]);

    // Auto-save when user edits the textarea (debounced)
    useEffect(() => {
        if (editValue !== currentTranslation && editValue !== '') {
            hasUserEdited.current = true; // Mark as user edited
            const timer = setTimeout(() => {
                onSaveTranslation(fieldKey, activeLang, editValue, true);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [editValue, currentTranslation, fieldKey, activeLang, onSaveTranslation]);

    const translatedCount = SUPPORTED_LANGUAGES.filter(lang => 
        translations[lang.code]?.[fieldKey]
    ).length;

    if (!originalText.trim()) return null;

    return (
        <div style={{ marginTop: 8 }}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: translatedCount > 0 ? '#10B981' : 'var(--text-tertiary)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: 0
                }}
            >
                <Globe size={12} />
                <span>
                    {translatedCount > 0 
                        ? `已翻译 ${translatedCount}/${SUPPORTED_LANGUAGES.length} 种语言` 
                        : '🌐 翻译此字段'}
                </span>
                <ChevronDown 
                    size={12} 
                    style={{ 
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                    }} 
                />
            </button>

            {/* Expanded Panel */}
            {isExpanded && (
                <div style={{
                    marginTop: 10, padding: 12,
                    background: 'var(--glass-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--glass-border)'
                }}>
                    {/* Language Tabs */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {SUPPORTED_LANGUAGES.map(lang => {
                            const status = getTranslationStatus(lang.code);
                            return (
                                <button
                                    key={lang.code}
                                    onClick={() => onActiveLangChange(lang.code)}
                                    style={{
                                        padding: '6px 10px', borderRadius: 6,
                                        background: activeLang === lang.code ? 'rgba(255,215,0,0.15)' : 'transparent',
                                        border: `1px solid ${activeLang === lang.code ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                        color: activeLang === lang.code ? '#FFD200' : 'var(--text-secondary)',
                                        fontSize: 11, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 4
                                    }}
                                >
                                    <span>{lang.flag}</span>
                                    <span>{lang.label}</span>
                                    {status.icon}
                                </button>
                            );
                        })}
                    </div>

                    {/* Translation Content */}
                    <div>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginBottom: 6
                        }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                {SUPPORTED_LANGUAGES.find(l => l.code === activeLang)?.label} 译文
                            </span>
                            
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={() => onAITranslate(fieldKey, activeLang, originalText, editValue)}
                                    disabled={isTranslating}
                                    style={{
                                        padding: '4px 10px', borderRadius: 4,
                                        background: 'rgba(59,130,246,0.15)',
                                        border: '1px solid rgba(59,130,246,0.3)',
                                        color: '#3B82F6', fontSize: 11,
                                        cursor: isTranslating ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        opacity: isTranslating ? 0.6 : 1
                                    }}
                                >
                                    <Sparkles size={10} />
                                    {isTranslating ? '翻译中...' : (editValue.trim() ? '再Bokeh一次' : 'Bokeh翻译')}
                                </button>
                            </div>
                        </div>

                        {/* Direct editable textarea - auto resize */}
                        <TranslationTextarea
                            value={editValue}
                            onChange={setEditValue}
                            placeholder="暂无译文，点击右侧按钮生成"
                            hasTranslation={!!currentTranslation}
                        />
                        {editValue !== currentTranslation && (
                            <div style={{ fontSize: 10, color: '#10B981', marginTop: 4, textAlign: 'right' }}>
                                已修改，自动保存中...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
