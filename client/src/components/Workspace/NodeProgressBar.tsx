/**
 * NodeProgressBar (RMA / SVC 阶段流转可视化)
 * PRD P2 Section 5.2 - Ping-Pong 协作模型
 * macOS26 风格 – 横向节点进度条
 * Tooltip: React Portal (position: fixed) 避免 overflow 裁剪
 */

import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useLanguage } from '../../i18n/useLanguage';

// RMA node sequence (PRD 5.2 - Optimized to 6 steps)
const RMA_NODES = [
    { key: 'op_receiving', defaultDept: 'OP', match: ['draft', 'submitted', 'op_receiving', 'pending_arrival'] },
    { key: 'op_diagnosing', defaultDept: 'OP', match: ['op_diagnosing'] },
    { key: 'ms_review', defaultDept: 'MS', match: ['ms_review'] },
    { key: 'op_repairing', defaultDept: 'OP', match: ['op_repairing'] },
    { key: 'ms_closing', defaultDept: 'MS', match: ['ge_review', 'ms_closing', 'ms_review_finance', 'waiting_customer'] },
    { key: 'op_shipping', defaultDept: 'OP', match: ['shipped', 'op_shipping', 'op_qa', 'ge_closing', 'resolved'] },
];

// SVC node sequence (PRD 5.3)
const SVC_NODES = [
    { key: 'dl_submitted', defaultDept: 'DL', match: ['dl_submitted', 'submitted'] },
    { key: 'ms_review', defaultDept: 'MS', match: ['ms_review'] },
    { key: 'dl_repairing', defaultDept: 'DL', match: ['dl_repairing'] },
    { key: 'ge_closing', defaultDept: 'GE', match: ['ge_review', 'ge_closing'] },
    { key: 'resolved', defaultDept: '-', match: ['resolved'] },
];

// Inquiry node sequence
const INQUIRY_NODES = [
    { key: 'draft', defaultDept: 'MS', match: ['draft', 'submitted'] },
    { key: 'ms_review', defaultDept: 'MS', match: ['ms_review'] },
    { key: 'waiting_customer', defaultDept: '-', match: ['waiting_customer'] },
    { key: 'resolved', defaultDept: '-', match: ['resolved'] },
];

const NODE_LABELS: Record<string, Record<string, string>> = {
    zh: {
        op_receiving: '待收货',
        op_diagnosing: '诊断中',
        ms_review: '商务审核',
        op_repairing: '维修中',
        ms_closing: '最终结案',
        op_shipping: '打包发货',
        ge_closing: '财务结案',
        resolved: '已完成',
        dl_submitted: '已提交',
        dl_repairing: '经销商维修',
        draft: '草稿',
        waiting_customer: '待客户反馈',
    },
    en: {
        op_receiving: 'Arrival',
        op_diagnosing: 'Diagnosis',
        ms_review: 'Review',
        op_repairing: 'Repairing',
        ms_closing: 'Settlement',
        op_shipping: 'Shipping',
        ge_closing: 'Closing',
        resolved: 'Resolved',
        dl_submitted: 'Submitted',
        dl_repairing: 'Repairing',
        draft: 'Draft',
        waiting_customer: 'Waiting',
    }
};

interface Props {
    ticketType: string;
    currentNode: string;
    assignedName?: string;
    assignedDept?: string;
}

const BALL_HINT_CONFIG: Record<string, { role: string; advice: string }> = {
    'draft': { role: '创建人', advice: '工单尚在草稿阶段，请完善信息后提交。' },
    'submitted': { role: '分派人', advice: '工单已提交，即将进入收货环节。' },
    'op_receiving': { role: '库管/物流', advice: '包裹待签收。确认入库后，球将传给技术部门诊断。' },
    'op_diagnosing': { role: '技术专家', advice: '等待拆机诊断。提交诊断报告后，球权将回传客服组。' },
    'ms_review': { role: '客服/商务', advice: '请对接客户确认维修方案。批准维修后，球将传回给技师工作。' },
    'op_repairing': { role: '技术专家', advice: '正在物理维修。完成后，付费单将流向财务核销节点。' },
    'ge_review': { role: '财务审计', advice: '等待核实款项到账。核销后，球将交由客服进行发货前终审。' },
    'ms_closing': { role: '客服/商务', advice: '收款已确认。请核对回寄地址，释放后球传由物流发票并发货。' },
    'op_shipping': { role: '库管/物流', advice: '客服已释放。请打单发货并录入顺丰/DHL物流单号。' },
    'resolved': { role: '归档库', advice: '流程已终结。' },
    'waiting_customer': { role: '客服/商务', advice: '已反馈客户方案，目前等待客户回复确认中。' },
};

// ---- Portal Tooltip (rendered at document.body, escapes all overflow) ----
const PortalTooltip: React.FC<{
    anchorRect: DOMRect | null;
    hint: { role: string; advice: string };
    assignedName?: string;
    assignedDept?: string;
}> = ({ anchorRect, hint, assignedName, assignedDept }) => {
    if (!anchorRect) return null;

    const TOOLTIP_W = 240;
    // Position: centered above the anchor element
    let left = anchorRect.left + anchorRect.width / 2 - TOOLTIP_W / 2;
    const top = anchorRect.top - 10; // 10px gap above anchor

    // Clamp to viewport
    if (left < 8) left = 8;
    if (left + TOOLTIP_W > window.innerWidth - 8) left = window.innerWidth - 8 - TOOLTIP_W;

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: TOOLTIP_W,
            transform: `translate(${left}px, ${top}px) translateY(-100%)`,
            background: 'rgba(22, 22, 26, 0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '10px 14px',
            borderRadius: 10,
            color: '#efefef',
            fontSize: 11,
            lineHeight: 1.5,
            textAlign: 'left',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            zIndex: 99999,
            pointerEvents: 'none',
            animation: 'fadeInTooltip 0.18s ease-out',
        }}>
            <div style={{ fontWeight: 600, color: '#3B82F6', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>球权: {hint.role}</span>
                <span style={{ opacity: 0.8, fontSize: 10 }}>
                    {assignedDept && `[${assignedDept}] `}
                    {assignedName || '🚩待认领'}
                </span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, color: '#ccc' }}>
                {hint.advice}
            </div>
            {/* Arrow pointing down */}
            <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                marginLeft: -6,
                width: 0, height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid rgba(255, 255, 255, 0.15)',
            }} />
        </div>,
        document.body
    );
};

const NodeProgressBar: React.FC<Props> = ({ ticketType, currentNode, assignedName, assignedDept }) => {
    const { language } = useLanguage();
    const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';

    const type = ticketType?.toLowerCase();
    const nodes = type === 'rma' ? RMA_NODES :
        type === 'svc' ? SVC_NODES :
            INQUIRY_NODES;

    // Find current index using match arrays
    const currentIdx = nodes.findIndex(n => n.match.includes(currentNode));
    const effectiveIdx = currentIdx === -1 ? 0 : currentIdx;

    // Hover tooltip state
    const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
    const activeNodeRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = useCallback(() => {
        if (activeNodeRef.current) {
            setHoverRect(activeNodeRef.current.getBoundingClientRect());
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoverRect(null);
    }, []);

    // Map backend node names to precise display depts for the active step
    const getDisplayDept = (node: any, isCurrent: boolean) => {
        if (!isCurrent) return node.defaultDept;
        const backendToDept: Record<string, string> = {
            'ms_review': 'MS',
            'ge_review': 'GE',
            'ge_closing': 'GE',
            'op_receiving': 'OP',
            'op_diagnosing': 'OP',
            'op_repairing': 'OP',
            'op_shipping': 'OP',
            'op_qa': 'OP',
            'ms_closing': 'MS',
            'submitted': 'MS',
            'draft': 'MS',
            'pending_ship': 'MS',
            'waiting_customer': 'MS'
        };
        const dept = assignedDept || backendToDept[currentNode] || node.defaultDept;
        if (assignedName) return `${dept} · ${assignedName}`;
        return `${dept} · 🚩待认领`;
    };

    const activeHint = BALL_HINT_CONFIG[currentNode];

    return (
        <div style={{
            padding: '16px 20px',
            background: 'rgba(30, 30, 30, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 16,
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                minWidth: nodes.length * 100,
                gap: 0,
            }}>
                {nodes.map((node, i) => {
                    const isCompleted = i < effectiveIdx;
                    const isCurrent = i === effectiveIdx;
                    const isPending = i > effectiveIdx;
                    const label = NODE_LABELS[lang]?.[node.key] || node.key;
                    const displayDept = getDisplayDept(node, isCurrent);

                    return (
                        <React.Fragment key={node.key}>
                            {/* Node circle + label */}
                            <div
                                ref={isCurrent ? activeNodeRef : undefined}
                                onMouseEnter={isCurrent && activeHint ? handleMouseEnter : undefined}
                                onMouseLeave={isCurrent && activeHint ? handleMouseLeave : undefined}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    minWidth: 80,
                                    flex: '0 0 auto',
                                    cursor: isCurrent && activeHint ? 'help' : 'default',
                                }}
                            >
                                {/* Circle */}
                                <div style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    transition: 'all 0.3s',
                                    ...(isCompleted ? {
                                        background: '#10B981',
                                        color: '#fff',
                                        boxShadow: '0 0 8px rgba(16,185,129,0.4)',
                                    } : isCurrent ? {
                                        background: '#3B82F6',
                                        color: '#fff',
                                        boxShadow: '0 0 12px rgba(59,130,246,0.5)',
                                        animation: 'pulse-blue 2s ease-in-out infinite',
                                    } : {
                                        background: 'rgba(255,255,255,0.08)',
                                        color: '#555',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    })
                                }}>
                                    {isCompleted ? '✓' : i + 1}
                                </div>

                                {/* Label */}
                                <span style={{
                                    fontSize: 11,
                                    marginTop: 6,
                                    color: isCompleted ? '#10B981' : isCurrent ? '#3B82F6' : '#555',
                                    fontWeight: isCurrent ? 600 : 400,
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center',
                                }}>
                                    {label}
                                </span>

                                {/* Dept badge */}
                                {displayDept !== '-' && (
                                    <span style={{
                                        fontSize: 9,
                                        marginTop: 2,
                                        padding: '1px 8px',
                                        borderRadius: 4,
                                        background: isPending ? 'rgba(255,255,255,0.04)' : isCurrent ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.12)',
                                        color: isPending ? '#555' : isCurrent ? '#3B82F6' : '#10B981',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {displayDept}
                                    </span>
                                )}
                            </div>

                            {/* Connector line */}
                            {i < nodes.length - 1 && (
                                <div style={{
                                    flex: 1,
                                    height: 2,
                                    minWidth: 20,
                                    background: isCompleted ? '#10B981' : 'rgba(255,255,255,0.08)',
                                    borderRadius: 1,
                                    marginTop: -32,
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Portal Tooltip - rendered at body level, never clipped */}
            {hoverRect && activeHint && (
                <PortalTooltip
                    anchorRect={hoverRect}
                    hint={activeHint}
                    assignedName={assignedName}
                    assignedDept={assignedDept}
                />
            )}

            <style>{`
        @keyframes pulse-blue {
          0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 16px rgba(59,130,246,0.6); }
        }
        @keyframes fadeInTooltip {
          from { opacity: 0; transform: translate(var(--x, 0), var(--y, 0)) translateY(-100%) scale(0.95); }
          to { opacity: 1; transform: translate(var(--x, 0), var(--y, 0)) translateY(-100%) scale(1); }
        }
      `}</style>
        </div>
    );
};

export default NodeProgressBar;
