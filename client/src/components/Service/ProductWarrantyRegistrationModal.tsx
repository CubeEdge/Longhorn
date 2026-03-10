import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, AlertTriangle, Save, Loader2, Upload, FileText, Box, Building, User, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface ProductWarrantyRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    serialNumber: string;
    productName?: string;
    onRegistered: () => void;
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
}

interface Dealer {
    id: number;
    name: string;
}

interface Customer {
    id: number;
    name: string;
}

interface ProductCatalog {
    id: number;
    name: string;
    product_family?: string;
    type?: string;
}

export const ProductWarrantyRegistrationModal: React.FC<ProductWarrantyRegistrationModalProps> = ({
    isOpen,
    onClose,
    serialNumber,
    productName,
    onRegistered
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [, setFetchingProduct] = useState(false);
    const [saleSource, setSaleSource] = useState<'invoice' | 'customer_statement' | ''>('');
    const [saleDate, setSaleDate] = useState('');
    const [warrantyMonths, setWarrantyMonths] = useState(24);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [invoiceFileName, setInvoiceFileName] = useState('');
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Product info from database
    const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedDealerId, setSelectedDealerId] = useState<number | ''>('');
    const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');

    // Product catalog selection
    const [productCatalogs, setProductCatalogs] = useState<ProductCatalog[]>([]);
    const [selectedProductCatalogId, setSelectedProductCatalogId] = useState<number | ''>('');
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    // Customer search
    const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
    const [searchingOwners, setSearchingOwners] = useState(false);
    const ownerDropdownRef = useRef<HTMLDivElement>(null);

    // Fetch product details and reference data when modal opens
    useEffect(() => {
        if (isOpen && serialNumber) {
            fetchProductDetails();
            fetchReferenceData();
            fetchProductCatalogs();
        }
    }, [isOpen, serialNumber]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
                setShowProductDropdown(false);
            }
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
                    setCustomers(accountsData.map((acc: any) => ({
                        id: acc.id,
                        name: acc.name
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
                    ship_to_dealer_date: data.warranty_info?.ship_to_dealer_date
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
            const res = await axios.get('/api/v1/system/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProductCatalogs(res.data.data || []);
                // Pre-select if productName matches
                if (productName) {
                    const matched = res.data.data.find((p: any) => 
                        p.name.toLowerCase() === productName.toLowerCase()
                    );
                    if (matched) {
                        setSelectedProductCatalogId(matched.id);
                        setProductSearchQuery(matched.name);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch product catalogs:', err);
        }
    };

    const fetchReferenceData = async () => {
        try {
            // Fetch dealers
            const dealersRes = await axios.get('/api/v1/accounts?account_type=DEALER&page_size=100', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (dealersRes.data.success) {
                const accountsData = Array.isArray(dealersRes.data.data)
                    ? dealersRes.data.data
                    : (dealersRes.data.data.list || []);
                setDealers(accountsData.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name
                })));
            }

            // Fetch customers (end users and organizations)
            const customersRes = await axios.get('/api/v1/accounts?account_type=END_USER,ORGANIZATION&page_size=100', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (customersRes.data.success) {
                const accountsData = Array.isArray(customersRes.data.data)
                    ? customersRes.data.data
                    : (customersRes.data.data.list || []);
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
        if (!selectedProductCatalogId) {
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

        setLoading(true);
        setError(null);

        try {
            // Step 0: Ensure product exists in Installed Base
            // If product not found by serial number, create it first
            let productId = productInfo?.id;
            if (!productId) {
                // Create product in Installed Base
                const selectedCatalog = productCatalogs.find(p => p.id === selectedProductCatalogId);
                const createRes = await axios.post('/api/v1/admin/products', {
                    model_name: selectedCatalog?.name || productSearchQuery || 'Unknown Model',
                    serial_number: serialNumber,
                    product_sku: selectedCatalog?.product_family || '',
                    status: 'ACTIVE',
                    sales_channel: selectedDealerId ? 'DEALER' : 'DIRECT',
                    sold_to_dealer_id: selectedDealerId || null,
                    current_owner_id: selectedOwnerId || null
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (createRes.data.success) {
                    productId = createRes.data.data.id;
                } else {
                    throw new Error(createRes.data.error?.message || '创建产品记录失败');
                }
            }

            // Step 1: Upload invoice file if provided
            let invoiceProofUrl = '';
            if (invoiceFile) {
                const formData = new FormData();
                formData.append('file', invoiceFile);
                formData.append('type', 'warranty_invoice');

                const uploadRes = await axios.post('/api/v1/upload', formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (uploadRes.data.success) {
                    invoiceProofUrl = uploadRes.data.data.url;
                }
            }

            // Step 2: Register warranty with all fields
            const res = await axios.post('/api/v1/products/register-warranty', {
                serial_number: serialNumber,
                sale_source: saleSource,
                sale_date: saleDate,
                warranty_months: warrantyMonths,
                sales_invoice_proof: invoiceProofUrl,
                remarks: remarks,
                sold_to_dealer_id: selectedDealerId || null,
                current_owner_id: selectedOwnerId || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                onRegistered();
            } else {
                setError(res.data.error || '注册失败');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 560, maxHeight: '90vh', background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(245,158,11,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(245,158,11,0.2)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <AlertTriangle size={20} color="#F59E0B" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                                产品保修注册
                            </h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4, letterSpacing: '-0.01em' }}>
                                该产品尚未注册保修信息
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {/* Product Info Section */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8,
                        marginBottom: 20, border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            产品信息
                        </div>

                        {/* Serial Number */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 4, letterSpacing: '-0.01em' }}>序列号</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: 'monospace', letterSpacing: '-0.01em' }}>
                                {serialNumber}
                            </div>
                        </div>

                        {/* Product Model - Selectable */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                产品型号 <span style={{ color: '#EF4444' }}>*</span>
                            </div>
                            <div ref={productDropdownRef} style={{ position: 'relative' }}>
                                <Box size={16} style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: '#666', pointerEvents: 'none'
                                }} />
                                <input
                                    type="text"
                                    value={productSearchQuery}
                                    onChange={(e) => {
                                        setProductSearchQuery(e.target.value);
                                        setShowProductDropdown(true);
                                        // Filter catalogs based on search
                                        if (e.target.value) {
                                            const matched = productCatalogs.find(p => 
                                                p.name.toLowerCase() === e.target.value.toLowerCase()
                                            );
                                            if (matched) {
                                                setSelectedProductCatalogId(matched.id);
                                            } else {
                                                setSelectedProductCatalogId('');
                                            }
                                        }
                                    }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    placeholder="搜索并选择产品型号..."
                                    style={{
                                        width: '100%', padding: '10px 12px', paddingLeft: 36, paddingRight: 32,
                                        background: 'rgba(0,0,0,0.3)', border: `1px solid ${selectedProductCatalogId ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                />
                                <ChevronDown size={16} style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: '#666', pointerEvents: 'none'
                                }} />
                                
                                {/* Product Dropdown */}
                                {showProductDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                                        background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        maxHeight: 200, overflowY: 'auto', zIndex: 100
                                    }}>
                                        {productCatalogs
                                            .filter(p => !productSearchQuery || 
                                                p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                                (p.product_family && p.product_family.toLowerCase().includes(productSearchQuery.toLowerCase()))
                                            )
                                            .map((product) => (
                                            <div
                                                key={product.id}
                                                onClick={() => {
                                                    setSelectedProductCatalogId(product.id);
                                                    setProductSearchQuery(product.name);
                                                    setShowProductDropdown(false);
                                                }}
                                                style={{
                                                    padding: '10px 12px', cursor: 'pointer',
                                                    background: selectedProductCatalogId === product.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (selectedProductCatalogId !== product.id) {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (selectedProductCatalogId !== product.id) {
                                                        e.currentTarget.style.background = 'transparent';
                                                    }
                                                }}
                                            >
                                                <div style={{ fontSize: 13, color: '#fff' }}>{product.name}</div>
                                                {product.product_family && (
                                                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                                        {product.product_family}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {productCatalogs.filter(p => !productSearchQuery || 
                                            p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                                        ).length === 0 && (
                                            <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
                                                无匹配产品
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!selectedProductCatalogId && productSearchQuery && (
                                <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
                                    请从列表中选择一个有效的产品型号
                                </div>
                            )}
                        </div>

                        {/* Product SKU */}
                        {productInfo?.product_sku && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, letterSpacing: '-0.01em' }}>SKU</div>
                                <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', letterSpacing: '-0.01em' }}>
                                    {productInfo.product_sku}
                                </div>
                            </div>
                        )}

                        {/* Sales Channel */}
                        {productInfo?.sales_channel && (
                            <div>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, letterSpacing: '-0.01em' }}>销售渠道</div>
                                <div style={{ fontSize: 12, color: '#888', letterSpacing: '-0.01em' }}>
                                    {productInfo.sales_channel === 'DIRECT' ? '直销' : '经销商'}
                                    {productInfo.ship_to_dealer_date && (
                                        <span style={{ color: '#666', marginLeft: 8 }}>
                                            (发货日期: {productInfo.ship_to_dealer_date})
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ownership Section */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 11, color: '#aaa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            归属信息
                        </label>

                        {/* Dealer Selection */}
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                销售经销商
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Building size={16} style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: '#666', pointerEvents: 'none'
                                }} />
                                <select
                                    value={selectedDealerId}
                                    onChange={(e) => setSelectedDealerId(e.target.value ? parseInt(e.target.value) : '')}
                                    style={{
                                        width: '100%', padding: '10px 12px', paddingLeft: 36,
                                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="">请选择经销商（可选）</option>
                                    {dealers.map((dealer) => (
                                        <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Owner Selection - Searchable */}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                当前所有者
                            </label>
                            <div ref={ownerDropdownRef} style={{ position: 'relative' }}>
                                <User size={16} style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: '#666', pointerEvents: 'none', zIndex: 1
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
                                            // Trigger search if we have text but no results
                                            setSearchingOwners(true);
                                        }
                                    }}
                                    placeholder="输入客户名称搜索..."
                                    style={{
                                        width: '100%', padding: '10px 12px', paddingLeft: 36, paddingRight: 32,
                                        background: 'rgba(0,0,0,0.3)', border: `1px solid ${selectedOwnerId ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none'
                                    }}
                                />
                                {searchingOwners && (
                                    <Loader2 size={14} className="animate-spin" style={{
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
                                            background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                                            padding: 0, display: 'flex', alignItems: 'center'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                                
                                {/* Owner Dropdown */}
                                {showOwnerDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                                        background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        maxHeight: 200, overflowY: 'auto', zIndex: 100
                                    }}>
                                        {!ownerSearchQuery && (
                                            <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
                                                输入客户名称开始搜索
                                            </div>
                                        )}
                                        {ownerSearchQuery && customers.length === 0 && !searchingOwners && (
                                            <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
                                                未找到匹配的客户
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
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (selectedOwnerId !== customer.id) {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (selectedOwnerId !== customer.id) {
                                                        e.currentTarget.style.background = 'transparent';
                                                    }
                                                }}
                                            >
                                                <div style={{ fontSize: 13, color: '#fff' }}>{customer.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                输入客户名称搜索，或留空不指定
                            </div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div style={{
                        background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)',
                        borderRadius: 8, padding: 12, marginBottom: 20
                    }}>
                        <div style={{ fontSize: 12, color: '#FFD700', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
                            <strong>需要注册保修信息</strong><br />
                            该产品在系统中没有保修依据（IoT激活/发票/注册记录）。
                            请录入销售日期以计算保修期，否则无法创建RMA工单。
                        </div>
                    </div>

                    {/* Sale Source Selection */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8, letterSpacing: '-0.01em' }}>
                            销售日期来源 <span style={{ color: '#EF4444' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                type="button"
                                onClick={() => setSaleSource('invoice')}
                                style={{
                                    flex: 1, padding: '12px 16px', borderRadius: 8,
                                    border: `1px solid ${saleSource === 'invoice' ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                                    background: saleSource === 'invoice' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                                    color: saleSource === 'invoice' ? '#3B82F6' : '#fff',
                                    cursor: 'pointer', fontSize: 13, letterSpacing: '-0.01em'
                                }}
                            >
                                有发票
                            </button>
                            <button
                                type="button"
                                onClick={() => setSaleSource('customer_statement')}
                                style={{
                                    flex: 1, padding: '12px 16px', borderRadius: 8,
                                    border: `1px solid ${saleSource === 'customer_statement' ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                                    background: saleSource === 'customer_statement' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                                    color: saleSource === 'customer_statement' ? '#3B82F6' : '#fff',
                                    cursor: 'pointer', fontSize: 13, letterSpacing: '-0.01em'
                                }}
                            >
                                客户陈述
                            </button>
                        </div>
                    </div>

                    {/* Sale Date */}
                    {saleSource && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                {saleSource === 'invoice' ? '发票日期' : '销售日期'}
                                <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px', paddingLeft: 40,
                                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', letterSpacing: '-0.01em'
                                    }}
                                />
                                <Calendar size={16} style={{
                                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                                    color: '#666', pointerEvents: 'none'
                                }} />
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginTop: 6, letterSpacing: '-0.01em' }}>
                                {saleSource === 'invoice'
                                    ? '以发票日期作为保修起始日（优先级2）'
                                    : '以客户陈述的销售日期作为保修起始日（优先级3）'}
                            </div>
                        </div>
                    )}

                    {/* Invoice Upload - Only show when invoice source selected */}
                    {saleSource === 'invoice' && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8, letterSpacing: '-0.01em' }}>
                                发票凭证 <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <div
                                onClick={() => document.getElementById('invoice-upload')?.click()}
                                style={{
                                    border: `1px dashed ${invoiceFile ? '#10B981' : 'rgba(255,255,255,0.2)'}`,
                                    borderRadius: 8, padding: 16,
                                    background: invoiceFile ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
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
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <FileText size={20} color="#10B981" />
                                        <span style={{ color: '#10B981', fontSize: 13, letterSpacing: '-0.01em' }}>{invoiceFileName}</span>
                                    </div>
                                ) : (
                                    <div>
                                        <Upload size={24} color="#666" style={{ marginBottom: 8 }} />
                                        <div style={{ fontSize: 13, color: '#888', letterSpacing: '-0.01em' }}>点击上传发票图片或PDF</div>
                                        <div style={{ fontSize: 11, color: '#666', marginTop: 4, letterSpacing: '-0.01em' }}>支持 JPG、PNG、PDF，最大 5MB</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Warranty Months */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8, letterSpacing: '-0.01em' }}>
                            保修期时长
                        </label>
                        <select
                            value={warrantyMonths}
                            onChange={(e) => setWarrantyMonths(parseInt(e.target.value))}
                            style={{
                                width: '100%', padding: '10px 12px',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', letterSpacing: '-0.01em'
                            }}
                        >
                            <option value={12}>12 个月</option>
                            <option value={24}>24 个月（标准）</option>
                            <option value={36}>36 个月</option>
                        </select>
                    </div>

                    {/* Remarks */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 8, letterSpacing: '-0.01em' }}>
                            备注
                        </label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="特殊情况说明（可选）"
                            rows={2}
                            style={{
                                width: '100%', padding: '10px 12px',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                                resize: 'vertical', letterSpacing: '-0.01em'
                            }}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 8, padding: 12, color: '#EF4444', fontSize: 12, letterSpacing: '-0.01em'
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'flex-end', gap: 12,
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '10px 20px', background: 'transparent', border: 'none',
                            color: '#888', cursor: 'pointer', borderRadius: 8,
                            fontSize: 13, letterSpacing: '-0.01em'
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !selectedProductCatalogId || !saleSource || !saleDate || (saleSource === 'invoice' && !invoiceFile)}
                        style={{
                            padding: '10px 24px', background: '#3B82F6', border: 'none',
                            color: '#fff', borderRadius: 8, fontWeight: 600,
                            cursor: loading || !selectedProductCatalogId || !saleSource || !saleDate || (saleSource === 'invoice' && !invoiceFile) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            opacity: loading || !selectedProductCatalogId || !saleSource || !saleDate || (saleSource === 'invoice' && !invoiceFile) ? 0.7 : 1,
                            fontSize: 13, letterSpacing: '-0.01em'
                        }}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        保存并继续
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductWarrantyRegistrationModal;
