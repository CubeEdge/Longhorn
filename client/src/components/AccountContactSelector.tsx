/**
 * AccountContactSelector Component
 * 账户-联系人选择器组件
 * 
 * 用于工单创建/编辑时选择账户和联系人
 * 支持:
 * - 账户搜索和选择
 * - 级联加载联系人
 * - 显示账户类型图标
 * - 创建新账户快捷入口
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// 账户类型定义
interface Account {
  id: number;
  account_number: string;
  name: string;
  account_type: 'DEALER' | 'ORGANIZATION' | 'INDIVIDUAL';
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  service_tier?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
}

// 联系人类型定义
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
}

// 组件Props
interface AccountContactSelectorProps {
  value?: {
    account_id?: number;
    contact_id?: number;
    reporter_name?: string;
  };
  onChange: (value: {
    account_id?: number;
    contact_id?: number;
    reporter_name?: string;
  }) => void;
  disabled?: boolean;
  className?: string;
}

// 账户类型图标和颜色
const ACCOUNT_TYPE_CONFIG = {
  DEALER: {
    icon: '🏪',
    label: '经销商',
    color: 'bg-purple-100 text-purple-800',
  },
  ORGANIZATION: {
    icon: '🏢',
    label: '机构',
    color: 'bg-blue-100 text-blue-800',
  },
  INDIVIDUAL: {
    icon: '👤',
    label: '个人',
    color: 'bg-green-100 text-green-800',
  },
};

export const AccountContactSelector: React.FC<AccountContactSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation();
  
  // 状态
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [, setShowCreateAccount] = useState(false);
  
  // Refs
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载账户列表
  const loadAccounts = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page_size', '20');
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) {
        setAccounts(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载联系人列表
  const loadContacts = useCallback(async (accountId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/v1/accounts/${accountId}/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) {
        setContacts(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 根据value初始化选中状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (value?.account_id && !selectedAccount) {
      // 加载账户详情
      axios.get(`/api/v1/accounts/${value.account_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((response: any) => {
        if (response.data?.success) {
          setSelectedAccount(response.data.data);
          loadContacts(value.account_id!);
        }
      });
    }
    if (value?.contact_id && !selectedContact) {
      // 加载联系人详情
      axios.get(`/api/v1/contacts/${value.contact_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((response: any) => {
        if (response.data?.success) {
          setSelectedContact(response.data.data);
        }
      });
    }
  }, [value, selectedAccount, selectedContact, loadContacts]);

  // 搜索防抖
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery) {
        loadAccounts(searchQuery);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, loadAccounts]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 选择账户
  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setSelectedContact(null);
    setShowAccountDropdown(false);
    setSearchQuery('');
    
    // 加载该账户的联系人
    loadContacts(account.id);
    
    // 通知父组件
    onChange({
      account_id: account.id,
      contact_id: undefined,
      reporter_name: account.primary_contact_name || account.name,
    });
  };

  // 选择联系人
  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    
    // 通知父组件
    onChange({
      account_id: selectedAccount?.id,
      contact_id: contact.id,
      reporter_name: contact.name,
    });
  };

  // 清除选择
  const handleClear = () => {
    setSelectedAccount(null);
    setSelectedContact(null);
    setContacts([]);
    onChange({});
  };

  // 渲染账户类型标签
  const renderAccountTypeBadge = (type: Account['account_type']) => {
    const config = ACCOUNT_TYPE_CONFIG[type];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // 渲染账户卡片
  const renderAccountCard = (account: Account) => (
    <div
      key={account.id}
      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
      onClick={() => handleSelectAccount(account)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{account.name}</span>
            {renderAccountTypeBadge(account.account_type)}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            <span className="text-xs text-gray-400">{account.account_number}</span>
            {account.city && <span className="ml-2">📍 {account.city}</span>}
            {account.service_tier && account.service_tier !== 'STANDARD' && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                account.service_tier === 'VIP' ? 'bg-yellow-100 text-yellow-800' :
                account.service_tier === 'VVIP' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {account.service_tier}
              </span>
            )}
          </div>
          {account.primary_contact_name && (
            <div className="mt-1 text-sm text-gray-600">
              👤 {account.primary_contact_name}
              {account.primary_contact_phone && ` · ${account.primary_contact_phone}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 如果已选择账户，显示详情模式
  if (selectedAccount) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* 已选账户卡片 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900">{selectedAccount.name}</h3>
                {renderAccountTypeBadge(selectedAccount.account_type)}
              </div>
              <p className="text-sm text-gray-500 mt-1">{selectedAccount.account_number}</p>
              {(selectedAccount.email || selectedAccount.phone) && (
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  {selectedAccount.email && <div>📧 {selectedAccount.email}</div>}
                  {selectedAccount.phone && <div>📞 {selectedAccount.phone}</div>}
                </div>
              )}
            </div>
            {!disabled && (
              <button
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 p-1"
                title={t('common.clear')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 联系人选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('ticket.contact')} <span className="text-red-500">*</span>
          </label>
          
          {contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <label
                  key={contact.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedContact?.id === contact.id
                      ? 'border-kine-yellow bg-yellow-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="contact"
                    value={contact.id}
                    checked={selectedContact?.id === contact.id}
                    onChange={() => handleSelectContact(contact)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{contact.name}</span>
                      {contact.status === 'PRIMARY' && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-kine-yellow text-yellow-900">
                          {t('contact.primary')}
                        </span>
                      )}
                      {contact.status === 'INACTIVE' && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          {t('contact.inactive')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {contact.job_title && <span className="mr-3">💼 {contact.job_title}</span>}
                      {contact.email && <span className="mr-3">📧 {contact.email}</span>}
                      {contact.phone && <span>📞 {contact.phone}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              {t('account.noContacts')}
            </div>
          )}
        </div>

        {/* 报告人姓名（可编辑） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('ticket.reporterName')}
          </label>
          <input
            type="text"
            value={value?.reporter_name || selectedContact?.name || selectedAccount.name}
            onChange={(e) => onChange({
              account_id: selectedAccount.id,
              contact_id: selectedContact?.id,
              reporter_name: e.target.value,
            })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent disabled:bg-gray-100"
            placeholder={t('ticket.reporterNamePlaceholder')}
          />
        </div>
      </div>
    );
  }

  // 搜索选择模式
  return (
    <div className={`relative ${className}`} ref={accountDropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('account.select')} <span className="text-red-500">*</span>
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowAccountDropdown(true);
          }}
          onFocus={() => setShowAccountDropdown(true)}
          disabled={disabled}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent disabled:bg-gray-100"
          placeholder={t('account.searchPlaceholder')}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {loading ? (
            <div className="animate-spin h-4 w-4 border-2 border-kine-yellow border-t-transparent rounded-full" />
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* 下拉列表 */}
      {showAccountDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-auto">
          {accounts.length > 0 ? (
            <>
              <div className="sticky top-0 bg-gray-50 px-3 py-2 text-xs text-gray-500 border-b">
                {t('account.searchResults', { count: accounts.length })}
              </div>
              {accounts.map(renderAccountCard)}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? t('account.noResults') : t('account.startTyping')}
            </div>
          )}
          
          {/* 创建新账户入口 */}
          <div className="sticky bottom-0 bg-gray-50 border-t p-2">
            <button
              onClick={() => setShowCreateAccount(true)}
              className="w-full py-2 px-3 text-sm text-kine-yellow hover:bg-yellow-50 rounded-lg flex items-center justify-center gap-2"
            >
              <span>+</span>
              {t('account.createNew')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountContactSelector;
