/**
 * Workspace Components (工作空间组件群)
 * P2 架构升级 - macOS26 风格
 */

import React from 'react';
import { 
  Inbox, Clock, AlertTriangle, CheckCircle, 
  Search, User
} from 'lucide-react';

// ==============================
// Types
// ==============================

interface Ticket {
  id: number;
  ticket_number: string;
  ticket_type: 'inquiry' | 'rma' | 'svc';
  current_node: string;
  status: string;
  priority: 'P0' | 'P1' | 'P2';
  sla_status: 'normal' | 'warning' | 'breached';
  sla_due_at: string | null;
  account_name: string;
  reporter_name: string;
  assigned_to: number | null;
  assigned_name: string | null;
  product_name: string;
  serial_number: string;
  problem_summary?: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceFilter {
  view: 'inbox' | 'assigned' | 'all' | 'sla_warning';
  ticket_type?: string;
  status?: string;
  priority?: string;
  search?: string;
}

// ==============================
// Workspace Sidebar
// ==============================

interface WorkspaceSidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  counts: {
    inbox: number;
    assigned: number;
    sla_warning: number;
    all: number;
  };
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  currentView,
  onViewChange,
  counts
}) => {
  const menuItems = [
    { id: 'inbox', icon: Inbox, label: '收件箱', count: counts.inbox },
    { id: 'assigned', icon: User, label: '指派给我', count: counts.assigned },
    { id: 'sla_warning', icon: AlertTriangle, label: 'SLA 告警', count: counts.sla_warning, alert: counts.sla_warning > 0 },
    { id: 'all', icon: CheckCircle, label: '全部工单', count: counts.all }
  ];

  return (
    <div style={{
      width: 220,
      background: 'rgba(30, 30, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      padding: '16px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      {menuItems.map(item => (
        <button
          key={item.id}
          onClick={() => onViewChange(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: currentView === item.id ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
            color: currentView === item.id ? '#FFD700' : '#999',
            cursor: 'pointer',
            transition: 'all 0.2s',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <item.icon size={18} style={{ color: item.alert ? '#EF4444' : 'inherit' }} />
          <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
          {item.count > 0 && (
            <span style={{
              background: item.alert ? '#EF4444' : 'rgba(255,255,255,0.1)',
              color: item.alert ? '#fff' : '#888',
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500
            }}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ==============================
// Workspace Toolbar
// ==============================

interface WorkspaceToolbarProps {
  filter: WorkspaceFilter;
  onFilterChange: (filter: Partial<WorkspaceFilter>) => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  filter,
  onFilterChange
}) => {
  const typeOptions = [
    { value: '', label: '全部' },
    { value: 'inquiry', label: '咨询' },
    { value: 'rma', label: 'RMA' },
    { value: 'svc', label: '经销商维修' }
  ];

  const priorityOptions = [
    { value: '', label: '全部' },
    { value: 'P0', label: 'P0 紧急' },
    { value: 'P1', label: 'P1 高' },
    { value: 'P2', label: 'P2 普通' }
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(30, 30, 30, 0.4)'
    }}>
      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: '8px 12px',
        flex: 1,
        maxWidth: 300
      }}>
        <Search size={16} color="#666" />
        <input
          type="text"
          placeholder="搜索..."
          value={filter.search || ''}
          onChange={e => onFilterChange({ search: e.target.value })}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 14,
            width: '100%'
          }}
        />
      </div>

      {/* Type Filter */}
      <select
        value={filter.ticket_type || ''}
        onChange={e => onFilterChange({ ticket_type: e.target.value })}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '8px 12px',
          color: '#ccc',
          fontSize: 14,
          cursor: 'pointer'
        }}
      >
        {typeOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Priority Filter */}
      <select
        value={filter.priority || ''}
        onChange={e => onFilterChange({ priority: e.target.value })}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '8px 12px',
          color: '#ccc',
          fontSize: 14,
          cursor: 'pointer'
        }}
      >
        {priorityOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

// ==============================
// Ticket List Item
// ==============================

interface TicketListItemProps {
  ticket: Ticket;
  isSelected: boolean;
  onClick: () => void;
}

export const TicketListItem: React.FC<TicketListItemProps> = ({
  ticket,
  isSelected,
  onClick
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return '#EF4444';
      case 'P1': return '#FFD700';
      default: return '#3B82F6';
    }
  };

  const getSlaIndicator = () => {
    if (ticket.sla_status === 'breached') {
      return <AlertTriangle size={14} color="#EF4444" />;
    }
    if (ticket.sla_status === 'warning') {
      return <Clock size={14} color="#FFD700" />;
    }
    return null;
  };

  const getTypeLabel = () => {
    switch (ticket.ticket_type) {
      case 'inquiry': return '咨询';
      case 'rma': return 'RMA';
      case 'svc': return 'SVC';
      default: return ticket.ticket_type;
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: isSelected ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'background 0.15s'
      }}
    >
      {/* Priority indicator */}
      <div style={{
        width: 4,
        height: 40,
        borderRadius: 2,
        background: getPriorityColor(ticket.priority),
        flexShrink: 0
      }} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ 
            fontSize: 13, 
            fontWeight: 600, 
            color: isSelected ? '#FFD700' : '#fff' 
          }}>
            {ticket.ticket_number}
          </span>
          <span style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.1)',
            color: '#888'
          }}>
            {getTypeLabel()}
          </span>
          {getSlaIndicator()}
        </div>

        <div style={{ 
          fontSize: 13, 
          color: '#aaa', 
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {ticket.problem_summary || ticket.reporter_name}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#666' }}>
          <span>{ticket.account_name || ticket.reporter_name}</span>
          <span>·</span>
          <span>{ticket.product_name}</span>
          {ticket.assigned_name && (
            <>
              <span>·</span>
              <span style={{ color: '#10B981' }}>{ticket.assigned_name}</span>
            </>
          )}
        </div>
      </div>

      {/* Time */}
      <div style={{ 
        fontSize: 12, 
        color: '#666',
        flexShrink: 0
      }}>
        {formatRelativeTime(ticket.updated_at)}
      </div>
    </div>
  );
};

// ==============================
// Ticket List
// ==============================

interface TicketListProps {
  tickets: Ticket[];
  selectedId: number | null;
  onSelect: (ticket: Ticket) => void;
  loading?: boolean;
}

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  selectedId,
  onSelect,
  loading
}) => {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
        加载中...
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
        <Inbox size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
        <div>暂无工单</div>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      {tickets.map(ticket => (
        <TicketListItem
          key={ticket.id}
          ticket={ticket}
          isSelected={selectedId === ticket.id}
          onClick={() => onSelect(ticket)}
        />
      ))}
    </div>
  );
};

// ==============================
// Workspace Layout
// ==============================

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  detail?: React.ReactNode;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children,
  sidebar,
  detail
}) => {
  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#1a1a1a'
    }}>
      {sidebar}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        {children}
      </div>
      {detail && (
        <div style={{
          width: 480,
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(30, 30, 30, 0.6)',
          backdropFilter: 'blur(20px)'
        }}>
          {detail}
        </div>
      )}
    </div>
  );
};

// ==============================
// Utilities
// ==============================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default {
  WorkspaceSidebar,
  WorkspaceToolbar,
  TicketList,
  TicketListItem,
  WorkspaceLayout
};
