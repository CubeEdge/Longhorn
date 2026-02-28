/**
 * SLA Badge & Timer Components
 * P2 架构升级 - 工单 SLA 可视化
 * 
 * UI 规范 (macOS26 风格)：
 * - Kine Green (#10B981) - 正常状态
 * - Kine Yellow (#FFD700) - 警告状态 (剩余 < 25%)
 * - Kine Red (#EF4444) - 超时状态
 */
import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Priority colors
const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  P0: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: '紧急' },
  P1: { bg: 'rgba(255, 215, 0, 0.15)', text: '#FFD700', label: '高' },
  P2: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', label: '常规' }
};

// SLA status colors
const SLA_STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  normal: { 
    bg: 'rgba(16, 185, 129, 0.15)', 
    text: '#10B981',
    icon: <CheckCircle2 size={14} />
  },
  warning: { 
    bg: 'rgba(255, 215, 0, 0.15)', 
    text: '#FFD700',
    icon: <Clock size={14} />
  },
  breached: { 
    bg: 'rgba(239, 68, 68, 0.15)', 
    text: '#EF4444',
    icon: <AlertTriangle size={14} />
  }
};

interface PriorityBadgeProps {
  priority: 'P0' | 'P1' | 'P2';
  size?: 'sm' | 'md';
}

/**
 * Priority Badge - 优先级标签
 */
export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const config = PRIORITY_COLORS[priority] || PRIORITY_COLORS.P2;
  const padding = size === 'sm' ? '2px 6px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      className="priority-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '6px',
        background: config.bg,
        color: config.text
      }}
    >
      {priority}
    </span>
  );
};

interface SlaStatusBadgeProps {
  slaStatus: 'normal' | 'warning' | 'breached';
  slaDueAt?: string | null;
  showTimer?: boolean;
}

/**
 * SLA Status Badge - SLA 状态标签
 */
export const SlaStatusBadge: React.FC<SlaStatusBadgeProps> = ({ 
  slaStatus, 
  slaDueAt,
  showTimer = false 
}) => {
  const [remainingText, setRemainingText] = useState<string>('');
  const config = SLA_STATUS_COLORS[slaStatus] || SLA_STATUS_COLORS.normal;

  useEffect(() => {
    if (!showTimer || !slaDueAt) return;

    const updateRemaining = () => {
      const due = new Date(slaDueAt);
      const now = new Date();
      const diffMs = due.getTime() - now.getTime();

      if (diffMs <= 0) {
        setRemainingText('已超时');
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setRemainingText(`${days}天${hours % 24}h`);
      } else if (hours > 0) {
        setRemainingText(`${hours}h ${minutes}m`);
      } else {
        setRemainingText(`${minutes}m`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 60000);
    return () => clearInterval(interval);
  }, [slaDueAt, showTimer]);

  const statusLabels: Record<string, string> = {
    normal: '正常',
    warning: '即将超时',
    breached: '已超时'
  };

  return (
    <span
      className="sla-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 500,
        borderRadius: '6px',
        background: config.bg,
        color: config.text
      }}
    >
      {config.icon}
      {showTimer && remainingText ? remainingText : statusLabels[slaStatus]}
    </span>
  );
};

interface SlaTimerProps {
  slaDueAt: string;
  slaStatus: 'normal' | 'warning' | 'breached';
  priority: 'P0' | 'P1' | 'P2';
  showLabel?: boolean;
}

/**
 * SLA Timer - 实时倒计时组件
 */
export const SlaTimer: React.FC<SlaTimerProps> = ({ 
  slaDueAt, 
  slaStatus, 
  priority,
  showLabel = true 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [percentage, setPercentage] = useState<number>(100);

  useEffect(() => {
    const updateTimer = () => {
      const due = new Date(slaDueAt);
      const now = new Date();
      const diffMs = due.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining('已超时');
        setPercentage(0);
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}天 ${hours % 24}:${String(minutes).padStart(2, '0')}`);
      } else {
        setTimeRemaining(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }

      // Estimate total time based on priority
      const totalHours: Record<string, number> = { P0: 36, P1: 72, P2: 168 };
      const total = totalHours[priority] * 3600000;
      setPercentage(Math.min(100, Math.max(0, (diffMs / total) * 100)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [slaDueAt, priority]);

  const statusColor = SLA_STATUS_COLORS[slaStatus]?.text || '#10B981';

  return (
    <div className="sla-timer">
      {showLabel && <span className="sla-timer-label">SLA 剩余</span>}
      <div className="sla-timer-display" style={{ color: statusColor }}>
        <Clock size={14} />
        <span className="sla-timer-value">{timeRemaining}</span>
      </div>
      <div className="sla-timer-bar">
        <div 
          className="sla-timer-fill"
          style={{ 
            width: `${percentage}%`,
            background: statusColor
          }}
        />
      </div>

      <style>{`
        .sla-timer {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 100px;
        }

        .sla-timer-label {
          font-size: 10px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sla-timer-display {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .sla-timer-value {
          min-width: 70px;
        }

        .sla-timer-bar {
          height: 3px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .sla-timer-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 1s linear;
        }
      `}</style>
    </div>
  );
};

interface TicketStatusChipProps {
  currentNode: string;
  ticketType: 'inquiry' | 'rma' | 'svc';
}

// Node label mapping
const NODE_LABELS: Record<string, string> = {
  draft: '草稿',
  in_progress: '处理中',
  waiting_customer: '待客户反馈',
  resolved: '已解决',
  auto_closed: '自动关闭',
  converted: '已升级',
  submitted: '已提交',
  ms_review: 'MS 审核',
  op_receiving: 'OP 收货',
  op_diagnosing: 'OP 诊断',
  op_repairing: 'OP 维修',
  op_qa: 'OP 质检',
  ms_closing: 'MS 结案',
  ge_review: 'GE 审核',
  dl_receiving: 'DL 收货',
  dl_repairing: 'DL 维修',
  dl_qa: 'DL 质检',
  ge_closing: 'GE 结案',
  closed: '已关闭',
  cancelled: '已取消'
};

// Node color mapping
const getNodeColor = (node: string): { bg: string; text: string } => {
  if (['closed', 'resolved', 'auto_closed'].includes(node)) {
    return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' }; // Green
  }
  if (['cancelled'].includes(node)) {
    return { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280' }; // Gray
  }
  if (['waiting_customer'].includes(node)) {
    return { bg: 'rgba(255, 215, 0, 0.15)', text: '#FFD700' }; // Yellow
  }
  if (node.startsWith('op_') || node.startsWith('dl_')) {
    return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' }; // Blue
  }
  return { bg: 'rgba(156, 163, 175, 0.15)', text: '#9CA3AF' }; // Default gray
};

/**
 * Ticket Status Chip - 工单状态标签
 */
export const TicketStatusChip: React.FC<TicketStatusChipProps> = ({ currentNode, ticketType: _ticketType }) => {
  const label = NODE_LABELS[currentNode] || currentNode;
  const colors = getNodeColor(currentNode);

  return (
    <span
      className="status-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '6px',
        background: colors.bg,
        color: colors.text
      }}
    >
      {label}
    </span>
  );
};
