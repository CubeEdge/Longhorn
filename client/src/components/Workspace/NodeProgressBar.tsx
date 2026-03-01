/**
 * NodeProgressBar (RMA / SVC 阶段流转可视化)
 * PRD P2 Section 5.2 - Ping-Pong 协作模型
 * macOS26 风格 – 横向节点进度条
 */

import React from 'react';
import { useLanguage } from '../../i18n/useLanguage';

// RMA node sequence (PRD 5.2)
const RMA_NODES = [
    { key: 'pending_arrival', dept: 'OP' },
    { key: 'op_diagnosing', dept: 'OP' },
    { key: 'ms_review', dept: 'MS' },
    { key: 'op_repairing', dept: 'OP' },
    { key: 'pending_ship', dept: 'MS' },
    { key: 'shipped', dept: 'OP' },
    { key: 'ge_closing', dept: 'GE' },
    { key: 'resolved', dept: '-' },
];

// SVC node sequence (PRD 5.3)
const SVC_NODES = [
    { key: 'dl_submitted', dept: 'DL' },
    { key: 'ms_review', dept: 'MS' },
    { key: 'dl_repairing', dept: 'DL' },
    { key: 'ge_closing', dept: 'GE' },
    { key: 'resolved', dept: '-' },
];

// Inquiry node sequence
const INQUIRY_NODES = [
    { key: 'draft', dept: 'MS' },
    { key: 'ms_review', dept: 'MS' },
    { key: 'waiting_customer', dept: '-' },
    { key: 'resolved', dept: '-' },
];

const NODE_LABELS: Record<string, Record<string, string>> = {
    zh: {
        pending_arrival: '待收货',
        op_diagnosing: '诊断',
        ms_review: '商务审核',
        op_repairing: '维修中',
        pending_ship: '待发货',
        shipped: '已发货',
        ge_closing: '财务结案',
        resolved: '已完成',
        dl_submitted: '已提交',
        dl_repairing: '经销商维修',
        draft: '草稿',
        waiting_customer: '待客户反馈',
    },
    en: {
        pending_arrival: 'Arrival',
        op_diagnosing: 'Diagnosis',
        ms_review: 'Review',
        op_repairing: 'Repair',
        pending_ship: 'Ready to Ship',
        shipped: 'Shipped',
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
}

const NodeProgressBar: React.FC<Props> = ({ ticketType, currentNode }) => {
    const { language } = useLanguage();
    const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';

    const type = ticketType?.toLowerCase();
    const nodes = type === 'rma' ? RMA_NODES :
        type === 'svc' ? SVC_NODES :
            INQUIRY_NODES;

    // Find current index
    const currentIdx = nodes.findIndex(n => n.key === currentNode);
    const effectiveIdx = currentIdx === -1 ? 0 : currentIdx;

    return (
        <div style={{
            padding: '16px 20px',
            background: 'rgba(30, 30, 30, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 16,
            overflowX: 'auto',
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

                    return (
                        <React.Fragment key={node.key}>
                            {/* Node circle + label */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 60,
                                flex: '0 0 auto',
                            }}>
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
                                {node.dept !== '-' && (
                                    <span style={{
                                        fontSize: 9,
                                        marginTop: 2,
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        background: isPending ? 'rgba(255,255,255,0.04)' : isCurrent ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.12)',
                                        color: isPending ? '#555' : isCurrent ? '#3B82F6' : '#10B981',
                                        fontWeight: 500,
                                    }}>
                                        {node.dept}
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
                                    marginTop: -20,
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Pulse animation */}
            <style>{`
        @keyframes pulse-blue {
          0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 16px rgba(59,130,246,0.6); }
        }
      `}</style>
        </div>
    );
};

export default NodeProgressBar;
