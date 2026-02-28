import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../store/useToast';
import { useLanguage } from '../i18n/useLanguage';
import {
    ShieldCheck,
    Clock,
    Plus,
    Tag,
    FolderPlus
} from 'lucide-react';
import FolderTreeSelector from './FolderTreeSelector';

const DepartmentManagement: React.FC = () => {
    const [departments, setDepartments] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptCode, setNewDeptCode] = useState('');

    // Grant state
    const [grantUserId, setGrantUserId] = useState('');
    const [grantPath, setGrantPath] = useState('');
    const [grantType, setGrantType] = useState('Read');
    const [grantExpiry, setGrantExpiry] = useState('permanent');
    const [isFolderSelectorOpen, setIsFolderSelectorOpen] = useState(false);

    const { token } = useAuthStore();
    const { showToast } = useToast();
    const { t } = useLanguage();

    const fetchData = async () => {
        const headers = { Authorization: `Bearer ${token}` };
        const [uRes, dRes] = await Promise.all([
            axios.get('/api/admin/users', { headers }),
            axios.get('/api/admin/departments', { headers })
        ]);
        setUsers(uRes.data);
        setDepartments(dRes.data);
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const createDept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeptName || !newDeptCode) {
            showToast(t('dept.alert_fill_info'), 'warning');
            return;
        }

        // Validate Code: 2-3 uppercase letters
        const codeRegex = /^[A-Z]{2,3}$/;
        if (!codeRegex.test(newDeptCode)) {
            showToast(t('dept.alert_code_format'), 'warning');
            return;
        }

        const fullName = `${newDeptName} (${newDeptCode})`;

        await axios.post('/api/admin/departments', { name: fullName }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setNewDeptName('');
        setNewDeptCode('');
        fetchData();
    };

    const grantPermission = async (e: React.FormEvent) => {
        e.preventDefault();
        await axios.post('/api/admin/permissions', {
            user_id: parseInt(grantUserId),
            folder_path: grantPath,
            access_type: grantType,
            expiry_option: grantExpiry
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setGrantPath('');
        showToast(t('dept_mgmt.auth_success'), 'success');
    };

    // Helper function to translate department name
    const getDeptDisplayName = (deptName: string) => {
        // Extract department code from format like "市场部 (MS)"
        const match = deptName.match(/\(([A-Z]{2,3})\)$/);
        if (match) {
            const code = match[1];
            return `${t(`dept.${code}` as any)} (${code})`;
        }
        return deptName;
    };

    return (

        <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{t('dept_mgmt.title')}</h2>
                <p className="hint">{t('dept_mgmt.desc')}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {/* Authorization */}
                <div style={{ background: 'var(--glass-bg)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32 }}>
                    <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ShieldCheck size={20} color="var(--accent-blue)" /> {t('dept_mgmt.folder_auth')}
                    </h3>
                    <form onSubmit={grantPermission} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>{t('dept_mgmt.target_user')}</label>
                            <select
                                value={grantUserId}
                                onChange={e => setGrantUserId(e.target.value)}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: 8, color: 'var(--text-main)' }}
                                required
                            >
                                <option value="">{t('dept_mgmt.select_user')}</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>{t('dept_mgmt.target_folder')}</label>
                            <div
                                onClick={() => setIsFolderSelectorOpen(true)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--glass-border)',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    color: grantPath ? 'white' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <span>{grantPath || t('dept_mgmt.click_select')}</span>
                                <FolderPlus size={16} color="var(--accent-blue)" />
                            </div>
                        </div>
                        <div>
                            <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 8, display: 'block' }}>{t('permission.type')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => setGrantType('Read')}
                                    style={{
                                        padding: '10px',
                                        background: grantType === 'Read' ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: grantType === 'Read' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: grantType === 'Read' ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (grantType !== 'Read') e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (grantType !== 'Read') e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >{t('permission.read_only')}</button>
                                <button
                                    type="button"
                                    onClick={() => setGrantType('Contribute')}
                                    style={{
                                        padding: '10px',
                                        background: grantType === 'Contribute' ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: grantType === 'Contribute' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: grantType === 'Contribute' ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (grantType !== 'Contribute') e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (grantType !== 'Contribute') e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >{t('permission.contribute')}</button>
                                <button
                                    type="button"
                                    onClick={() => setGrantType('Full')}
                                    style={{
                                        padding: '10px',
                                        background: grantType === 'Full' ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: grantType === 'Full' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: grantType === 'Full' ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (grantType !== 'Full') e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (grantType !== 'Full') e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >{t('permission.full')}</button>
                            </div>
                            <div style={{
                                marginTop: '12px',
                                padding: '10px 12px',
                                background: 'rgba(255, 210, 0, 0.08)',
                                border: '1px solid rgba(255, 210, 0, 0.2)',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                color: 'var(--text-main)',
                                lineHeight: 1.5
                            }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--accent-blue)', fontSize: '0.8rem' }}>{t('permission.info_title')}</div>
                                <div><strong>{t('permission.read_only')}</strong>{t('permission.read_only_desc')}</div>
                                <div><strong>{t('permission.contribute')}</strong>{t('permission.contribute_desc')}</div>
                                <div><strong>{t('permission.full')}</strong>{t('permission.full_desc')}</div>
                            </div>
                        </div>
                        <div>
                            <label className="hint" style={{ fontSize: '0.8rem', marginBottom: 8, display: 'block' }}>{t('label.validity_period')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setGrantExpiry('7days')}
                                    style={{
                                        padding: '10px',
                                        background: grantExpiry === '7days' ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: grantExpiry === '7days' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: grantExpiry === '7days' ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (grantExpiry !== '7days') e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (grantExpiry !== '7days') e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >{t('time.days_7')}</button>
                                <button
                                    type="button"
                                    onClick={() => setGrantExpiry('1month')}
                                    style={{
                                        padding: '10px',
                                        background: grantExpiry === '1month' ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: grantExpiry === '1month' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: grantExpiry === '1month' ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (grantExpiry !== '1month') e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (grantExpiry !== '1month') e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >{t('time.month_1')}</button>
                                <button
                                    type="button"
                                    onClick={() => setGrantExpiry('permanent')}
                                    style={{
                                        padding: '10px',
                                        background: grantExpiry === 'permanent' ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: grantExpiry === 'permanent' ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: grantExpiry === 'permanent' ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (grantExpiry !== 'permanent') e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (grantExpiry !== 'permanent') e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >{t('time.forever')}</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const custom = prompt(t('dept.prompt_custom_expiry'), '3months');
                                        if (custom) {
                                            setGrantExpiry(custom);
                                        }
                                    }}
                                    style={{
                                        padding: '10px',
                                        background: !['7days', '1month', 'permanent'].includes(grantExpiry) ? 'rgba(255, 210, 0, 0.15)' : 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: !['7days', '1month', 'permanent'].includes(grantExpiry) ? '4px solid var(--accent-blue)' : '1px solid var(--glass-bg-hover)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontWeight: !['7days', '1month', 'permanent'].includes(grantExpiry) ? 700 : 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (['7days', '1month', 'permanent'].includes(grantExpiry)) e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (['7days', '1month', 'permanent'].includes(grantExpiry)) e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    }}
                                >
                                    {t('time.custom')}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="submit" className="btn-primary" style={{ padding: '10px 24px', borderRadius: 8 }}>{t('share.execute_auth')}</button>
                        </div>
                    </form>
                </div>

                {/* Department Management */}
                <div style={{ background: 'var(--glass-bg)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32 }}>
                    <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Plus size={20} color="var(--accent-blue)" /> {t('dept_mgmt.add_dept')}
                    </h3>
                    <form onSubmit={createDept} style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                        <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                            <input
                                type="text"
                                placeholder={t('dept_mgmt.dept_name_placeholder')}
                                value={newDeptName}
                                onChange={e => setNewDeptName(e.target.value)}
                                style={{ flex: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'var(--text-main)' }}
                            />
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder="CODE (e.g. MS)"
                                    value={newDeptCode}
                                    onChange={e => setNewDeptCode(e.target.value.toUpperCase())}
                                    maxLength={3}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: 10, color: 'var(--accent-blue)', fontWeight: 'bold' }}
                                />
                                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                    2-3 Letters
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>{t('dept_mgmt.add')}</button>
                    </form>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {departments.map(d => (
                            <div key={d.id} style={{
                                background: 'rgba(255,210,0,0.1)',
                                border: '1px solid rgba(255,210,0,0.2)',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontSize: '0.9rem',
                                color: 'var(--accent-blue)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500
                            }}>
                                <Tag size={14} /> {getDeptDisplayName(d.name)}
                            </div>
                        ))}
                    </div>
                </div>
            </div >

            {/* Folder Selector Modal */}
            {
                isFolderSelectorOpen && (
                    <FolderTreeSelector
                        token={token || ''}
                        currentPath={grantPath}
                        onSelect={(path) => {
                            setGrantPath(path);
                            setIsFolderSelectorOpen(false);
                        }}
                        onClose={() => setIsFolderSelectorOpen(false)}
                    />
                )
            }

            {/* Hint Section - Moved to Bottom & Compact */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 20, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <FolderPlus size={18} color="var(--text-secondary)" />
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('dept_mgmt.core_rules')}</h4>
                    </div>
                    <ul className="hint" style={{ fontSize: '0.8rem', lineHeight: 1.5, paddingLeft: 16, margin: 0 }}>
                        <li>{t('dept_mgmt.rule_lead')}</li>
                        <li>{t('dept_mgmt.rule_personal')}</li>
                        <li>{t('dept.permission_conflict_rule')}</li>
                    </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 20, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <Clock size={18} color="var(--text-secondary)" />
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('dept_mgmt.audit_note')}</h4>
                    </div>
                    <p className="hint" style={{ fontSize: '0.8rem', margin: 0 }}>
                        {t('dept_mgmt.audit_desc')}
                    </p>
                </div>
            </div>
        </div >
    );
};

export default DepartmentManagement;
