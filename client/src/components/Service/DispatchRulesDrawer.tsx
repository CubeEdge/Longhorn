import React, { useState, useEffect } from 'react';
import { X, Save, Zap, Loader2, CheckCircle, Info, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface DispatchRulesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    departmentCode: string;
}

interface DispatchRule {
    ticket_type: string;
    node_key: string;
    default_assignee_id: number | null;
    is_enabled: boolean;
    assignee_name?: string;
}

interface User {
    id: number;
    username: string;
    display_name?: string;
}

// Define nodes per department (mirroring backend)
const DEPT_NODES: Record<string, string[]> = {
    'MS': ['draft', 'submitted', 'ms_review', 'ms_closing', 'waiting_customer'],
    'OP': ['op_receiving', 'op_diagnosing', 'op_repairing', 'op_shipping'],
    'RD': ['op_diagnosing', 'op_repairing'],
    'GE': ['ge_review', 'ge_closing']
};

const NODE_LABELS: Record<string, string> = {
    draft: '草稿创建 (Draft)',
    submitted: '工单提交 (Submitted)',
    ms_review: '商务审核 (MS Review)',
    ms_closing: '最终结案 (Closing)',
    waiting_customer: '等待客户 (Waiting)',
    op_receiving: '待收货 (Receiving)',
    op_diagnosing: '维修诊断 (Diagnosing)',
    op_repairing: '维修执行 (Repairing)',
    op_shipping: '打包发货 (Shipping)',
    ge_review: '通用审核 (GE Review)',
    ge_closing: '通用结案 (GE Closing)'
};

export const DispatchRulesDrawer: React.FC<DispatchRulesDrawerProps> = ({ isOpen, onClose, departmentCode }) => {
    const { token } = useAuthStore();
    const [rules, setRules] = useState<DispatchRule[]>([]);
    const [deptMembers, setDeptMembers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deptId, setDeptId] = useState<number | null>(null);
    const [autoDispatchGlobal, setAutoDispatchGlobal] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const normDept = departmentCode.toUpperCase();
    const relevantNodes = DEPT_NODES[normDept] || [];

    useEffect(() => {
        if (isOpen && normDept) {
            fetchInitialData();
        }
    }, [isOpen, normDept]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // 1. Get Department Info based on code passed in
            const infoRes = await axios.get(`/api/v1/departments/code/${normDept}/info`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const myDeptId = infoRes.data.data.id;
            const globalEnabled = infoRes.data.data.auto_dispatch_enabled;
            setDeptId(myDeptId);
            setAutoDispatchGlobal(globalEnabled);

            // 2. Get Members
            const usersRes = await axios.get('/api/v1/system/users', {
                headers: { Authorization: `Bearer ${token}` },
                params: { department: myDeptId }
            });
            setDeptMembers(usersRes.data.data);

            // 3. Get Existing Rules
            const rulesRes = await axios.get(`/api/v1/departments/${myDeptId}/dispatch-rules`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRules(rulesRes.data.data);
        } catch (err) {
            console.error('Failed to fetch dispatch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRule = (nodeKey: string, assigneeId: number | null) => {
        setRules(prev => {
            const existing = prev.find(r => r.node_key === nodeKey);
            if (existing) {
                return prev.map(r => r.node_key === nodeKey ? { ...r, default_assignee_id: assigneeId } : r);
            } else {
                return [...prev, { ticket_type: normDept === 'MS' ? 'inquiry' : 'rma', node_key: nodeKey, default_assignee_id: assigneeId, is_enabled: true }];
            }
        });
    };

    const handleToggleRule = (nodeKey: string, isEnabled: boolean) => {
        setRules(prev => {
            const existing = prev.find(r => r.node_key === nodeKey);
            if (existing) {
                return prev.map(r => r.node_key === nodeKey ? { ...r, is_enabled: isEnabled } : r);
            } else {
                return [...prev, { ticket_type: normDept === 'MS' ? 'inquiry' : 'rma', node_key: nodeKey, default_assignee_id: null, is_enabled: isEnabled }];
            }
        });
    };

    const handleToggleGlobal = async (val: boolean) => {
        if (!deptId) return;
        setAutoDispatchGlobal(val);
        try {
            await axios.patch(`/api/v1/departments/${deptId}/settings`, {
                auto_dispatch_enabled: val
            }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) {
            console.error('Failed to update global toggle:', err);
        }
    };

    const handleSave = async () => {
        if (!deptId) return;
        setSaving(true);
        setMessage(null);
        try {
            await axios.post(`/api/v1/departments/${deptId}/dispatch-rules`, {
                rules: rules
            }, { headers: { Authorization: `Bearer ${token}` } });

            setMessage({ type: 'success', text: '分发规则已保存' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, transition: 'all 0.3s'
                }}
            />
            {/* Drawer */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
                background: '#121214', borderLeft: '1px solid rgba(255,255,255,0.1)',
                zIndex: 1001, display: 'flex', flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'rgba(255, 215, 0, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Zap size={20} color="#FFD700" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 600 }}>自动分发规则</h2>
                            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>设置部门各阶段的默认负责人</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                            <Loader2 className="animate-spin" color="#888" />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Global Toggle Card */}
                            <div style={{
                                padding: '16px 20px', background: 'rgba(255,215,0,0.05)',
                                borderRadius: 14, border: '1px solid rgba(255,215,0,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: autoDispatchGlobal ? '#FFD700' : '#444' }} />
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#FFD700' }}>开启全科室自动分发</div>
                                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>总开关，关闭后所有规则暂不生效</div>
                                    </div>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={autoDispatchGlobal} onChange={e => handleToggleGlobal(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                                    <div style={{
                                        position: 'absolute', inset: 0, borderRadius: 20,
                                        background: autoDispatchGlobal ? '#FFD700' : '#333',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: 3, left: autoDispatchGlobal ? 23 : 3,
                                            width: 18, height: 18, borderRadius: '50%', background: autoDispatchGlobal ? '#000' : '#888',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                                        }} />
                                    </div>
                                </label>
                            </div>

                            <div style={{
                                padding: '12px 16px', background: 'rgba(59, 130, 246, 0.08)',
                                borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.2)',
                                display: 'flex', gap: 12, flexDirection: 'column'
                            }}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Info size={18} color="#3B82F6" style={{ marginTop: 2, flexShrink: 0 }} />
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6' }}>自动分发规则说明 (乒乓模型)</div>
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, paddingLeft: 30 }}>
                                    当工单进入本部门节点但<b>未配置/停用</b>特定规则时，回退逻辑如下：
                                    <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                                        <li><b>OP (运营/技师)</b>：未设规则 ➔ 放入部门池 (待领/NULL)</li>
                                        <li><b>MS (管理/客服)</b>：未设规则 ➔ 找上一个 MS 负责人 ➔ 兜底创建人</li>
                                        <li><b>GE/RD (财务/研发)</b>：未设规则 ➔ 直接指派给工单创建人</li>
                                    </ul>
                                    <span style={{ opacity: 0.8 }}>* 开启全局开关后，设定的阶梯分发才正式生效。</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: autoDispatchGlobal ? 1 : 0.5, pointerEvents: autoDispatchGlobal ? 'auto' : 'none' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: 1 }}>按节点配置 (PER NODE)</div>
                                {relevantNodes.map(nodeKey => {
                                    const rule = rules.find(r => r.node_key === nodeKey);
                                    const isRuleEnabled = rule?.is_enabled ?? true;

                                    return (
                                        <div key={nodeKey} style={{
                                            padding: '20px', background: 'rgba(255,255,255,0.02)',
                                            borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)',
                                            transition: 'border 0.2s'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{
                                                        padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                                                        fontSize: 13, fontWeight: 700, color: isRuleEnabled ? '#fff' : '#666'
                                                    }}>
                                                        {NODE_LABELS[nodeKey] || nodeKey}
                                                    </div>
                                                </div>

                                                <div
                                                    onClick={() => handleToggleRule(nodeKey, !isRuleEnabled)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
                                                    }}
                                                >
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: isRuleEnabled ? '#10B981' : '#666' }}>
                                                        {isRuleEnabled ? '已启用' : '已停用'}
                                                    </span>
                                                    <div style={{ width: 34, height: 18, borderRadius: 10, background: isRuleEnabled ? '#10B981' : '#444', position: 'relative' }}>
                                                        <div style={{ position: 'absolute', top: 2, left: isRuleEnabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ opacity: isRuleEnabled && autoDispatchGlobal ? 1 : 0.4, pointerEvents: (isRuleEnabled && autoDispatchGlobal) ? 'auto' : 'none' }}>
                                                <div style={{ fontSize: 11, color: '#888', marginBottom: 8, marginLeft: 4 }}>
                                                    默认指派给 (Default Assignee)
                                                    {!autoDispatchGlobal && <span style={{ color: '#EF4444', fontStyle: 'italic', marginLeft: 8 }}>[全局分发已关闭]</span>}
                                                </div>
                                                <div style={{ position: 'relative' }}>
                                                    <select
                                                        value={rule?.default_assignee_id || ''}
                                                        onChange={(e) => {
                                                            handleUpdateRule(nodeKey, e.target.value ? parseInt(e.target.value) : null);
                                                        }}
                                                        style={{
                                                            width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.4)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            color: '#fff', borderRadius: 10, fontSize: 13,
                                                            outline: 'none', appearance: 'none', cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            minWidth: '240px'
                                                        }}
                                                    >
                                                        <option value="">{'(待认领 - Team Pool)'}</option>
                                                        {(nodeKey === 'ms_review' || nodeKey === 'submitted' || nodeKey === 'draft') && (
                                                            <option value="-1">-- ↩️ 自动返回工单创建人 --</option>
                                                        )}
                                                        {deptMembers.map(m => (
                                                            <option key={m.id} value={m.id}>{m.display_name || m.username}</option>
                                                        ))}
                                                    </select>
                                                    <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666' }}>
                                                        <ChevronDown size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {message && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                color: message.type === 'success' ? '#10B981' : '#EF4444',
                                fontSize: 13
                            }}>
                                {message.type === 'success' && <CheckCircle size={14} />}
                                {message.text}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>取消</button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 28px', borderRadius: 10,
                                background: '#FFD700', color: '#000',
                                border: 'none', fontWeight: 700, fontSize: 14,
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.2)',
                                opacity: (saving || loading) ? 0.6 : 1
                            }}
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            保存规则
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes slideInRight {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                `}</style>
            </div >
        </>
    );
};
