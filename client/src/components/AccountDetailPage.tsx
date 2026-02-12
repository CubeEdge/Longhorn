/**
 * AccountDetailPage Component
 * 账户详情页面
 * 
 * 显示账户完整信息，包括：
 * - 账户基本信息
 * - 联系人列表（使用 ContactManager）
 * - 设备资产列表
 * - 服务历史
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { ArrowLeft, Building2, User, Phone, Mail, MapPin, History, Package } from 'lucide-react';
import ContactManager from './ContactManager';

// 类型定义
interface Account {
  id: number;
  account_number: string;
  name: string;
  account_type: 'DEALER' | 'ORGANIZATION' | 'INDIVIDUAL';
  email?: string;
  phone?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  service_tier: 'STANDARD' | 'VIP' | 'VVIP' | 'BLACKLIST';
  industry_tags?: string[];
  credit_limit?: number;
  dealer_code?: string;
  dealer_level?: string;
  region?: string;
  can_repair?: boolean;
  repair_level?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  parent_dealer?: {
    id: number;
    name: string;
    dealer_code: string;
  } | null;
}

interface Contact {
  id: number;
  account_id: number;
  name: string;
  email?: string;
  phone?: string;
  wechat?: string;
  job_title?: string;
  department?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PRIMARY';
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface Device {
  id: number;
  serial_number: string;
  product_model?: string;
  product_family?: string;
  firmware_version?: string;
  purchase_date?: string;
  warranty_until?: string;
  device_status: 'ACTIVE' | 'SOLD' | 'RETIRED';
}

interface Ticket {
  id: number;
  ticket_number: string;
  type: 'inquiry' | 'rma' | 'dealer_repair';
  category?: string;
  summary?: string;
  status: string;
  date: string;
  contact_name?: string;
}

const ACCOUNT_TYPE_CONFIG = {
  DEALER: { icon: Building2, label: '经销商', color: 'bg-purple-100 text-purple-800' },
  ORGANIZATION: { icon: Building2, label: '机构', color: 'bg-blue-100 text-blue-800' },
  INDIVIDUAL: { icon: User, label: '个人', color: 'bg-green-100 text-green-800' },
};

const AccountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'devices' | 'history'>('overview');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (id) {
      loadAccountData(parseInt(id));
    }
  }, [id]);

  const loadAccountData = async (accountId: number) => {
    try {
      setLoading(true);
      setError(null);

      // 加载账户详情
      const accountRes = await axios.get(`/api/v1/accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (accountRes.data?.success) {
        const accountData = accountRes.data.data;
        setAccount(accountData);
        setContacts(accountData.contacts || []);
        setDevices(accountData.devices || []);
      }

      // 加载工单历史
      const ticketsRes = await axios.get(`/api/v1/accounts/${accountId}/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (ticketsRes.data?.success) {
        setTickets(ticketsRes.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load account:', err);
      setError(err.response?.data?.error?.message || t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleContactsChange = (updatedContacts: Contact[]) => {
    setContacts(updatedContacts);
  };

  const renderAccountTypeBadge = (type: Account['account_type']) => {
    const config = ACCOUNT_TYPE_CONFIG[type];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </span>
    );
  };

  const renderServiceTierBadge = (tier: Account['service_tier']) => {
    const colors = {
      STANDARD: 'bg-gray-100 text-gray-800',
      VIP: 'bg-yellow-100 text-yellow-800',
      VVIP: 'bg-red-100 text-red-800',
      BLACKLIST: 'bg-black text-white',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[tier]}`}>
        {tier}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kine-yellow"></div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error || t('account.notFound')}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
            {renderAccountTypeBadge(account.account_type)}
            {renderServiceTierBadge(account.service_tier)}
            {!account.is_active && (
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                {t('account.inactive')}
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1">{account.account_number}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {[
            { key: 'overview', label: t('account.overview'), icon: Building2 },
            { key: 'contacts', label: `${t('account.contacts')} (${contacts.length})`, icon: User },
            { key: 'devices', label: `${t('account.devices')} (${devices.length})`, icon: Package },
            { key: 'history', label: `${t('account.history')} (${tickets.length})`, icon: History },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-kine-yellow text-kine-yellow'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">{t('account.basicInfo')}</h2>
              <div className="space-y-4">
                {account.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <a href={`mailto:${account.email}`} className="text-blue-600 hover:underline">
                      {account.email}
                    </a>
                  </div>
                )}
                {account.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <a href={`tel:${account.phone}`} className="text-blue-600 hover:underline">
                      {account.phone}
                    </a>
                  </div>
                )}
                {(account.country || account.city) && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span>
                      {[account.country, account.province, account.city]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
                {account.address && (
                  <div className="text-gray-600 bg-gray-50 p-3 rounded">
                    {account.address}
                  </div>
                )}
              </div>

              {account.industry_tags && account.industry_tags.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">{t('account.industry')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {account.industry_tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 经销商信息（如果是经销商） */}
            {account.account_type === 'DEALER' && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">{t('account.dealerInfo')}</h2>
                <div className="space-y-3">
                  {account.dealer_code && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('account.dealerCode')}</span>
                      <span className="font-medium">{account.dealer_code}</span>
                    </div>
                  )}
                  {account.dealer_level && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('account.dealerLevel')}</span>
                      <span className="font-medium">{account.dealer_level}</span>
                    </div>
                  )}
                  {account.region && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('account.region')}</span>
                      <span className="font-medium">{account.region}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('account.canRepair')}</span>
                    <span className="font-medium">{account.can_repair ? t('common.yes') : t('common.no')}</span>
                  </div>
                  {account.repair_level && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('account.repairLevel')}</span>
                      <span className="font-medium">{account.repair_level}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 上级经销商（如果是企业客户） */}
            {account.parent_dealer && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">{t('account.parentDealer')}</h2>
                <div className="flex items-center gap-3">
                  <Building2 className="w-10 h-10 text-gray-400" />
                  <div>
                    <p className="font-medium">{account.parent_dealer.name}</p>
                    <p className="text-sm text-gray-500">{account.parent_dealer.dealer_code}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 备注 */}
            {account.notes && (
              <div className="bg-white rounded-lg border p-6 md:col-span-2">
                <h2 className="text-lg font-semibold mb-4">{t('account.notes')}</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{account.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <ContactManager
            accountId={account.id}
            contacts={contacts}
            onContactsChange={handleContactsChange}
            readOnly={false}
          />
        )}

        {activeTab === 'devices' && (
          <div className="bg-white rounded-lg border">
            {devices.length > 0 ? (
              <div className="divide-y">
                {devices.map((device) => (
                  <div key={device.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{device.product_model || device.serial_number}</p>
                      <p className="text-sm text-gray-500">{device.serial_number}</p>
                      {device.product_family && (
                        <p className="text-sm text-gray-400">{device.product_family}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        device.device_status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        device.device_status === 'SOLD' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {device.device_status}
                      </span>
                      {device.warranty_until && (
                        <p className="text-sm text-gray-500 mt-1">
                          {t('device.warrantyUntil')}: {device.warranty_until}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('account.noDevices')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg border">
            {tickets.length > 0 ? (
              <div className="divide-y">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/service/${ticket.type === 'inquiry' ? 'inquiry-tickets' : ticket.type === 'rma' ? 'rma-tickets' : 'dealer-repairs'}/${ticket.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ticket.ticket_number}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            ticket.type === 'inquiry' ? 'bg-blue-100 text-blue-800' :
                            ticket.type === 'rma' ? 'bg-red-100 text-red-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {ticket.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{ticket.summary}</p>
                        {ticket.contact_name && (
                          <p className="text-sm text-gray-500 mt-1">
                            {t('ticket.contact')}: {ticket.contact_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.status === 'Closed' || ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                          ticket.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.status}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">{ticket.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('account.noHistory')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountDetailPage;
