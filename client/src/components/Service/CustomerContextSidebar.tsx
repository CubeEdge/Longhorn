import React, { useState, useEffect } from 'react';
import {
    User, Smartphone, History, Mail, Phone, MapPin
} from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';

interface CustomerContextSidebarProps {
    customerId?: number;
    customerName?: string;
    serialNumber?: string;
    onClose?: () => void;
}

const CustomerContextSidebar: React.FC<CustomerContextSidebarProps> = ({
    customerId, customerName, serialNumber
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'customer' | 'device'>('customer');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchContext();
    }, [customerId, customerName, serialNumber]);

    const fetchContext = async () => {
        setLoading(true);
        try {
            // Determine which API to call
            let url = '';
            if (activeTab === 'customer') {
                if (customerId) url = `/api/v1/context/by-customer?customer_id=${customerId}`;
                else if (customerName) url = `/api/v1/context/by-customer?customer_name=${encodeURIComponent(customerName)}`;
            } else {
                if (serialNumber) url = `/api/v1/context/by-serial-number?serial_number=${serialNumber}`;
            }

            if (!url) {
                // Fallback or specific logic if we don't have ID/Name but have SN, or vice versa
                if (serialNumber && activeTab === 'customer') {
                    // If we only have SN, we might want to switch tab or just fetch by SN to find owner?
                    // For now, let's just wait for user to switch tab
                    setLoading(false);
                    return;
                }
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            const json = await res.json();
            if (json.success) {
                setData(json.data);
            } else {
                // If 404, just clear data
                setData(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Switch tabs also triggers fetch if needed
    const handleTabChange = (tab: 'customer' | 'device') => {
        setActiveTab(tab);
        // Logic to ensure we have params for the other tab? 
        // Usually the parent passes all available info.
    };

    if (!customerId && !customerName && !serialNumber) return null;

    return (
        <div className="w-80 border-l border-white/10 bg-[#1A1A1A] flex flex-col h-full absolute right-0 top-0 z-20 shadow-xl">
            {/* Header */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#1A1A1A]/50 backdrop-blur-md">
                <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
                    <User className="w-4 h-4 text-kine-yellow" />
                    {t('customer_context.title')}
                </h3>

                {/* Tabs */}
                <div className="flex bg-black/20 rounded p-0.5">
                    <button
                        onClick={() => handleTabChange('customer')}
                        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${activeTab === 'customer'
                            ? 'bg-white/10 text-white font-medium'
                            : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        {t('customer_context.tab.customer')}
                    </button>
                    <button
                        onClick={() => handleTabChange('device')}
                        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${activeTab === 'device'
                            ? 'bg-white/10 text-white font-medium'
                            : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        {t('customer_context.tab.device')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <div className="w-6 h-6 border-2 border-white/10 border-t-kine-yellow rounded-full animate-spin" />
                    </div>
                ) : data ? (
                    <div className="p-4 space-y-6">

                        {/* Customer Profile Section */}
                        {activeTab === 'customer' && data.customer && (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-white">{data.customer.customer_name}</h2>
                                        {data.customer.company_name && (
                                            <div className="text-xs text-white/50 mt-0.5">{data.customer.company_name}</div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${data.customer.service_tier === 'VIP' || data.customer.service_tier === 'VVIP'
                                            ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                                            : 'border-white/20 text-white/60'
                                            }`}>
                                            {data.customer.account_type || data.customer.customer_type}
                                            {data.customer.service_tier && data.customer.service_tier !== 'STANDARD' && (
                                                <span className="ml-1 font-bold"> • {data.customer.service_tier}</span>
                                            )}
                                        </span>
                                        {data.customer.acquisition_channel && (
                                            <span className="text-[10px] text-white/30 border border-white/10 px-1.5 rounded">
                                                {data.customer.acquisition_channel}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs text-white/70">
                                    {data.customer.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 opacity-50" />
                                            <a href={`mailto:${data.customer.email}`} className="hover:text-blue-400 truncate">
                                                {data.customer.email}
                                            </a>
                                        </div>
                                    )}
                                    {data.customer.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 opacity-50" />
                                            <span>{data.customer.phone}</span>
                                        </div>
                                    )}
                                    {data.customer.city && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 opacity-50" />
                                            <span>{[data.customer.city, data.customer.country].filter(Boolean).join(', ')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Dealer Section */}
                                {data.dealer && (
                                    <div className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/10 space-y-2">
                                        <div className="text-[10px] tracking-wider text-blue-400 font-bold uppercase">
                                            {t('customer_context.label.associated_dealer')}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium text-white/90">{data.dealer.name}</div>
                                            <div className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                {data.dealer.dealer_type}
                                            </div>
                                        </div>
                                        <div className="text-xs text-white/50">{data.dealer.contact_email}</div>
                                    </div>
                                )}

                                {/* AI Profile / Tags */}
                                {data.ai_profile && (
                                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                        <div className="text-[10px] uppercase tracking-wider text-white/30 font-bold">INSIGHTS</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                                {data.ai_profile.activity_level} Activity
                                            </span>
                                            {data.ai_profile.tags?.map((tag: string, i: number) => (
                                                <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-white/70 border border-white/10">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        {data.ai_profile.notes && (
                                            <p className="text-xs text-white/50 leading-relaxed border-t border-white/5 pt-2 mt-2">
                                                {data.ai_profile.notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Owned Devices List */}
                        {activeTab === 'customer' && data.devices && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                                    <Smartphone className="w-3.5 h-3.5" />
                                    {t('customer_context.section.registered_products')} ({data.devices.length})
                                </h4>
                                <div className="space-y-2">
                                    {data.devices.map((device: any) => (
                                        <div key={device.id} className="p-2.5 rounded bg-white/5 border border-white/5 hover:border-white/20 transition-colors group cursor-pointer">
                                            <div className="flex items-center justify-between">
                                                <div className="font-medium text-white text-sm">{device.model_name}</div>
                                                <div className="text-[10px] text-white/40 font-mono">{device.serial_number}</div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                                                    {device.firmware_version}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-kine-yellow/10 text-kine-yellow/60 border border-kine-yellow/20">
                                                    Family {device.product_family}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {data.devices.length === 0 && (
                                        <div className="text-xs text-white/30 italic px-2">{t('customer_context.no_products')}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Device Info View */}
                        {activeTab === 'device' && data.device && (
                            <div className="space-y-6">
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <h2 className="text-lg font-bold text-white mb-1">{data.device.model_name}</h2>
                                    <div className="font-mono text-sm text-kine-yellow mb-3">{data.device.serial_number}</div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <div className="text-white/40 mb-0.5">{t('rma_ticket.field.firmware_version')}</div>
                                            <div className="text-white/80">{data.device.firmware_version}</div>
                                        </div>
                                        <div>
                                            <div className="text-white/40 mb-0.5">产品系列</div>
                                            <div className="text-white/80">{data.device.product_family || '-'}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-white/40 mb-0.5">{t('customer_context.label.warranty_status')}</div>
                                            <div className="text-green-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                在保 (至 2027)
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Ownership History */}
                                {data.ownership_history && data.ownership_history.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">{t('customer_context.device.history')}</h4>
                                        <div className="space-y-1">
                                            {data.ownership_history.map((owner: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 bg-white/[0.02] rounded">
                                                    <User className="w-3 h-3 text-white/30" />
                                                    <span className="text-white/70">{owner.name}</span>
                                                    <span className="text-[10px] text-white/20 ml-auto">{owner.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Parts Pricing */}
                                {data.parts_catalog && data.parts_catalog.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                                            {t('customer_context.label.parts_pricing')}
                                        </h4>
                                        <div className="rounded border border-white/5 overflow-hidden">
                                            <table className="w-full text-left text-[11px]">
                                                <thead className="bg-white/5 text-white/40">
                                                    <tr>
                                                        <th className="px-2 py-1.5 font-medium">{t('customer_context.label.part_name')}</th>
                                                        <th className="px-2 py-1.5 font-medium text-right">USD</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {data.parts_catalog.map((part: any) => (
                                                        <tr key={part.id} className="hover:bg-white/[0.02]">
                                                            <td className="px-2 py-2">
                                                                <div className="text-white/80">{part.part_name}</div>
                                                                <div className="text-[10px] text-white/20">{part.part_number}</div>
                                                            </td>
                                                            <td className="px-2 py-2 text-right text-kine-yellow font-mono">
                                                                ${part.retail_price}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Service History Timeline */}
                        {data.service_history && (
                            <div className="space-y-3 pt-2 border-t border-white/10">
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                                    <History className="w-3.5 h-3.5" />
                                    {t('customer_context.section.service_timeline')} ({data.service_history.length})
                                </h4>

                                <div className="relative pl-4 space-y-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
                                    {data.service_history.map((item: any) => (
                                        <div key={item.id} className="relative group">
                                            <div className={`absolute -left-[15px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1A1A] ${item.status === 'Resolved' || item.status === 'Completed' || item.status === 'Closed'
                                                ? 'bg-green-500'
                                                : 'bg-kine-yellow'
                                                }`} />

                                            <div className="bg-white/5 rounded p-2.5 border border-white/5 hover:border-white/20 transition-all">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-[10px] px-1.5 rounded-sm font-medium ${item.type === 'RMA' ? 'bg-red-500/20 text-red-400' :
                                                        item.type === 'DealerRepair' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {item.type}
                                                    </span>
                                                    <span className="text-[10px] text-white/40 font-mono">
                                                        {new Date(item.date).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className="text-sm text-white/90 font-medium leading-snug mb-1 line-clamp-2">
                                                    {item.summary}
                                                </div>

                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[10px] text-white/40 font-mono">
                                                        {item.ticket_number}
                                                    </span>
                                                    <span className="text-[10px] text-white/60">
                                                        {item.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!data.customer && !data.device && (
                            <div className="text-center py-10 text-white/30 text-sm">
                                {t('inquiry_ticket.not_found')}
                            </div>
                        )}

                    </div>
                ) : (
                    <div className="p-8 text-center text-white/30 text-xs">
                        {activeTab === 'customer'
                            ? (customerName ? `未找到 "${customerName}" 的信息` : t('inquiry_ticket.not_found'))
                            : (serialNumber ? `未找到SN "${serialNumber}" 的信息` : t('inquiry_ticket.not_found'))
                        }
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerContextSidebar;
