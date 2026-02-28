/**
 * RestockOrderCreatePage
 * 创建补货订单页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/useLanguage';
import axios from 'axios';
import { 
    ArrowLeft, Plus, Minus, Trash2, Package, 
    Loader2, AlertTriangle, ShoppingCart
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface PartsCatalogItem {
    id: number;
    part_number: string;
    part_name: string;
    category: string;
    dealer_price: number;
    retail_price: number;
    stock_level: number;
}

interface CartItem {
    part_id: number;
    part_number: string;
    part_name: string;
    quantity: number;
    unit_price: number;
}

interface InventoryItem {
    part: { id: number; number: string; name: string; category: string };
    quantity: number;
    reorder_point: number;
    is_low_stock: boolean;
}

const RestockOrderCreatePage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { token } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [partsCatalog, setPartsCatalog] = useState<PartsCatalogItem[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [shippingAddress, _setShippingAddress] = useState('');  // eslint-disable-line @typescript-eslint/no-unused-vars
    const [dealerNotes, setDealerNotes] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [partsRes, inventoryRes] = await Promise.all([
                axios.get('/api/v1/parts', { headers, params: { page_size: 500 } }),
                axios.get('/api/v1/dealer-inventory', { headers, params: { page_size: 500 } })
            ]);
            
            if (partsRes.data?.success) {
                setPartsCatalog(partsRes.data.data);
            }
            if (inventoryRes.data?.success) {
                setInventory(inventoryRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (part: PartsCatalogItem) => {
        const existing = cart.find(item => item.part_id === part.id);
        if (existing) {
            setCart(cart.map(item => 
                item.part_id === part.id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                part_id: part.id,
                part_number: part.part_number,
                part_name: part.part_name,
                quantity: 1,
                unit_price: part.dealer_price
            }]);
        }
    };

    const updateQuantity = (partId: number, delta: number) => {
        setCart(cart.map(item => {
            if (item.part_id === partId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (partId: number) => {
        setCart(cart.filter(item => item.part_id !== partId));
    };

    const getInventoryInfo = (partId: number) => {
        return inventory.find(inv => inv.part.id === partId);
    };

    const totalAmount = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    const handleSubmit = async () => {
        if (cart.length === 0) {
            alert(t('restock.cart_empty') || '请先添加配件');
            return;
        }

        setSubmitting(true);
        try {
            const res = await axios.post('/api/v1/dealer-inventory/restock-orders', {
                items: cart.map(item => ({
                    part_id: item.part_id,
                    quantity: item.quantity
                })),
                shipping_address: shippingAddress || null,
                dealer_notes: dealerNotes || null
            }, { headers });

            if (res.data?.success) {
                navigate(`/service/inventory/restock/${res.data.data.id}`);
            }
        } catch (err: any) {
            console.error('Failed to create order:', err);
            alert(err.response?.data?.error?.message || t('common.operationFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    // 筛选配件
    const filteredParts = partsCatalog.filter(part => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return part.part_name.toLowerCase().includes(term) ||
               part.part_number.toLowerCase().includes(term);
    });

    // 按类别分组
    const categories = [...new Set(filteredParts.map(p => p.category))].filter(Boolean);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 100 }}>
                <Loader2 size={32} className="animate-spin" style={{ opacity: 0.5 }} />
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
            {/* 返回按钮 */}
            <button
                onClick={() => navigate('/service/inventory/restock')}
                className="btn-glass"
                style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
            >
                <ArrowLeft size={16} />
                {t('common.back') || '返回'}
            </button>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 32 }}>
                {t('restock.create') || '创建补货订单'}
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32 }}>
                {/* 左侧：配件选择 */}
                <div>
                    {/* 搜索框 */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'var(--glass-bg-light)',
                        padding: '12px 20px',
                        borderRadius: 30,
                        marginBottom: 24
                    }}>
                        <Package size={18} style={{ opacity: 0.5 }} />
                        <input
                            type="text"
                            placeholder={t('restock.search_parts') || '搜索配件...'}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-main)',
                                width: '100%',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    {/* 配件列表 */}
                    {categories.map(category => (
                        <div key={category} style={{ marginBottom: 24 }}>
                            <h3 style={{ 
                                fontSize: '0.85rem', 
                                fontWeight: 600, 
                                color: 'var(--text-secondary)',
                                marginBottom: 12,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {category}
                            </h3>
                            <div style={{
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 16,
                                border: '1px solid var(--glass-border)',
                                overflow: 'hidden'
                            }}>
                                {filteredParts.filter(p => p.category === category).map((part, idx) => {
                                    const invInfo = getInventoryInfo(part.id);
                                    const inCart = cart.find(c => c.part_id === part.id);
                                    
                                    return (
                                        <div
                                            key={part.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '14px 20px',
                                                borderTop: idx > 0 ? '1px solid var(--glass-border)' : undefined
                                            }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontWeight: 500 }}>{part.part_name}</span>
                                                    {invInfo?.is_low_stock && (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            padding: '2px 8px',
                                                            background: 'rgba(255, 193, 7, 0.2)',
                                                            color: '#FFC107',
                                                            borderRadius: 10,
                                                            fontSize: '0.7rem'
                                                        }}>
                                                            <AlertTriangle size={10} />
                                                            低库存
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    {part.part_number}
                                                    {invInfo && (
                                                        <span style={{ marginLeft: 12 }}>
                                                            当前库存: {invInfo.quantity}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ 
                                                fontWeight: 500, 
                                                marginRight: 20,
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {formatPrice(part.dealer_price)}
                                            </div>
                                            {inCart ? (
                                                <span style={{
                                                    padding: '6px 12px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10B981',
                                                    borderRadius: 20,
                                                    fontSize: '0.8rem'
                                                }}>
                                                    已添加 ×{inCart.quantity}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => addToCart(part)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        padding: '6px 12px',
                                                        background: 'rgba(255, 215, 0, 0.15)',
                                                        color: '#FFD700',
                                                        border: 'none',
                                                        borderRadius: 20,
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    <Plus size={14} />
                                                    添加
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 右侧：购物车 */}
                <div style={{ position: 'sticky', top: 32, alignSelf: 'start' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 20,
                        border: '1px solid var(--glass-border)',
                        overflow: 'hidden'
                    }}>
                        {/* 购物车头部 */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <ShoppingCart size={20} style={{ color: '#FFD700' }} />
                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                                {t('restock.cart') || '补货清单'}
                            </span>
                            <span style={{
                                marginLeft: 'auto',
                                padding: '4px 10px',
                                background: 'rgba(255, 215, 0, 0.15)',
                                color: '#FFD700',
                                borderRadius: 12,
                                fontSize: '0.8rem'
                            }}>
                                {cart.length} 项
                            </span>
                        </div>

                        {/* 购物车内容 */}
                        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                            {cart.length === 0 ? (
                                <div style={{ 
                                    padding: 40, 
                                    textAlign: 'center',
                                    color: 'var(--text-secondary)'
                                }}>
                                    <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                                    <p>{t('restock.cart_empty_hint') || '点击左侧配件添加到补货清单'}</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div
                                        key={item.part_id}
                                        style={{
                                            padding: '16px 24px',
                                            borderBottom: '1px solid var(--glass-border)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{item.part_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    {formatPrice(item.unit_price)} / 个
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.part_id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    padding: 4
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <button
                                                onClick={() => updateQuantity(item.part_id, -1)}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    border: '1px solid var(--glass-border)',
                                                    background: 'var(--glass-bg-light)',
                                                    color: 'var(--text-main)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span style={{ fontWeight: 600, minWidth: 30, textAlign: 'center' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.part_id, 1)}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    border: '1px solid var(--glass-border)',
                                                    background: 'var(--glass-bg-light)',
                                                    color: 'var(--text-main)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <span style={{ marginLeft: 'auto', fontWeight: 500 }}>
                                                {formatPrice(item.unit_price * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 备注 */}
                        {cart.length > 0 && (
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)' }}>
                                <textarea
                                    placeholder={t('restock.notes_placeholder') || '备注（可选）'}
                                    value={dealerNotes}
                                    onChange={e => setDealerNotes(e.target.value)}
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        background: 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 12,
                                        color: 'var(--text-main)',
                                        resize: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                        )}

                        {/* 总计和提交 */}
                        {cart.length > 0 && (
                            <div style={{ 
                                padding: '20px 24px',
                                background: 'rgba(255, 215, 0, 0.05)',
                                borderTop: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    marginBottom: 16
                                }}>
                                    <span className="hint">{t('restock.total_amount') || '合计'}</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFD700' }}>
                                        {formatPrice(totalAmount)}
                                    </span>
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || cart.length === 0}
                                    className="btn-primary"
                                    style={{
                                        width: '100%',
                                        padding: '14px 24px',
                                        fontSize: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    {submitting ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <ShoppingCart size={18} />
                                    )}
                                    {t('restock.create_order') || '创建订单'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestockOrderCreatePage;
