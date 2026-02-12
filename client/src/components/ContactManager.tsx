/**
 * ContactManager Component
 * 联系人管理组件
 * 
 * 用于账户详情页显示和管理联系人
 * 支持:
 * - 显示联系人列表
 * - 添加新联系人
 * - 编辑联系人
 * - 设置主要联系人
 * - 标记联系人离职(INACTIVE)
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

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
  language_preference?: string;
  communication_preference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 组件Props
interface ContactManagerProps {
  accountId: number;
  contacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
  readOnly?: boolean;
}

// 空联系人模板
const EMPTY_CONTACT: Partial<Contact> = {
  name: '',
  email: '',
  phone: '',
  wechat: '',
  job_title: '',
  department: '',
  status: 'ACTIVE',
  is_primary: false,
  language_preference: 'zh',
  communication_preference: 'EMAIL',
  notes: '',
};

export const ContactManager: React.FC<ContactManagerProps> = ({
  accountId,
  contacts,
  onContactsChange,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  
  // 状态
  const [isAdding, setIsAdding] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<Partial<Contact>>(EMPTY_CONTACT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取token
  const getToken = () => localStorage.getItem('token');

  // 打开添加表单
  const handleAddNew = () => {
    setFormData({ ...EMPTY_CONTACT });
    setIsAdding(true);
    setEditingContact(null);
    setError(null);
  };

  // 打开编辑表单
  const handleEdit = (contact: Contact) => {
    setFormData({ ...contact });
    setEditingContact(contact);
    setIsAdding(false);
    setError(null);
  };

  // 关闭表单
  const handleCancel = () => {
    setIsAdding(false);
    setEditingContact(null);
    setFormData(EMPTY_CONTACT);
    setError(null);
  };

  // 保存联系人
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      setError(t('contact.nameRequired'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = getToken();

      if (editingContact) {
        // 更新现有联系人
        const response = await axios.patch(
          `/api/v1/contacts/${editingContact.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data?.success) {
          const updatedContacts = contacts.map(c =>
            c.id === editingContact.id ? { ...c, ...formData } as Contact : c
          );
          onContactsChange(updatedContacts);
          handleCancel();
        }
      } else {
        // 创建新联系人
        const response = await axios.post(
          `/api/v1/accounts/${accountId}/contacts`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data?.success) {
          const newContact: Contact = {
            ...formData,
            id: response.data.data.id,
            account_id: accountId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Contact;
          
          // 如果设为PRIMARY，更新其他联系人状态
          let updatedContacts = [...contacts, newContact];
          if (formData.is_primary || formData.status === 'PRIMARY') {
            updatedContacts = updatedContacts.map(c =>
              c.id === newContact.id
                ? c
                : { ...c, status: 'ACTIVE' as const, is_primary: false }
            );
          }
          
          onContactsChange(updatedContacts);
          handleCancel();
        }
      }
    } catch (err: any) {
      console.error('Failed to save contact:', err);
      setError(err.response?.data?.error?.message || t('common.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 设置为主要联系人
  const handleSetPrimary = async (contactId: number) => {
    try {
      setLoading(true);
      const token = getToken();
      
      const response = await axios.patch(
        `/api/v1/contacts/${contactId}`,
        { status: 'PRIMARY', is_primary: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        const updatedContacts = contacts.map(c => ({
          ...c,
          status: (c.id === contactId ? 'PRIMARY' : 'ACTIVE') as Contact['status'],
          is_primary: c.id === contactId,
        }));
        onContactsChange(updatedContacts);
      }
    } catch (err) {
      console.error('Failed to set primary contact:', err);
    } finally {
      setLoading(false);
    }
  };

  // 标记联系人离职
  const handleDeactivate = async (contactId: number) => {
    if (!window.confirm(t('contact.confirmDeactivate'))) {
      return;
    }

    try {
      setLoading(true);
      const token = getToken();
      
      const response = await axios.delete(
        `/api/v1/contacts/${contactId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        const updatedContacts = contacts.map(c =>
          c.id === contactId
            ? { ...c, status: 'INACTIVE' as const, is_primary: false }
            : c
        );
        onContactsChange(updatedContacts);
      }
    } catch (err) {
      console.error('Failed to deactivate contact:', err);
    } finally {
      setLoading(false);
    }
  };

  // 渲染状态标签
  const renderStatusBadge = (status: Contact['status']) => {
    const config = {
      PRIMARY: { class: 'bg-kine-yellow text-yellow-900', label: t('contact.primary') },
      ACTIVE: { class: 'bg-green-100 text-green-800', label: t('contact.active') },
      INACTIVE: { class: 'bg-gray-100 text-gray-600', label: t('contact.inactive') },
    };
    const { class: className, label } = config[status];
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  };

  // 渲染联系人卡片
  const renderContactCard = (contact: Contact) => (
    <div
      key={contact.id}
      className={`bg-white rounded-lg border p-4 ${
        contact.status === 'PRIMARY'
          ? 'border-kine-yellow bg-yellow-50'
          : contact.status === 'INACTIVE'
          ? 'border-gray-200 opacity-60'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{contact.name}</h4>
            {renderStatusBadge(contact.status)}
          </div>
          
          {contact.job_title && (
            <p className="text-sm text-gray-600 mt-1">💼 {contact.job_title}</p>
          )}
          
          <div className="mt-2 space-y-1 text-sm text-gray-500">
            {contact.email && (
              <div className="flex items-center gap-2">
                <span>📧</span>
                <a href={`mailto:${contact.email}`} className="hover:text-kine-yellow">
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <span>📞</span>
                <a href={`tel:${contact.phone}`} className="hover:text-kine-yellow">
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.wechat && (
              <div className="flex items-center gap-2">
                <span>💬</span>
                <span>{contact.wechat}</span>
              </div>
            )}
          </div>

          {contact.notes && (
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contact.notes}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        {!readOnly && contact.status !== 'INACTIVE' && (
          <div className="flex flex-col gap-2 ml-4">
            <button
              onClick={() => handleEdit(contact)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title={t('common.edit')}
            >
              ✏️
            </button>
            
            {contact.status !== 'PRIMARY' && (
              <button
                onClick={() => handleSetPrimary(contact.id)}
                className="p-1.5 text-gray-400 hover:text-kine-yellow hover:bg-yellow-50 rounded"
                title={t('contact.setPrimary')}
              >
                ⭐
              </button>
            )}
            
            <button
              onClick={() => handleDeactivate(contact.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title={t('contact.deactivate')}
            >
              🚫
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // 渲染表单
  const renderForm = () => (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-gray-900 mb-4">
        {editingContact ? t('contact.editTitle') : t('contact.addTitle')}
      </h4>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.namePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.jobTitle')}
          </label>
          <input
            type="text"
            value={formData.job_title || ''}
            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.jobTitlePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.email')}
          </label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.emailPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.phone')}
          </label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.phonePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.wechat')}
          </label>
          <input
            type="text"
            value={formData.wechat || ''}
            onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.wechatPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.department')}
          </label>
          <input
            type="text"
            value={formData.department || ''}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.departmentPlaceholder')}
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_primary || formData.status === 'PRIMARY'}
              onChange={(e) => setFormData({ 
                ...formData, 
                is_primary: e.target.checked,
                status: e.target.checked ? 'PRIMARY' : 'ACTIVE'
              })}
              className="w-4 h-4 text-kine-yellow border-gray-300 rounded focus:ring-kine-yellow"
            />
            <span className="text-sm text-gray-700">{t('contact.setAsPrimary')}</span>
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contact.notes')}
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kine-yellow focus:border-transparent"
            placeholder={t('contact.notesPlaceholder')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 text-white bg-kine-yellow rounded-lg hover:bg-yellow-500 disabled:opacity-50"
        >
          {loading ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {t('contact.title')} ({contacts.length})
        </h3>
        {!readOnly && !isAdding && !editingContact && (
          <button
            onClick={handleAddNew}
            className="px-4 py-2 text-sm text-white bg-kine-yellow rounded-lg hover:bg-yellow-500 flex items-center gap-2"
          >
            <span>+</span>
            {t('contact.add')}
          </button>
        )}
      </div>

      {/* 表单 */}
      {(isAdding || editingContact) && renderForm()}

      {/* 联系人列表 */}
      <div className="space-y-3">
        {contacts.length > 0 ? (
          contacts
            .sort((a, b) => {
              // PRIMARY > ACTIVE > INACTIVE
              const statusOrder = { PRIMARY: 0, ACTIVE: 1, INACTIVE: 2 };
              return statusOrder[a.status] - statusOrder[b.status];
            })
            .map(renderContactCard)
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <p>{t('contact.empty')}</p>
            {!readOnly && (
              <button
                onClick={handleAddNew}
                className="mt-2 text-kine-yellow hover:underline"
              >
                {t('contact.addFirst')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactManager;
