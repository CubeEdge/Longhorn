import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Save, Loader2, Upload, FileText, Box, Building, User, ChevronDown, Plus } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomDatePicker } from '../UI/CustomDatePicker';
import UnifiedCustomerModal from './UnifiedCustomerModal';

// 保修数据结构（用于暂存传递给父组件）
export interface WarrantyRegistrationData {
    saleSource: 'invoice' | 'customer_statement' | 'shipping_record';
    saleDate: string;
    warrantyMonths: number;
    invoiceFile?: File;
    invoiceFileName?: string;
    remarks?: string;
    // 发货记录信息
    shippingRecordInfo?: string;
    // 客户陈述信息
    customerStatementInfo?: string;
    selectedDealerId?: number | '';
    selectedOwnerId?: number | '';
    selectedModelName: string;
    selectedSkuId?: number | '';
    selectedProductLine: 'Camera' | 'EVF' | 'Accessory';
    selectedProductFamily: 'A' | 'B' | 'C' | 'D' | 'E';
}

interface ProductWarrantyRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    serialNumber: string;
    productName?: string;
    isNewProduct?: boolean;  // true = 产品入库, false = 仅注册保修
    // 回调：isNewProduct=true 时传递 WarrantyRegistrationData，否则传递 productId
    onRegistered: (result: number | WarrantyRegistrationData | undefined) => void;
    // 从ProductModal传入的预填字段
    prefillData?: {
        productLine?: 'Camera' | 'EVF' | 'Accessory';
        productFamily?: 'A' | 'B' | 'C' | 'D' | 'E';
        skuId?: number;
        salesChannel?: 'DIRECT' | 'DEALER';
    };
    // 更改模式：预加载已有保修数据
    existingWarrantyData?: {
        saleSource?: 'invoice' | 'customer_statement' | 'shipping_record';
        saleDate?: string;
        warrantyMonths?: number;
        dealerId?: number;
        ownerId?: number;
        shippingRecordInfo?: string;
        customerStatementInfo?: string;
    };
}

interface ProductInfo {
    id: number;
    model_name: string;
    serial_number: string;
    product_sku?: string;
    product_type?: string;
    sales_channel?: string;
    sold_to_dealer_id?: number;
    sold_to_dealer_name?: string;
    current_owner_id?: number;
    current_owner_name?: string;
    ship_to_dealer_date?: string;
    production_date?: string;
}

interface Dealer {
    id: number;
    name: string;
}

interface Customer {
    id: number;
    name: string;
    email?: string;
    primary_contact_name?: string;
    primary_contact_email?: string;
    country?: string;
}

interface ProductModel {
    id: number;
    name_zh: string;
    model_code: string;
    sn_prefix?: string;
    product_type?: string;
    product_family?: string;
}

interface ProductSku {
    id: number;
    model_id: number;
    sku_code: string;
    display_name: string;
}

export const ProductWarrantyRegistrationModal: React.FC<ProductWarrantyRegistrationModalProps> = ({
    isOpen,
    onClose,
    serialNumber,
    productName,
    isNewProduct = false,  // 默认为仅注册保修
    onRegistered,
    prefillData,
    existingWarrantyData
}) => {
    const isModifyMode = !!existingWarrantyData;
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [, setFetchingProduct] = useState(false);
    const [saleSource, setSaleSource] = useState<'invoice' | 'customer_statement' | 'shipping_record' | ''>('');
    const [shippingRecordInfo, setShippingRecordInfo] = useState('');
    const [customerStatementInfo, setCustomerStatementInfo] = useState('');
    const [saleDate, setSaleDate] = useState('');
    const [warrantyMonths, setWarrantyMonths] = useState(24);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [invoiceFileName, setInvoiceFileName] = useState('');
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Product info from database
    const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedDealerId, setSelectedDealerId] = useState<number | ''>('');
    const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');

    // Product catalog selection
    // Product models and SKUs
    const [models, setModels] = useState<ProductModel[]>([]);
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [selectedModelName, setSelectedModelName] = useState('');
    const [selectedSkuId, setSelectedSkuId] = useState<number | ''>('');
    const [, setProductDropdownSettings] = useState<any>(null);
    
    // Product line and family (for creating new products)
    const [selectedProductLine, setSelectedProductLine] = useState<'Camera' | 'EVF' | 'Accessory'>('Camera');
    const [selectedProductFamily, setSelectedProductFamily] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

    // Customer search
    const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
    const [searchingOwners, setSearchingOwners] = useState(false);
    const ownerDropdownRef = useRef<HTMLDivElement>(null);
    
    // Add customer modal
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

    // Fetch product details and reference data when modal opens
    useEffect(() => {
        if (isOpen && serialNumber) {
            fetchProductDetails();
            fetchReferenceData();
            fetchProductCatalogs();
            // 更改模式：预加载已有保修数据
            if (existingWarrantyData) {
                if (existingWarrantyData.saleSource) setSaleSource(existingWarrantyData.saleSource);
                if (existingWarrantyData.saleDate) setSaleDate(existingWarrantyData.saleDate);
                if (existingWarrantyData.warrantyMonths) setWarrantyMonths(existingWarrantyData.warrantyMonths);
                if (existingWarrantyData.dealerId) setSelectedDealerId(existingWarrantyData.dealerId);
                if (existingWarrantyData.ownerId) setSelectedOwnerId(existingWarrantyData.ownerId);
                if (existingWarrantyData.shippingRecordInfo) setShippingRecordInfo(existingWarrantyData.shippingRecordInfo);
                if (existingWarrantyData.customerStatementInfo) setCustomerStatementInfo(existingWarrantyData.customerStatementInfo);
            }
        }
    }, [isOpen, serialNumber]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
                setShowOwnerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search owners when query changes
    useEffect(() => {
        const searchOwners = async () => {
            if (!ownerSearchQuery.trim()) {
                setCustomers([]);
                return;
            }
            setSearchingOwners(true);
            try {
                const res = await axios.get(`/api/v1/accounts?search=${encodeURIComponent(ownerSearchQuery)}&account_type=END_USER,ORGANIZATION&page_size=20`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const accountsData = Array.isArray(res.data.data)
                        ? res.data.data
                        : (res.data.data.list || []);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setCustomers(accountsData.map((acc: any) => ({
                        id: acc.id,
                        name: acc.name,
                        email: acc.email,
                        primary_contact_name: acc.primary_contact_name,
                        primary_contact_email: acc.primary_contact_email,
                        country: acc.country
                    })));
                }
            } catch (err) {
                console.error('Failed to search owners:', err);
            } finally {
                setSearchingOwners(false);
            }
        };

        const timer = setTimeout(searchOwners, 300);
        return () => clearTimeout(timer);
    }, [ownerSearchQuery, token]);

    const fetchProductDetails = async () => {
        setFetchingProduct(true);
        try {
            const res = await axios.get(`/api/v1/products/check-warranty?serial_number=${serialNumber}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success && res.data.data.found) {
                const data = res.data.data;
                setProductInfo({
                    id: data.product.id,
                    model_name: data.product.model_name,
                    serial_number: data.product.serial_number,
                    product_sku: data.product.product_sku,
                    product_type: data.product.product_type,
                    sales_channel: data.warranty_info?.sales_channel,
                    sold_to_dealer_id: data.warranty_info?.sold_to_dealer_id,
                    sold_to_dealer_name: data.warranty_info?.sold_to_dealer_name,
                    current_owner_id: data.warranty_info?.current_owner_id,
                    current_owner_name: data.warranty_info?.current_owner_name,
                    ship_to_dealer_date: data.warranty_info?.ship_to_dealer_date,
                    production_date: data.product.production_date
                });

                // Pre-select dealer and owner if already associated
                if (data.warranty_info?.sold_to_dealer_id) {
                    setSelectedDealerId(data.warranty_info.sold_to_dealer_id);
                }
                if (data.warranty_info?.current_owner_id) {
                    setSelectedOwnerId(data.warranty_info.current_owner_id);
                }

                // Set default warranty months from product
                if (data.warranty_info?.warranty_months) {
                    setWarrantyMonths(data.warranty_info.warranty_months);
                }
            }
        } catch (err) {
            console.error('Failed to fetch product details:', err);
        } finally {
            setFetchingProduct(false);
        }
    };

    const fetchProductCatalogs = async () => {
        try {
            const [modelsRes, skusRes, settingsRes] = await Promise.all([
                axios.get('/api/v1/admin/product-models', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/admin/product-skus', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/system/public-settings', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            
            // 保存系统设置
            if (settingsRes.data.success) {
                setProductDropdownSettings(settingsRes.data.data.product_dropdown);
            }
            
            if (modelsRes.data.success) {
                let modelsData = modelsRes.data.data || [];
                
                // SN前缀自动匹配产品型号（用于判断是否有SN输入）
                const snInput = serialNumber.trim().toUpperCase();
                
                // 应用系统设置过滤（SN为空时）
                if (snInput.length === 0 && settingsRes.data.success) {
                    const settings = settingsRes.data.data.product_dropdown;
                    if (settings) {
                        const familyVisibility = settings.family_visibility || { A: true, B: false, C: true, D: true, E: false };
                        const enableTypeFilter = settings.enable_type_filter !== false;
                        const allowedTypes = settings.allowed_types || ['电影机', '摄像机', '电子寻像器', '寻像器', '套装'];
                        
                        modelsData = modelsData.filter((p: ProductModel) => {
                            // 必须是启用的族群
                            if (!familyVisibility[p.product_family as keyof typeof familyVisibility]) return false;
                            
                            // 必须有 sn_prefix
                            if (!p.sn_prefix) return false;
                            
                            // 检查产品类型过滤
                            if (enableTypeFilter) {
                                const productType = (p.product_type || '').toLowerCase();
                                const matchesType = allowedTypes.some((type: string) => 
                                    productType.includes(type.toLowerCase())
                                );
                                if (!matchesType) return false;
                            }
                            
                            return true;
                        });
                    }
                }
                
                setModels(modelsData);
                
                // SN前缀自动匹配产品型号
                const matchedByPrefix = modelsData.filter((p: ProductModel) => 
                    p.sn_prefix && (
                        p.sn_prefix.toUpperCase() === snInput ||  // 精确匹配
                        snInput.startsWith(p.sn_prefix.toUpperCase())  // 输入以产品前缀开头
                    )
                );
                
                if (matchedByPrefix.length === 1) {
                    // 只有一个精确匹配，自动选择产品型号并填充产品线和族群
                    const matched = matchedByPrefix[0];
                    setSelectedModelName(matched.name_zh);
                    
                    // 自动填充产品线和族群
                    if (matched.product_type) {
                        const line = mapProductTypeToLine(matched.product_type);
                        if (line) setSelectedProductLine(line);
                    }
                    if (matched.product_family) {
                        setSelectedProductFamily(matched.product_family as 'A' | 'B' | 'C' | 'D' | 'E');
                    }
                } else if (productName) {
                    // 通过productName匹配（原有逻辑）
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const matched = modelsData.find((p: any) =>
                        p.name_zh.toLowerCase() === productName.toLowerCase() ||
                        p.model_code.toLowerCase() === productName.toLowerCase() ||
                        productName.toLowerCase().includes(p.name_zh.toLowerCase())
                    );
                    if (matched) {
                        setSelectedModelName(matched.name_zh);
                        // 自动填充产品线和族群
                        if (matched.product_type) {
                            const line = mapProductTypeToLine(matched.product_type);
                            if (line) setSelectedProductLine(line);
                        }
                        if (matched.product_family) {
                            setSelectedProductFamily(matched.product_family as 'A' | 'B' | 'C' | 'D' | 'E');
                        }
                    }
                }
            }
            if (skusRes.data.success) {
                setSkus(skusRes.data.data || []);
            }

            // 应用从ProductModal传入的预填数据（优先级低于SN前缀匹配）
            if (prefillData) {
                if (prefillData.productLine && !selectedProductLine) {
                    setSelectedProductLine(prefillData.productLine);
                }
                if (prefillData.productFamily && !selectedProductFamily) {
                    setSelectedProductFamily(prefillData.productFamily);
                }
                if (prefillData.skuId) {
                    setSelectedSkuId(prefillData.skuId);
                }
            }
        } catch (err) {
            console.error('Failed to fetch product models/skus:', err);
        }
    };
    
    // 辅助函数：将product_type映射到产品线
    const mapProductTypeToLine = (productType: string): 'Camera' | 'EVF' | 'Accessory' | null => {
        if (productType.includes('电影机') || productType.includes('摄像机')) return 'Camera';
        if (productType.includes('寻像器')) return 'EVF';
        return 'Accessory';
    };


    const fetchReferenceData = async () => {
        try {
            // Fetch dealers
            const dealersRes = await axios.get('/api/v1/accounts?account_type=DEALER&page_size=100', {
                headers: { Authorization: `Bearer ${token} ` }
            });
            if (dealersRes.data.success) {
                const accountsData = Array.isArray(dealersRes.data.data)
                    ? dealersRes.data.data
                    : (dealersRes.data.data.list || []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setDealers(accountsData.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name
                })));
            }

            // Fetch customers (end users and organizations)
            const customersRes = await axios.get('/api/v1/accounts?account_type=END_USER,ORGANIZATION&page_size=100', {
                headers: { Authorization: `Bearer ${token} ` }
            });
            if (customersRes.data.success) {
                const accountsData = Array.isArray(customersRes.data.data)
                    ? customersRes.data.data
                    : (customersRes.data.data.list || []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setCustomers(accountsData.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name
                })));
            }
        } catch (err) {
            console.error('Failed to fetch reference data:', err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type and size
            const allowedTypes = ['image/jpeg', 'image/png', 'image/pdf', 'application/pdf'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!allowedTypes.includes(file.type)) {
                setError('仅支持 JPG、PNG、PDF 格式文件');
                return;
            }
            if (file.size > maxSize) {
                setError('文件大小不能超过 5MB');
                return;
            }

            setInvoiceFile(file);
            setInvoiceFileName(file.name);
            setError(null);
        }
    };

    const handleSubmit = async () => {
        if (!selectedModelName) {
            setError('请选择产品型号');
            return;
        }
        if (!saleSource) {
            setError('请选择销售日期来源');
            return;
        }
        if (!saleDate) {
            setError('请输入销售日期');
            return;
        }
        if (saleSource === 'invoice' && !invoiceFile) {
            setError('请上传发票凭证');
            return;
        }
        if (saleSource === 'shipping_record' && !shippingRecordInfo.trim()) {
            setError('请输入发货记录信息');
            return;
        }
        if (saleSource === 'customer_statement' && !customerStatementInfo.trim()) {
            setError('请输入客户陈述信息');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // ======== 方案B核心逻辑 ========
            // isNewProduct=true 时：产品未入库，暂存数据传给父组件，不直接调用API
            // isNewProduct=false 时：产品已入库，直接调用API保存保修信息
            
            if (isNewProduct) {
                // 场景C：产品未入库 - 暂存数据，由父组件（ProductModal）统一提交
                const warrantyData: WarrantyRegistrationData = {
                    saleSource: saleSource as 'invoice' | 'customer_statement' | 'shipping_record',
                    saleDate,
                    warrantyMonths,
                    invoiceFile: invoiceFile || undefined,
                    invoiceFileName: invoiceFileName || undefined,
                    remarks,
                    shippingRecordInfo: saleSource === 'shipping_record' ? shippingRecordInfo : undefined,
                    customerStatementInfo: saleSource === 'customer_statement' ? customerStatementInfo : undefined,
                    selectedDealerId,
                    selectedOwnerId,
                    selectedModelName,
                    selectedSkuId,
                    selectedProductLine,
                    selectedProductFamily
                };
                
                setIsSuccess(true);
                setTimeout(() => {
                    setIsSuccess(false);
                    onRegistered(warrantyData);  // 传递保修数据对象给父组件
                }, 1500);
                return;
            }

            // 场景B：产品已入库 - 直接调用API保存
            // Step 1: Upload invoice file if provided
            let invoiceProofUrl = '';
            if (invoiceFile) {
                const formData = new FormData();
                formData.append('file', invoiceFile);
                formData.append('type', 'warranty_invoice');

                const uploadRes = await axios.post('/api/v1/upload', formData, {
                    headers: {
                        Authorization: `Bearer ${token} `,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (uploadRes.data.success) {
                    invoiceProofUrl = uploadRes.data.data.url;
                }
            }

            // Step 2: Register warranty with all fields
            const selectedSku = skus.find(s => s.id === selectedSkuId);
            const res = await axios.post('/api/v1/products/register-warranty', {
                serial_number: serialNumber,
                model_name: selectedModelName,
                product_sku: selectedSku ? selectedSku.sku_code : '',
                sku_id: selectedSkuId || undefined,
                product_line: selectedProductLine,
                product_family: selectedProductFamily,
                sale_source: saleSource,
                sale_date: saleDate,
                warranty_months: warrantyMonths,
                sales_invoice_proof: invoiceProofUrl,
                remarks: remarks,
                shipping_record_info: saleSource === 'shipping_record' ? shippingRecordInfo : null,
                customer_statement_info: saleSource === 'customer_statement' ? customerStatementInfo : null,
                sold_to_dealer_id: selectedDealerId || null,
                current_owner_id: selectedOwnerId || null
            }, {
                headers: { Authorization: `Bearer ${token} ` }
            });

            if (res.data.success) {
                const productId = res.data.data?.product_id;
                setIsSuccess(true);
                setTimeout(() => {
                    setIsSuccess(false);
                    onRegistered(productId);  // 传递 product_id 给调用方
                }, 1500);
            } else {
                const errData = res.data.error;
                const errorMsg = typeof errData === 'string' ? errData : (errData?.message || '注册失败');
                setError(errorMsg);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            // 防御性提取错误信息：防止返回对象导致 React 崩溃（黑屏原因）
            const errData = err.response?.data?.error;
            let errorMsg = '网络错误或无权限执行此操作';
            if (typeof errData === 'string') {
                errorMsg = errData;
            } else if (errData?.message) {
                errorMsg = errData.message;
            } else if (err.message) {
                errorMsg = err.message;
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 900, maxHeight: '90vh', background: 'var(--modal-bg)', borderRadius: '24px',
                border: '1px solid var(--modal-border)', overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
                display: 'flex', flexDirection: 'column', animation: 'modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--glass-bg-light)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: 'rgba(245,158,11,0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <AlertTriangle size={24} color="#f59e0b" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                                {isModifyMode ? '更改保修信息' : (isNewProduct ? '产品入库并注册保修' : '产品保修注册')}
                            </h3>
                            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, letterSpacing: '-0.01em' }}>
                                {isModifyMode ? '请修改保修注册信息，更改将被记录' : (isNewProduct ? '请完善产品信息和保修资料' : '请完善保修注册信息')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 8 }}>
                        <X size={24} />
                    </button>
                </div>

                {isSuccess ? (
                    <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: 24, borderRadius: '50%', marginBottom: 16 }}>
                            <Save size={48} />
                        </div>
                        <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 24, fontWeight: 700 }}>注册成功</h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>保修信息已验证并记录，即将进入工单...</p>
                    </div>
                ) : (
                    <>
                        {/* Body - Two Column Layout */}
                        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {/* Left Column - Warranty Info Only */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                {/* Ownership Info - 销售经销商和当前所有者 */}
                                <div style={{
                                    background: 'var(--glass-bg-light)', padding: 20, borderRadius: 12,
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        归属信息
                                    </div>

                                    {/* Dealer Selection */}
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                            销售经销商
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Building size={16} style={{
                                                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                                                color: 'var(--text-tertiary)', pointerEvents: 'none'
                                            }} />
                                            <select
                                                value={selectedDealerId}
                                                onChange={(e) => setSelectedDealerId(e.target.value ? parseInt(e.target.value) : '')}
                                                style={{
                                                    width: '100%', height: 44, padding: '0 16px', paddingLeft: 42,
                                                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                                    borderRadius: 10, color: 'var(--text-main)', fontSize: 14, outline: 'none',
                                                    cursor: 'pointer', appearance: 'none'
                                                }}
                                            >
                                                <option value="">请选择经销商（可选）</option>
                                                {dealers.map((dealer) => (
                                                    <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    {/* Owner Selection - Searchable */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                            当前所有者
                                        </label>
                                        <div ref={ownerDropdownRef} style={{ position: 'relative' }}>
                                            <User size={18} style={{
                                                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                                                color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1
                                            }} />
                                            <input
                                                type="text"
                                                value={ownerSearchQuery}
                                                onChange={(e) => {
                                                    setOwnerSearchQuery(e.target.value);
                                                    setShowOwnerDropdown(true);
                                                    if (!e.target.value) {
                                                        setSelectedOwnerId('');
                                                    }
                                                }}
                                                onFocus={() => {
                                                    setShowOwnerDropdown(true);
                                                    if (ownerSearchQuery && customers.length === 0) {
                                                        setSearchingOwners(true);
                                                    }
                                                }}
                                                placeholder="输入客户名称关键词搜索..."
                                                style={{
                                                    width: '100%', height: 44, padding: '0 16px', paddingLeft: 44, paddingRight: 40,
                                                    background: 'var(--glass-bg)', border: `1px solid ${selectedOwnerId ? 'rgba(16,185,129,0.5)' : 'var(--glass-border)'} `,
                                                    borderRadius: 10, color: 'var(--text-main)', fontSize: 14, outline: 'none'
                                                }}
                                            />
                                            {searchingOwners && (
                                                <Loader2 size={16} className="animate-spin" style={{
                                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                                    color: '#3B82F6'
                                                }} />
                                            )}
                                            {!searchingOwners && selectedOwnerId && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedOwnerId('');
                                                        setOwnerSearchQuery('');
                                                    }}
                                                    style={{
                                                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                                        background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
                                                        padding: 0, display: 'flex', alignItems: 'center'
                                                    }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}

                                            {/* Owner Dropdown */}
                                            {showOwnerDropdown && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                                                    background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                                                    borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                                    maxHeight: 200, overflowY: 'auto', zIndex: 100
                                                }}>
                                                    {!ownerSearchQuery && (
                                                        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                                                            输入客户名称开始搜索
                                                        </div>
                                                    )}
                                                    {ownerSearchQuery && customers.length === 0 && !searchingOwners && (
                                                        <div style={{ padding: 12, textAlign: 'center' }}>
                                                            <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 8 }}>
                                                                未找到匹配的客户
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setShowOwnerDropdown(false);
                                                                    setShowAddCustomerModal(true);
                                                                }}
                                                                className="btn-kine-lowkey"
                                                                style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                    padding: '6px 12px',
                                                                    borderRadius: 6,
                                                                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Plus size={14} />
                                                                新建客户
                                                            </button>
                                                        </div>
                                                    )}
                                                    {customers.map((customer) => (
                                                        <div
                                                            key={customer.id}
                                                            onClick={() => {
                                                                setSelectedOwnerId(customer.id);
                                                                setOwnerSearchQuery(customer.name);
                                                                setShowOwnerDropdown(false);
                                                            }}
                                                            style={{
                                                                padding: '10px 12px', cursor: 'pointer',
                                                                background: selectedOwnerId === customer.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                                display: 'flex', flexDirection: 'column', gap: 4
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (selectedOwnerId !== customer.id) {
                                                                    e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (selectedOwnerId !== customer.id) {
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>{customer.name}</div>
                                                            {(customer.primary_contact_name || customer.email || customer.country) && (
                                                                <div style={{
                                                                    fontSize: 11, color: 'var(--text-tertiary)',
                                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                                }}>
                                                                    {customer.primary_contact_name ? `联系人: ${customer.primary_contact_name} ` : ''}
                                                                    {customer.email ? `| 邮箱: ${customer.email} ` : (customer.primary_contact_email ? ` | 联系人邮箱: ${customer.primary_contact_email} ` : '')}
                                                                    {customer.country ? `| 地区: ${customer.country} ` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Warranty Registration Info Card */}
                                <div style={{
                                    background: 'var(--glass-bg-light)', padding: 20, borderRadius: 12,
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        保修注册信息
                                    </div>

                                    {/* Sale Source Selection */}
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '-0.01em' }}>
                                            销售日期来源 <span style={{ color: '#EF4444' }}>*</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                            <button
                                                type="button"
                                                onClick={() => setSaleSource('invoice')}
                                                style={{
                                                    flex: 1, height: 44, borderRadius: 10,
                                                    border: `2px solid ${saleSource === 'invoice' ? '#3B82F6' : 'var(--glass-border)'} `,
                                                    background: saleSource === 'invoice' ? 'rgba(59,130,246,0.1)' : 'var(--glass-bg)',
                                                    color: saleSource === 'invoice' ? '#3B82F6' : 'var(--text-main)',
                                                    cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                有发票
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSaleSource('shipping_record')}
                                                style={{
                                                    flex: 1, height: 44, borderRadius: 10,
                                                    border: `2px solid ${saleSource === 'shipping_record' ? '#3B82F6' : 'var(--glass-border)'} `,
                                                    background: saleSource === 'shipping_record' ? 'rgba(59,130,246,0.1)' : 'var(--glass-bg)',
                                                    color: saleSource === 'shipping_record' ? '#3B82F6' : 'var(--text-main)',
                                                    cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                发货记录
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSaleSource('customer_statement')}
                                                style={{
                                                    flex: 1, height: 44, borderRadius: 10,
                                                    border: `2px solid ${saleSource === 'customer_statement' ? '#3B82F6' : 'var(--glass-border)'} `,
                                                    background: saleSource === 'customer_statement' ? 'rgba(59,130,246,0.1)' : 'var(--glass-bg)',
                                                    color: saleSource === 'customer_statement' ? '#3B82F6' : 'var(--text-main)',
                                                    cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                客户陈述
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sale Date & Warranty Months */}
                                    {saleSource && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div>
                                                    <CustomDatePicker
                                                        value={saleDate}
                                                        onChange={setSaleDate}
                                                        label={`${saleSource === 'invoice' ? '发票日期' : saleSource === 'shipping_record' ? '发货日期' : '销售日期'} *`}
                                                        minDate={productInfo?.production_date}
                                                        maxDate={format(new Date(), 'yyyy-MM-dd')}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                        保修期时长
                                                    </label>
                                                    <select
                                                        value={warrantyMonths}
                                                        onChange={(e) => setWarrantyMonths(parseInt(e.target.value))}
                                                        style={{
                                                            width: '100%', height: 44, padding: '0 10px',
                                                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                                            borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none'
                                                        }}
                                                    >
                                                        <option value={12}>12 个月</option>
                                                        <option value={24}>24 个月（标准）</option>
                                                        <option value={36}>36 个月</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Invoice Upload */}
                                            {saleSource === 'invoice' && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                        发票凭证 <span style={{ color: '#EF4444' }}>*</span>
                                                    </label>
                                                    <div
                                                        onClick={() => document.getElementById('invoice-upload')?.click()}
                                                        style={{
                                                            border: `1px dashed ${invoiceFile ? '#10B981' : 'var(--glass-border)'} `,
                                                            borderRadius: 8, padding: 12,
                                                            background: invoiceFile ? 'rgba(16,185,129,0.05)' : 'var(--glass-bg)',
                                                            cursor: 'pointer', textAlign: 'center'
                                                        }}
                                                    >
                                                        <input
                                                            id="invoice-upload"
                                                            type="file"
                                                            accept=".jpg,.jpeg,.png,.pdf"
                                                            onChange={handleFileChange}
                                                            style={{ display: 'none' }}
                                                        />
                                                        {invoiceFile ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                                <FileText size={16} color="#10B981" />
                                                                <span style={{ color: '#10B981', fontSize: 12 }}>{invoiceFileName}</span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                                <Upload size={16} color="var(--text-tertiary)" />
                                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>点击上传发票 (JPG/PNG/PDF, 最大5MB)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Shipping Record Info */}
                                            {saleSource === 'shipping_record' && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                        发货记录信息 <span style={{ color: '#EF4444' }}>*</span>
                                                    </label>
                                                    <textarea
                                                        value={shippingRecordInfo}
                                                        onChange={(e) => setShippingRecordInfo(e.target.value)}
                                                        placeholder="请输入发货记录的相关信息，如发货单号、发货日期、收货方等..."
                                                        style={{
                                                            width: '100%', minHeight: 80, padding: 10,
                                                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                                            borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                                                            resize: 'vertical', fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {/* Customer Statement Info */}
                                            {saleSource === 'customer_statement' && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                        客户陈述信息 <span style={{ color: '#EF4444' }}>*</span>
                                                    </label>
                                                    <textarea
                                                        value={customerStatementInfo}
                                                        onChange={(e) => setCustomerStatementInfo(e.target.value)}
                                                        placeholder="请输入客户提供的重要陈述信息..."
                                                        style={{
                                                            width: '100%', minHeight: 80, padding: 10,
                                                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                                            borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                                                            resize: 'vertical', fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Error */}
                                {error && (
                                    <div style={{
                                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                        borderRadius: 8, padding: 10, color: '#EF4444', fontSize: 12
                                    }}>
                                        {error}
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Product Info & Ownership */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Product Info Section */}
                                <div style={{
                                    background: 'var(--glass-bg-light)', padding: 20, borderRadius: 12,
                                    border: '1px solid var(--glass-border)'
                                }}>


                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {/* Serial Number */}
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>序列号</div>
                                            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                                                {serialNumber}
                                            </div>
                                        </div>

                                        {/* Product Model */}
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                                产品型号 <span style={{ color: '#EF4444' }}>*</span>
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <Box size={18} style={{
                                                    position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                                                    color: 'var(--text-tertiary)', pointerEvents: 'none'
                                                }} />
                                                <select
                                                    value={selectedModelName}
                                                    onChange={(e) => {
                                                        const modelName = e.target.value;
                                                        setSelectedModelName(modelName);
                                                        setSelectedSkuId(''); // Reset SKU when model changes
                                                        
                                                        // 自动填充产品线和族群
                                                        const selectedModel = models.find(m => m.name_zh === modelName);
                                                        if (selectedModel) {
                                                            if (selectedModel.product_type) {
                                                                const line = mapProductTypeToLine(selectedModel.product_type);
                                                                if (line) setSelectedProductLine(line);
                                                            }
                                                            if (selectedModel.product_family) {
                                                                setSelectedProductFamily(selectedModel.product_family as 'A' | 'B' | 'C' | 'D' | 'E');
                                                            }
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%', height: 48, padding: '0 16px', paddingLeft: 44,
                                                        background: 'var(--glass-bg)', border: `1px solid ${selectedModelName ? 'rgba(16,185,129,0.5)' : 'var(--glass-border)'} `,
                                                        borderRadius: 10, color: 'var(--text-main)', fontSize: 14, outline: 'none',
                                                        cursor: 'pointer', appearance: 'none'
                                                    }}
                                                >
                                                    <option value="" disabled>请选择产品型号</option>
                                                    {models.map(m => (
                                                        <option key={m.id} value={m.name_zh}>{m.name_zh}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                            </div>
                                        </div>

                                        {/* Product SKU */}
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                                产品SKU <span style={{ color: '#EF4444' }}>*</span>
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    value={selectedSkuId || ''}
                                                    onChange={(e) => setSelectedSkuId(e.target.value ? parseInt(e.target.value) : '')}
                                                    disabled={!selectedModelName}
                                                    style={{
                                                        width: '100%', height: 48, padding: '0 16px',
                                                        background: 'var(--glass-bg)', border: `1px solid ${selectedSkuId ? 'rgba(16,185,129,0.5)' : 'var(--glass-border)'} `,
                                                        borderRadius: 10, color: 'var(--text-main)', fontSize: 14, outline: 'none',
                                                        cursor: 'pointer', appearance: 'none', opacity: !selectedModelName ? 0.5 : 1
                                                    }}
                                                >
                                                    <option value="">{selectedModelName ? '选择适用的 SKU' : '选定型号后可选'}</option>
                                                    {skus.filter(s => {
                                                        const model = models.find(m => m.name_zh === selectedModelName);
                                                        return model && s.model_id === model.id;
                                                    }).map(s => (
                                                        <option key={s.id} value={s.id}>{s.display_name} ({s.sku_code})</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                            </div>
                                        </div>

                                        {/* Product Line & Family - Side by Side */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                                    分类 <span style={{ color: '#EF4444' }}>*</span>
                                                </div>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        value={selectedProductLine}
                                                        onChange={(e) => setSelectedProductLine(e.target.value as 'Camera' | 'EVF' | 'Accessory')}
                                                        style={{
                                                            width: '100%', height: 48, padding: '0 12px',
                                                            background: 'var(--glass-bg)', border: '1px solid rgba(16,185,129,0.5)',
                                                            borderRadius: 10, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                                                            cursor: 'pointer', appearance: 'none'
                                                        }}
                                                    >
                                                        <option value="Camera">Camera（相机）</option>
                                                        <option value="EVF">EVF（电子寻像器）</option>
                                                        <option value="Accessory">Accessory（配件）</option>
                                                    </select>
                                                    <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                                    产品族群 <span style={{ color: '#EF4444' }}>*</span>
                                                </div>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        value={selectedProductFamily}
                                                        onChange={(e) => setSelectedProductFamily(e.target.value as 'A' | 'B' | 'C' | 'D' | 'E')}
                                                        style={{
                                                            width: '100%', height: 48, padding: '0 12px',
                                                            background: 'var(--glass-bg)', border: '1px solid rgba(16,185,129,0.5)',
                                                            borderRadius: 10, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                                                            cursor: 'pointer', appearance: 'none'
                                                        }}
                                                    >
                                                        <option value="A">A - 在售电影机</option>
                                                        <option value="B">B - 广播摄像机</option>
                                                        <option value="C">C - 电子寻像器</option>
                                                        <option value="D">D - 历史机型</option>
                                                        <option value="E">E - 通用配件</option>
                                                    </select>
                                                    <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Remarks - 备注放在左侧底部 */}
                                <div style={{
                                    background: 'var(--glass-bg-light)', padding: 20, borderRadius: 12,
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        备注
                                    </div>
                                    <textarea
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        placeholder="特殊情况说明（可选）"
                                        rows={3}
                                        style={{
                                            width: '100%', padding: '12px',
                                            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                            borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '20px 32px', borderTop: '1px solid var(--glass-border)',
                            display: 'flex', justifyContent: 'flex-end', gap: 16,
                            background: 'var(--glass-bg-light)'
                        }}>
                            <button
                                onClick={onClose}
                                disabled={loading}
                                style={{
                                    padding: '0 24px', height: 44, background: 'transparent', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-main)', cursor: 'pointer', borderRadius: 10, fontWeight: 600,
                                    fontSize: 14
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !selectedModelName || !saleSource || !saleDate || (saleSource === 'invoice' && !invoiceFile)}
                                style={{
                                    padding: '0 32px', height: 44, background: '#FFD200', border: 'none',
                                    color: '#000', borderRadius: 10, fontWeight: 700,
                                    cursor: loading || !selectedModelName || !saleSource || !saleDate || (saleSource === 'invoice' && !invoiceFile) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    opacity: loading || !selectedModelName || !saleSource || !saleDate || (saleSource === 'invoice' && !invoiceFile) ? 0.7 : 1,
                                    fontSize: 14, boxShadow: '0 4px 12px rgba(255,210,0,0.3)'
                                }}
                            >
                                {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                保存并继续
                            </button>
                        </div>
                    </>
                )}
            </div>
            <style>{`
@keyframes modalScaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
}
`}</style>
            
            {/* Add Customer Modal */}
            <UnifiedCustomerModal
                isOpen={showAddCustomerModal}
                onClose={() => setShowAddCustomerModal(false)}
                onSuccess={(accountId, accountName) => {
                    setSelectedOwnerId(accountId);
                    setOwnerSearchQuery(accountName);
                    setShowAddCustomerModal(false);
                    // Refresh customers list
                    setCustomers(prev => [...prev, { id: accountId, name: accountName }]);
                }}
                prefillData={{
                    name: ownerSearchQuery
                }}
                defaultMode="individual"
                defaultLifecycleStage="ACTIVE"
            />
        </div>
    );
};

export default ProductWarrantyRegistrationModal;
