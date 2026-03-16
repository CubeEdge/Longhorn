/**
 * Ticket Detail Enhancement Components (工单详情页增强)
 * P2 架构升级 - macOS26 风格
 */

import React, { useState } from 'react';
import { MentionCommentInput } from './MentionCommentInput';
import {
  Clock, User, MessageSquare,
  ArrowRight, Plus as PlusIcon, AlertTriangle,
  AtSign, Paperclip, ChevronDown, ChevronRight, UserCheck,
  Edit3, Trash2, X, Wrench, RefreshCw, Package, Truck, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import axios from 'axios';

// ==============================
// Types
// ==============================

interface Activity {
  id: number;
  activity_type: string;
  content: string;
  content_html?: string;
  metadata?: Record<string, unknown>;
  visibility: 'all' | 'internal' | 'op_only';
  actor: {
    id: number;
    name: string;
    role?: string;
  } | null;
  attachments?: Array<{
    id: number;
    file_name: string;
    file_size: number;
    file_type: string;
    file_url: string;
    thumbnail_url?: string | null;
  }>;
  created_at: string;
}

interface Participant {
  user_id: number;
  name?: string;
  role: 'owner' | 'assignee' | 'mentioned' | 'follower';
  added_at: string;
}

// ==============================
// Collapsible Panel
// ==============================

interface CollapsiblePanelProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title, icon, count, defaultOpen = true, headerRight, children
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: 12, marginBottom: 16,
      background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--glass-border)',
      // Remove overflow: hidden to prevent clipping of absolute children like AssigneeSelector or @mentions
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '14px 20px',
          borderBottom: open ? '1px solid var(--glass-border)' : 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-main)', textAlign: 'left',
        }}
      >
        {icon}
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {headerRight}
          {count !== undefined && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 8 }}>
              {count}
            </span>
          )}
          {open ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />}
        </div>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
};

// ==============================
// Field Update Content (审计化修正高亮显示)
// PRD §7.1 - 对比高亮形式呈现字段变更
// ==============================

export interface FieldUpdateMetadata {
  field_name?: string;
  field_label?: string;
  old_value?: unknown;
  new_value?: unknown;
  change_reason?: string;
}

interface FieldUpdateContentProps {
  content: string;
  metadata: FieldUpdateMetadata;
}

const FieldUpdateContent: React.FC<FieldUpdateContentProps> = ({ metadata }) => {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '(空)';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'object') return '(内容)';
    const s = String(value);
    return s.length > 30 ? s.substring(0, 30) + '...' : s;
  };

  const fieldLabel = metadata.field_label || metadata.field_name || '未知字段';
  
  // 过滤无意义的变更：未知字段 且 新旧值都为空
  const isEmptyOld = metadata.old_value === null || metadata.old_value === undefined || metadata.old_value === '';
  const isEmptyNew = metadata.new_value === null || metadata.new_value === undefined || metadata.new_value === '';
  if (fieldLabel === '未知字段' && isEmptyOld && isEmptyNew) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>修改了</span>
      <span style={{ color: 'var(--accent-blue)', fontWeight: 600, background: 'var(--accent-subtle)', padding: '0 4px', borderRadius: '4px' }}>
        {fieldLabel}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--status-red)', textDecoration: 'line-through', fontSize: 12, opacity: 0.7 }}>
          {formatValue(metadata.old_value)}
        </span>
        <ArrowRight size={10} color="var(--text-tertiary)" />
        <span style={{ color: 'var(--status-green)', fontWeight: 500, fontSize: 12 }}>
          {formatValue(metadata.new_value)}
        </span>
      </div>
      {metadata.change_reason && (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', marginLeft: 4 }}>
          [{metadata.change_reason}]
        </span>
      )}
    </div>
  );
};

const DiagnosticReportContent: React.FC<{ metadata: any }> = ({ metadata }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px' }}>
      <span style={{ color: 'var(--status-green)', fontWeight: 600 }}>提交了诊断结果</span>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
        [故障判定: {metadata.diagnosis?.substring(0, 20)}{metadata.diagnosis?.length > 20 ? '...' : ''}]
      </span>
      <span style={{
        fontSize: 10, padding: '1px 6px', borderRadius: 4,
        background: metadata.is_warranty ? 'var(--badge-success-bg)' : 'var(--badge-warning-bg)',
        color: metadata.is_warranty ? 'var(--badge-success-text)' : 'var(--badge-warning-text)',
        border: `1px solid var(--glass-border)`
      }}>
        {metadata.is_warranty ? '保修免费' : '付费/拒保'}
      </span>
    </div>
  );
};

const OpRepairReportContent: React.FC<{ metadata: any }> = ({ metadata }) => {
  // Extract key info from repair report metadata
  const partsCount = metadata?.repair_process?.parts_replaced?.length || 0;
  const actionsCount = metadata?.repair_process?.actions_taken?.length || 0;
  const conclusion = metadata?.conclusion?.summary || metadata?.diagnosis?.findings || '';
  const shortConclusion = conclusion.substring(0, 30) + (conclusion.length > 30 ? '...' : '');

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px' }}>
      <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>提交了维修记录</span>
      {partsCount > 0 && (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>[更换零件: {partsCount}件]</span>
      )}
      {actionsCount > 0 && (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>[维修操作: {actionsCount}项]</span>
      )}
      {shortConclusion && (
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontStyle: 'italic' }}>{shortConclusion}</span>
      )}
    </div>
  );
};

// ==============================
// Activity Timeline (Compact Horizontal Layout)
// ==============================

interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
  onActivityClick?: (activity: Activity) => void;
  ticketId?: number;  // 用于更正API调用
  onRefresh?: () => void;  // 更正后刷新活动列表
  // 关键节点支持
  ticket?: any;  // 工单数据（用于检测节点完成状态）
  onKeyNodeClick?: (nodeType: 'op_receive' | 'op_shipping' | 'ms_review' | 'ms_closing') => void;
}

// ==============================
// Image Lightbox
// ==============================

interface MediaLightboxProps {
  url: string | null;
  type?: 'image' | 'video' | null;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ url, type = 'image', onClose }) => {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 20
          }}
        >
          {type === 'video' ? (
            <video
              src={url}
              controls
              autoPlay
              style={{
                maxWidth: '90%', maxHeight: '90%', borderRadius: 12,
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                objectFit: 'contain'
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <motion.img
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              src={url}
              style={{
                maxWidth: '100%', maxHeight: '100%', borderRadius: 12,
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                objectFit: 'contain'
              }}
              onClick={e => e.stopPropagation()}
            />
          )}

          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 30, right: 30,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%', width: 44, height: 44,
              color: 'var(--text-main)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 2001
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  loading,
  onActivityClick,
  ticket,
  onKeyNodeClick,
  // ticketId and onRefresh are used by ActivityDetailDrawer, kept in props for consistency
}) => {
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [showSystemEvents, setShowSystemEvents] = useState(false);
  const { token, user } = useAuthStore();
  void token; // suppress unused warning, used for thumbnail URLs
  void onKeyNodeClick; // 保留接口兼容性，关键节点现在通过 onActivityClick 处理

  // Define activity type categories
  // Key outputs: user-driven important outputs that should appear in "讨论与关键节点"
  const COMMENT_TYPES = ['comment', 'diagnostic_report', 'op_repair_report'];
  const KEY_OUTPUT_TYPES = ['document_published', 'document_recalled']; // PI/维修报告发布撤回
  const SYSTEM_TYPES = ['status_change', 'assignment_change', 'field_update', 'system_event', 'creation', 'assignment', 'priority_change', 'soft_delete'];

  // Filter out standalone 'mention' type activities (merged into comments now)
  const filteredActivities = activities.filter(a => a.activity_type !== 'mention');

  // Helper to check if a comment is a key output (logistics, repair content, etc.)
  // These should appear in "讨论与关键节点" not "系统变更"
  const isKeyOutputComment = (activity: Activity): boolean => {
    if (activity.activity_type !== 'comment') return false;
    const content = activity.content || '';
    // Match key output patterns: 物流信息、收发货、维修内容等
    return /^【(货代中转|完成收货|发货|入库|物流|快递)/.test(content) ||
           /^【.*发出.*件/.test(content) ||
           /(单号|快递|物流|收货|发货)/.test(content);
  };

  // ====== 关键节点检测与生成 ======
  // 辅助函数：从活动中查找特定节点的操作人
  const findNodeTransitionActor = (fromNode: string, toNode: string): Activity | undefined => {
    // 优先查找 status_change 活动，记录节点转换
    return activities.find(a => {
      if (a.activity_type === 'status_change' && a.metadata) {
        const meta = a.metadata as any;
        return (meta.from_node === fromNode && meta.to_node === toNode) ||
               (meta.from_status === fromNode && meta.to_status === toNode);
      }
      return false;
    });
  };

  // 解析 final_settlement JSON 字符串
  const parseFinalSettlement = (data: any): Record<string, any> => {
    if (!data) return {};
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        return {};
      }
    }
    return data;
  };

  // 生成关键节点的虚拟活动条目
  // 重要：关键节点时间应使用最新变更时间，而非第一次提交时间
  const generateKeyNodeActivities = (): Activity[] => {
    if (!ticket) return [];
    const keyNodes: Activity[] = [];
    const rmaFlow = ['submitted', 'op_receiving', 'op_diagnosing', 'ms_review', 'op_repairing', 'ms_closing', 'op_shipping', 'op_shipping_transit', 'resolved'];
    const currentIndex = rmaFlow.indexOf(ticket.current_node);
    
    // 辅助函数：从活动列表中找到所有匹配条件的活动，取最新的一个
    // 注意：activities 已按 created_at DESC 排序，所以第一个就是最新的
    const findLatestActivity = (predicate: (a: Activity) => boolean): Activity | undefined => {
      return activities.find(predicate);
    };

    // 1. OP 收货信息（op_receiving/submitted → op_diagnosing 之后）
    if (currentIndex > rmaFlow.indexOf('op_receiving')) {
      // 从活动中找到收货信息（优先专用类型，其次节点转换）- 取最新的
      const receiveActivity = findLatestActivity(a => a.activity_type === 'receiving_info') ||
                              findNodeTransitionActor('op_receiving', 'op_diagnosing') ||
                              findNodeTransitionActor('submitted', 'op_diagnosing');
      keyNodes.push({
        id: -1001,
        activity_type: 'key_node_op_receive',
        content: '完成收货入库',
        created_at: receiveActivity?.created_at || ticket.updated_at || ticket.created_at,
        actor: receiveActivity?.actor || null,
        visibility: 'internal',
        metadata: { 
          node_type: 'op_receive',
          original_activity_id: receiveActivity?.id,
          ...(receiveActivity?.activity_type === 'receiving_info' ? (receiveActivity?.metadata || {}) : {})
        }
      } as Activity);
    }

    // 2. MS 审核信息（ms_review 完成后）
    if (ticket.ms_review || currentIndex > rmaFlow.indexOf('ms_review')) {
      // 查找审核操作人：优先 field_update(ms_review)，其次节点转换 - 取最新的
      const reviewActivity = findLatestActivity(a => 
        a.activity_type === 'field_update' && (a.metadata as any)?.field_name === 'ms_review'
      ) || findNodeTransitionActor('ms_review', 'op_repairing');
      
      // ms_review 的实际字段映射（处理JSON字符串情况）
      let msReviewData: any = {};
      if (ticket.ms_review) {
        msReviewData = typeof ticket.ms_review === 'string' 
          ? JSON.parse(ticket.ms_review) 
          : ticket.ms_review;
      }
      
      // 映射保修决策：warranty_valid -> in_warranty, warranty_expired/warranty_void_damage -> out_warranty
      const warrantyDecision = msReviewData.final_decision === 'warranty_valid' 
        ? 'in_warranty' 
        : (msReviewData.final_decision === 'warranty_expired' || msReviewData.final_decision === 'warranty_void_damage' 
          ? 'out_warranty' 
          : msReviewData.final_decision);
      
      keyNodes.push({
        id: -1002,
        activity_type: 'key_node_ms_review',
        content: '完成商务审核',
        created_at: reviewActivity?.created_at || ticket.updated_at || ticket.created_at,
        actor: reviewActivity?.actor || null,
        visibility: 'internal',
        metadata: { 
          node_type: 'ms_review', 
          sensitive: true,
          // 映射实际字段名
          warranty_decision: warrantyDecision,
          charge_decision: msReviewData.final_decision === 'warranty_valid' ? 'free' : 'charge',
          estimated_cost: msReviewData.estimated_cost_max || msReviewData.estimated_cost_min,
          customer_confirmed: msReviewData.customer_confirmed,
          review_notes: msReviewData.decision_remark
        }
      } as Activity);
    }

    // 3. MS 结案信息（ms_closing 完成后）
    if (ticket.final_settlement || currentIndex > rmaFlow.indexOf('ms_closing')) {
      // 查找结案操作人：优先 field_update(final_settlement)，其次节点转换 - 取最新的
      const closingActivity = findLatestActivity(a => 
        a.activity_type === 'field_update' && (a.metadata as any)?.field_name === 'final_settlement'
      ) || findNodeTransitionActor('ms_closing', 'op_shipping');
      
      // 解析 final_settlement
      const settlementData = parseFinalSettlement(ticket.final_settlement);
      keyNodes.push({
        id: -1003,
        activity_type: 'key_node_ms_closing',
        content: '完成结案确认',
        created_at: closingActivity?.created_at || ticket.updated_at || ticket.created_at,
        actor: closingActivity?.actor || null,
        visibility: 'internal',
        metadata: { 
          node_type: 'ms_closing', 
          sensitive: true,
          // 映射实际字段名
          settlement_type: settlementData.shipping_combine === 'standalone' ? '独立发货' : 
                          (settlementData.shipping_combine === 'with_order' ? '随订单发货' : '随其他RMA'),
          payment_confirmed: settlementData.payment_confirmed,
          actual_payment: settlementData.actual_payment,
          closing_notes: settlementData.handover_notes
        }
      } as Activity);
    }

    // 4. OP 发货信息（op_shipping 完成后）
    if (currentIndex >= rmaFlow.indexOf('resolved') || ticket.current_node === 'op_shipping_transit') {
      // 从活动中找到发货信息 - 取最新的
      const shippingActivity = findLatestActivity(a => a.activity_type === 'shipping_info');
      keyNodes.push({
        id: -1004,
        activity_type: 'key_node_op_shipping',
        content: shippingActivity ? '发货信息已录入' : '完成发货',
        created_at: shippingActivity?.created_at || ticket.updated_at || ticket.created_at,
        actor: shippingActivity?.actor || null,
        visibility: 'internal',
        metadata: { 
          node_type: 'op_shipping',
          shipping_method: ticket.shipping_method,
          ...(shippingActivity?.metadata || {})
        }
      } as Activity);
    }

    return keyNodes;
  };

  const keyNodeActivities = generateKeyNodeActivities();

  // 检查是否有权限编辑关键节点（保留用于未来扩展）
  // 权限规则：原操作人 / Admin/Exec / 对应部门Lead
  const canEditKeyNode = (nodeType: string, activityActorId?: number): boolean => {
    if (!user) return false;
    
    // 1. Admin/Exec 始终可以编辑
    const isAdmin = user.role === 'Admin' || user.role === 'Exec';
    if (isAdmin) return true;
    
    // 2. 原操作人可以编辑
    if (activityActorId && activityActorId === user.id) return true;
    
    // 3. 对应部门 Lead 可以编辑
    const userDept = (user.department_code || '').toUpperCase();
    const isOpLead = user.role === 'Lead' && (userDept === 'OP' || userDept === 'PRODUCTION');
    const isMsLead = user.role === 'Lead' && userDept === 'MS';
    
    if (nodeType === 'op_receive' || nodeType === 'op_shipping') {
      return isOpLead;
    }
    if (nodeType === 'ms_review' || nodeType === 'ms_closing') {
      return isMsLead;
    }
    return false;
  };
  void canEditKeyNode; // 保留用于未来扩展，权限检查现在在 ActivityDetailDrawer 内部进行

  // Helper to check if a comment is a pure system operation (status changes, etc.)
  const isSystemOperationComment = (activity: Activity): boolean => {
    if (activity.activity_type !== 'comment') return false;
    if (isKeyOutputComment(activity)) return false; // Key outputs are not system events
    const content = activity.content || '';
    // Only match pure system operations like state transitions
    return /^【(状态|指派|节点|系统)/.test(content);
  };

  // Helper: 判断是否为"创建工单"事件（应显示在关键节点）
  const isCreationEvent = (a: Activity) => 
    a.activity_type === 'system_event' && (a.metadata as any)?.event_type === 'creation';

  // Split activities into comments/key outputs and system events
  const regularCommentActivities = filteredActivities.filter(a => 
    COMMENT_TYPES.includes(a.activity_type) ||
    KEY_OUTPUT_TYPES.includes(a.activity_type) ||
    isKeyOutputComment(a) ||
    isCreationEvent(a)  // 创建工单事件显示在关键节点
  ).filter(a => !isSystemOperationComment(a));
  
  // 辅助函数：安全解析日期字符串（支持 ISO 和 SQLite 格式）
  const parseDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    // 处理 SQLite 格式 "YYYY-MM-DD HH:MM:SS"
    const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const finalStr = (isoStr.endsWith('Z') || isoStr.includes('+')) ? isoStr : isoStr + 'Z';
    const d = new Date(finalStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  
  // 合并关键节点活动到评论活动中，按时间严格倒序排序
  const commentActivities = [...regularCommentActivities, ...keyNodeActivities]
    .sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));
  
  const systemActivities = filteredActivities.filter(a => 
    (SYSTEM_TYPES.includes(a.activity_type) && !isCreationEvent(a)) ||  // 排除创建工单事件
    isSystemOperationComment(a)
  );
  const getVisibilityBadge = (visibility: string) => {
    if (visibility === 'all') return null;
    return (
      <span style={{
        fontSize: 10,
        padding: '1px 5px',
        borderRadius: 3,
        background: visibility === 'internal' ? 'rgba(255,215,0,0.2)' : 'rgba(239,68,68,0.2)',
        color: visibility === 'internal' ? '#FFD700' : '#EF4444',
        fontWeight: 600,
        lineHeight: '16px',
      }}>
        {visibility === 'internal' ? '内部' : '仅OP'}
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare size={12} />;
      case 'status_change': return <ArrowRight size={12} />;
      case 'creation': case 'system_event': return <PlusIcon size={12} />;
      case 'assignment': case 'assignment_change': return <UserCheck size={12} />;
      case 'priority_change': return <AlertTriangle size={12} />;
      case 'mention': return <AtSign size={12} />;
      case 'attachment': return <Paperclip size={12} />;
      case 'field_update': return <Edit3 size={12} />;
      case 'diagnostic_report': return <Wrench size={12} />;
      case 'op_repair_report': return <Wrench size={12} />;
      case 'soft_delete': return <Trash2 size={12} />;
      // 关键节点图标
      case 'key_node_op_receive': return <Package size={12} />;
      case 'key_node_op_shipping': return <Truck size={12} />;
      case 'key_node_ms_review': return <CheckCircle size={12} />;
      case 'key_node_ms_closing': return <CheckCircle size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'comment': return '#10B981'; // Kine Green for comments
      case 'status_change': return '#3B82F6'; // Kine Blue for system events
      case 'creation': case 'system_event': return '#3B82F6'; // Kine Blue for system events
      case 'assignment': case 'assignment_change': return '#FFD700';
      case 'priority_change': return '#FFD200';
      case 'mention': return '#8B5CF6';
      case 'field_update': return '#FFD700';
      case 'diagnostic_report': return '#10B981';
      case 'op_repair_report': return '#FFD200'; // Kine Yellow for OP repair report
      case 'soft_delete': return '#EF4444';
      default: return '#666';
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>;
  }

  const renderActivityItem = (activity: Activity) => {
    const isSystemOpComment = isSystemOperationComment(activity);
    const displayType = isSystemOpComment ? 'system_event' : activity.activity_type;
    const color = getTypeColor(displayType);
    const isFieldUpdate = activity.activity_type === 'field_update';
    const actorName = activity.actor?.name || '系统';
    const formattedDate = formatFullDateTime(activity.created_at);
    
    // 检测是否为系统自动事件（不显示操作人）
    // 注：创建工单是用户操作，应该显示操作人
    const isAutoSystemEvent = SYSTEM_TYPES.includes(activity.activity_type) || isSystemOpComment;
    const isCreationEvent = activity.activity_type === 'system_event' && 
                            (activity.metadata as any)?.event_type === 'creation';
    // 创建工单事件应该显示操作人
    const isSystemEvent = isAutoSystemEvent && !isCreationEvent;
    
    // 检测是否为关键节点活动
    const isKeyNode = activity.activity_type.startsWith('key_node_');
    const keyNodeType = activity.metadata?.node_type as 'op_receive' | 'op_shipping' | 'ms_review' | 'ms_closing' | undefined;
    
    // 检测是否为重要节点（需要 Kine Yellow 圆环标记）
    const isImportantNode = isKeyNode || 
      activity.activity_type === 'op_repair_report' || 
      activity.activity_type === 'diagnostic_report' ||
      activity.activity_type === 'creation';

    // 关键节点渲染 - 改为和普通活动类似的格式，点击打开侧滑详情
    if (isKeyNode && keyNodeType) {
      const nodeActionLabels: Record<string, string> = {
        'op_receive': '完成了收货入库',
        'op_shipping': '完成了发货',
        'ms_review': '完成了商务审核',
        'ms_closing': '完成了结案确认'
      };
      const nodeColors: Record<string, string> = {
        'op_receive': '#3B82F6',
        'op_shipping': '#10B981',
        'ms_review': '#F59E0B',
        'ms_closing': '#8B5CF6'
      };
      const nodeColor = nodeColors[keyNodeType] || '#888';
      const nodeActorName = activity.actor?.name || '系统';
      const meta = activity.metadata as any;

      // 生成详细内容说明
      const getDetailSummary = (): string => {
        switch (keyNodeType) {
          case 'op_receive': {
            const parts: string[] = [];
            // 兼容新旧字段名
            if (meta.at_receipt_sn) parts.push(`修正SN: ${meta.at_receipt_sn}`);
            const notes = meta.receipt_notes || meta.notes;
            if (notes) parts.push(notes.length > 20 ? notes.substring(0, 20) + '...' : notes);
            return parts.length > 0 ? parts.join('，') : '';
          }
          case 'op_shipping': {
            const parts: string[] = [];
            // 发货方式映射
            const methodMap: Record<string, string> = {
              'express': '快递直发',
              'forwarder': '货代中转',
              'pickup': '客户自提',
              'combined': '合并发货'
            };
            if (meta.shipping_method) {
              parts.push(methodMap[meta.shipping_method] || meta.shipping_method);
            }
            // 兼容 carrier 和 shipping_carrier
            const carrier = meta.carrier || meta.shipping_carrier;
            if (carrier) parts.push(carrier);
            if (meta.tracking_number) parts.push(meta.tracking_number);
            // 货代中转显示货代名
            if (meta.shipping_method === 'forwarder' && meta.forwarder_name) {
              parts.push(meta.forwarder_name);
            }
            // 自提显示提货人
            if (meta.shipping_method === 'pickup' && meta.pickup_person) {
              parts.push(meta.pickup_person);
            }
            return parts.join(' ');
          }
          case 'ms_review': {
            const parts: string[] = [];
            if (meta.warranty_decision) {
              parts.push(meta.warranty_decision === 'in_warranty' ? '在保' : (meta.warranty_decision === 'out_warranty' ? '保外' : meta.warranty_decision));
              if (meta.charge_decision) parts.push(meta.charge_decision === 'free' ? '免费' : '收费');
            }
            if (meta.customer_confirmed) parts.push('客户已确认');
            return parts.join('，');
          }
          case 'ms_closing': {
            const parts: string[] = [];
            if (meta.settlement_type) parts.push(meta.settlement_type);
            if (meta.final_cost !== undefined && meta.final_cost > 0) parts.push(`¥${meta.final_cost}`);
            return parts.join('，');
          }
          default:
            return '';
        }
      };

      const detailSummary = getDetailSummary();

      return (
        <div
          key={activity.id}
          onClick={() => onActivityClick && onActivityClick(activity)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '6px',
            transition: 'background 0.2s',
            cursor: onActivityClick ? 'pointer' : 'default',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {/* Meta: Time & Kine Yellow ring (无icon) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', minWidth: '80px', whiteSpace: 'nowrap' }}>
              {formattedDate}
            </span>
            {/* Kine Yellow 圆环标记 - 只显示圆环，不显示icon */}
            <div style={{ 
              width: 18, height: 18,
              borderRadius: '50%',
              border: '2px solid #FFD700',
              opacity: 0.9
            }} />
          </div>

          {/* Main Body */}
          <div style={{ flex: 1, minWidth: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0, fontSize: 13 }}>{nodeActorName}</span>
            <span style={{ 
              color: nodeColor, 
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              {nodeActionLabels[keyNodeType]}
            </span>
            {/* 详细内容说明 */}
            {detailSummary && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                [{detailSummary}]
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={activity.id}
        onClick={() => onActivityClick && onActivityClick(activity)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: '6px',
          transition: 'background 0.2s',
          borderLeft: isFieldUpdate ? `2px solid ${color}44` : 'none',
          cursor: onActivityClick ? 'pointer' : 'default',
          opacity: isSystemEvent ? 0.85 : 1
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Meta: Time & Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', minWidth: '80px', whiteSpace: 'nowrap' }}>
            {formattedDate}
          </span>
          {/* 重要节点（维修记录、诊断报告）显示 Kine Yellow 空心圆环标记 */}
          {isImportantNode && !isKeyNode ? (
            <div style={{ 
              width: 18, height: 18,
              borderRadius: '50%',
              border: '2px solid #FFD700',
              opacity: 0.9
            }} />
          ) : (
            <span style={{ color, display: 'flex', alignItems: 'center', opacity: 0.8 }}>
              {getTypeIcon(displayType)}
            </span>
          )}
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, minWidth: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
            {/* 系统事件不显示操作人姓名；document_published/document_recalled 的 content 已包含操作人名字，不重复显示 */}
            {!isSystemEvent && !KEY_OUTPUT_TYPES.includes(activity.activity_type) && <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0, fontSize: 13 }}>{actorName}</span>}

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
              {getVisibilityBadge(activity.visibility)}

              {activity.activity_type === 'field_update' && activity.metadata ? (
                <FieldUpdateContent
                  content={activity.content || ''}
                  metadata={activity.metadata as FieldUpdateMetadata}
                />
              ) : activity.activity_type === 'diagnostic_report' && activity.metadata ? (
                <DiagnosticReportContent metadata={activity.metadata as any} />
              ) : activity.activity_type === 'op_repair_report' && activity.metadata ? (
                <OpRepairReportContent metadata={activity.metadata as any} />
              ) : (
                <div
                  style={{ color: isSystemEvent ? 'var(--text-tertiary)' : 'var(--text-secondary)', wordBreak: 'break-word', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}
                  dangerouslySetInnerHTML={{
                    __html: (activity.content_html || activity.content || '').replace(/<[^>]+>/g, ' ')
                  }}
                />
              )}

              {/* Attachments Icon Indicator */}
              {activity.attachments && activity.attachments.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
                  <Paperclip size={12} color="#666" />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{activity.attachments.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Attachment Links have been moved to the Detail Drawer */}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '8px 4px 16px' }}>
      {filteredActivities.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>暂无活动记录</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Comments Section - Always shown and expanded */}
          {commentActivities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#3B82F6',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <MessageSquare size={12} />
                讨论与关键节点 ({commentActivities.length})
              </div>
              {commentActivities.map(renderActivityItem)}
            </div>
          )}

          {/* System Events Section - Collapsible */}
          {systemActivities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                onClick={() => setShowSystemEvents(!showSystemEvents)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'color 0.2s',
                  width: '100%'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#888'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}
              >
                <Clock size={12} />
                <span style={{ flex: 1 }}>系统变更 ({systemActivities.length})</span>
                {showSystemEvents ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {showSystemEvents && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {systemActivities.map(renderActivityItem)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <MediaLightbox url={lightboxMedia?.url || null} type={lightboxMedia?.type || null} onClose={() => setLightboxMedia(null)} />
    </div>
  );
};

// ==============================
// Comment Input
// ==============================

export const CommentInput = MentionCommentInput;

// ==============================
// Participants Panel
// ==============================

interface ParticipantsPanelProps {
  participants: Participant[];
  owner?: { id: number; name: string };
  assignee?: { id: number; name: string };
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  participants,
  owner,
  assignee
}) => {
  const getRoleBadge = (role: string) => {
    const roles: Record<string, { color: string; label: string }> = {
      owner: { color: '#FFD700', label: '创建者' },
      assignee: { color: '#10B981', label: '对接人' },
      mentioned: { color: '#3B82F6', label: '协作中' },
      follower: { color: '#8B5CF6', label: '关注者' }
    };
    const r = roles[role] || { color: 'var(--text-tertiary)', label: role };
    return (
      <span style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: `${r.color}20`,
        color: r.color,
        fontWeight: 600,
      }}>
        {r.label}
      </span>
    );
  };

  const allParticipants: { id: number; name: string; role: string }[] = [];

  if (owner) allParticipants.push({ id: owner.id, name: owner.name, role: 'owner' });
  if (assignee && (!owner || assignee.id !== owner.id)) {
    allParticipants.push({ id: assignee.id, name: assignee.name, role: 'assignee' });
  }

  if (participants && participants.length > 0) {
    participants.forEach(p => {
      if (!allParticipants.some(x => x.id === p.user_id)) {
        allParticipants.push({
          id: p.user_id,
          name: p.name || `User #${p.user_id}`,
          role: p.role
        });
      }
    });
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: 'var(--text-main)',
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12,
      }}>
        <User size={16} color="#FFD700" />
        协作成员
        <span style={{ color: '#666', fontWeight: 400, fontSize: 13 }}>({allParticipants.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {allParticipants.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 8px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,215,0,0.15)', color: '#FFD700',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 500,
            }}>
              {p.name[0]?.toUpperCase() || '?'}
            </div>
            <span style={{ fontSize: 13, color: '#ddd', fontWeight: 500 }}>{p.name}</span>
            {getRoleBadge(p.role)}
          </div>
        ))}
      </div>
      {allParticipants.length === 0 && (
        <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: 12 }}>暂无</div>
      )}
    </div>
  );
};

// ==============================
// Ticket Info Card
// ==============================

interface TicketInfoCardProps {
  ticket: {
    ticket_number: string;
    ticket_type: string;
    priority: string;
    sla_status: string;
    sla_due_at: string | null;
    current_node: string;
    account_name: string;
    product_name: string;
    serial_number: string;
    is_warranty?: boolean;
    created_at: string;
  };
}

export const TicketInfoCard: React.FC<TicketInfoCardProps> = ({ ticket }) => {
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'P0': return '#EF4444';
      case 'P1': return '#FFD700';
      case 'P2': return '#3B82F6';
      default: return '#9CA3AF';
    }
  };

  return (
    <div style={{
      background: 'rgba(30, 30, 30, 0.5)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
          {ticket.ticket_number}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: `${getPriorityColor(ticket.priority)}15`,
          color: getPriorityColor(ticket.priority),
        }}>
          {ticket.priority}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
        <div style={{ color: 'var(--text-tertiary)' }}>客户: <span style={{ color: '#ccc' }}>{ticket.account_name || '-'}</span></div>
        <div style={{ color: 'var(--text-tertiary)' }}>产品: <span style={{ color: '#ccc' }}>{ticket.product_name || '-'}</span></div>
        <div style={{ color: 'var(--text-tertiary)' }}>SN: <span style={{ color: '#ccc' }}>{ticket.serial_number || '-'}</span></div>
        <div style={{ color: 'var(--text-tertiary)' }}>创建: <span style={{ color: '#ccc' }}>{formatDate(ticket.created_at)}</span></div>
      </div>
    </div>
  );
};

// ==============================
// Utilities
// ==============================



function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  // Ensure SQLite datetime string is parsed as UTC
  const safeStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(safeStr.endsWith('Z') || safeStr.includes('+') ? safeStr : safeStr + 'Z');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}

function formatFullDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  // Ensure SQLite datetime string is parsed as UTC
  const safeStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  // Add 'Z' if no timezone info, but be careful not to double-add
  const finalStr = (safeStr.endsWith('Z') || safeStr.includes('+')) ? safeStr : safeStr + 'Z';

  const d = new Date(finalStr);
  if (isNaN(d.getTime())) return dateStr;

  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();

  if (isToday) return `${h}:${min}`;
  if (isThisYear) return `${m}-${day} ${h}:${min}`;
  return `${d.getFullYear().toString().slice(-2)}-${m}-${day} ${h}:${min}`;
}


// ==============================
// Activity Detail Drawer
// ==============================

// 更正请求的类型
export interface CorrectionRequest {
  activityId: number;
  activityType: string;
  reason: string;
  originalContent?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityDetailDrawerProps {
  activity: Activity | null;
  onClose: () => void;
  ticketId?: number;  // 用于更正API调用
  ticket?: any;  // 完整的工单数据，用于读取客户/产品信息
  onRefresh?: () => void;  // 更正后刷新活动列表
  onCorrectionRequest?: (request: CorrectionRequest) => void;  // 请求打开完整编辑器进行更正
  onKeyNodeCorrectionRequest?: (nodeType: 'op_receive' | 'op_shipping' | 'ms_review' | 'ms_closing', reason: string) => void;  // 关键节点更正请求
}

export const ActivityDetailDrawer: React.FC<ActivityDetailDrawerProps> = ({
  activity,
  onClose,
  ticketId,
  ticket,
  onRefresh,
  onCorrectionRequest,
  onKeyNodeCorrectionRequest
}) => {
  const { token, user } = useAuthStore();
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  
  // 更正功能状态
  const [correctionModal, setCorrectionModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctedContent, setCorrectedContent] = useState('');  // 编辑后的内容（仅用于简单类型）
  const [correcting, setCorrecting] = useState(false);

  // 判断是否为复杂类型（需要打开完整编辑器）
  const isComplexActivityType = (type: string): boolean => {
    return ['op_repair_report', 'diagnostic_report'].includes(type);
  };

  // 判断是否为关键节点
  const isKeyNodeActivity = activity?.activity_type.startsWith('key_node_') || false;
  const keyNodeType = activity?.metadata?.node_type as 'op_receive' | 'op_shipping' | 'ms_review' | 'ms_closing' | undefined;

  // 检查是否可以更正关键节点
  const canCorrectKeyNode = (nodeType: string): boolean => {
    if (!user) return false;
    
    // 1. Admin/Exec 始终可以编辑
    const isAdmin = user.role === 'Admin' || user.role === 'Exec';
    if (isAdmin) return true;
    
    // 2. 原操作人可以编辑
    if (activity?.actor?.id && activity.actor.id === user.id) return true;
    
    // 3. 对应部门 Lead 可以编辑
    const userDept = (user.department_code || '').toUpperCase();
    const isOpLead = user.role === 'Lead' && (userDept === 'OP' || userDept === 'PRODUCTION');
    const isMsLead = user.role === 'Lead' && userDept === 'MS';
    
    if (nodeType === 'op_receive' || nodeType === 'op_shipping') {
      return isOpLead;
    }
    if (nodeType === 'ms_review' || nodeType === 'ms_closing') {
      return isMsLead;
    }
    return false;
  };

  // 处理关键节点更正请求
  const handleKeyNodeCorrection = () => {
    if (!keyNodeType || !correctionReason.trim() || !onKeyNodeCorrectionRequest) return;
    onKeyNodeCorrectionRequest(keyNodeType, correctionReason.trim());
    setCorrectionModal(false);
    setCorrectionReason('');
    onClose();
  };

  // 打开更正弹窗时初始化内容
  const openCorrectionModal = () => {
    setCorrectionModal(true);
    setCorrectedContent(activity?.content || '');
    setCorrectionReason('');
  };

  // 检查是否可以更正创建工单活动
  const canCorrectCreation = (): boolean => {
    if (!user || !activity) return false;
    // Admin/Exec 始终可以更正
    if (user.role === 'Admin' || user.role === 'Exec') return true;
    // MS Lead 可以更正
    const userDept = (user.department_code || '').toUpperCase();
    if (user.role === 'Lead' && userDept === 'MS') return true;
    // 原操作人可以更正
    if (activity.actor?.id && activity.actor.id === user.id) return true;
    return false;
  };

  // 检查是否可以更正活动（权限检查）
  const canCorrectActivity = (act: Activity): boolean => {
    if (!user || !ticketId) return false;
    const correctableTypes = ['op_repair_report', 'diagnostic_report', 'shipping_info', 'comment', 'internal_note'];
    if (!correctableTypes.includes(act.activity_type)) return false;
    
    // 判断活动类型属于哪个部门
    const getActivityDepartment = (actType: string): 'OP' | 'MS' | 'unknown' => {
      if (['op_repair_report', 'diagnostic_report'].includes(actType)) {
        return 'OP';  // 维修记录和诊断报告属于 OP 部门
      }
      // 其他类型根据 actor 的部门判断
      return 'unknown';
    };
    
    const activityDept = getActivityDepartment(act.activity_type);
    const userDept = (user.department_code || '').toUpperCase();
    
    // 权限检查：
    // 1. 原操作人始终可以更正自己的内容
    const isOriginalActor = act.actor?.id === user.id;
    if (isOriginalActor) return true;
    
    // 2. Admin/Exec 可以更正所有内容
    const isAdmin = user.role === 'Admin' || user.role === 'Exec';
    if (isAdmin) return true;
    
    // 3. Lead 只能更正本部门的内容
    if (user.role === 'Lead') {
      // 如果活动类型有明确的部门归属（如维修记录属于OP）
      if (activityDept !== 'unknown') {
        // 用户部门必须匹配活动部门
        const userDeptNorm = userDept === 'PRODUCTION' ? 'OP' : userDept;
        return userDeptNorm === activityDept;
      }
      
      // 其他类型（comment, internal_note, shipping_info）：不允许 Lead 修改他人内容
      // 只能由原操作人或 Admin/Exec 修改
      return false;
    }
    
    return false;
  };

  // 处理更正提交（简单类型直接提交，复杂类型请求打开编辑器）
  const handleCorrection = async () => {
    if (!activity || !ticketId || !correctionReason.trim()) return;
    
    // 复杂类型：请求父组件打开完整编辑器
    if (isComplexActivityType(activity.activity_type)) {
      if (onCorrectionRequest) {
        onCorrectionRequest({
          activityId: activity.id,
          activityType: activity.activity_type,
          reason: correctionReason.trim(),
          originalContent: activity.content,
          metadata: activity.metadata
        });
        setCorrectionModal(false);
        setCorrectionReason('');
        onClose();
      }
      return;
    }
    
    // 简单类型：直接提交更正
    setCorrecting(true);
    try {
      await axios.post(
        `/api/v1/tickets/${ticketId}/activities/${activity.id}/correct`,
        {
          corrections: [{ 
            field_path: 'content', 
            old_value: activity.content, 
            new_value: correctedContent.trim() 
          }],
          correction_reason: correctionReason.trim(),
          new_content: correctedContent.trim()  // 直接传递新内容
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCorrectionModal(false);
      setCorrectionReason('');
      setCorrectedContent('');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || '更正失败');
    } finally {
      setCorrecting(false);
    }
  };

  if (!activity) return null;

  return (
    <>
      {/* Overlay - click to close */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 60, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 998
        }}
      />
      <div style={{
        position: 'fixed',
        top: 60, right: 0, bottom: 0, width: 400,
        background: 'var(--modal-bg)',
        backdropFilter: 'blur(20px)',
        boxShadow: 'var(--glass-shadow-lg)',
        borderLeft: '1px solid var(--drawer-border)',
        zIndex: 999,
        display: 'flex', flexDirection: 'column',
        transform: 'translateX(0)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--drawer-border)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>详情</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* User Info - 系统事件不显示操作人；document_published/document_recalled 应显示实际发布者 */}
          {(() => {
            // 注意：document_published/document_recalled 虽然是系统记录的事件，但应显示实际发布者
            const isSystemEvent = ['status_change', 'assignment', 'assignment_change', 'field_update', 'system_event'].includes(activity.activity_type);
            return isSystemEvent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontWeight: 600, fontSize: 14 }}>
                  S
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-tertiary)' }}>系统</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(activity.created_at).toLocaleString('zh-CN')}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 600, fontSize: 14 }}>
                  {activity.actor?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{activity.actor?.name || 'System'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(activity.created_at).toLocaleString('zh-CN')}</div>
                </div>
              </div>
            );
          })()}

          {/* 通用更正入口 - 针对可更正但没有专门渲染区域的活动类型（如comment、internal_note） */}
          {['comment', 'internal_note'].includes(activity.activity_type) && canCorrectActivity(activity) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,165,0,0.03)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.1)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {(activity.metadata as any)?._correction_count > 0 && (
                  <span style={{ color: 'var(--accent-orange, #FFA500)' }}>已更正 {(activity.metadata as any)._correction_count}次 · </span>
                )}
                发现数据错误？可申请更正
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); openCorrectionModal(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11,
                  background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)',
                  borderRadius: 4, color: 'var(--accent-orange, #FFA500)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,165,0,0.1)'}
              >
                <RefreshCw size={12} /> 更正
              </button>
            </div>
          )}

          {/* 关键节点详情 */}
          {isKeyNodeActivity && keyNodeType && (() => {
            const meta = activity.metadata as any;
            const nodeLabels: Record<string, string> = {
              'op_receive': '收货入库',
              'op_shipping': '发货信息',
              'ms_review': '商务审核',
              'ms_closing': '结案确认'
            };
            const nodeColors: Record<string, string> = {
              'op_receive': '#3B82F6',
              'op_shipping': '#10B981',
              'ms_review': '#F59E0B',
              'ms_closing': '#8B5CF6'
            };
            const nodeColor = nodeColors[keyNodeType] || '#888';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header with Correction Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, 
                    color: nodeColor, fontWeight: 600, fontSize: 14 
                  }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6,
                      background: `${nodeColor}20`, fontSize: 13
                    }}>
                      {nodeLabels[keyNodeType]}
                    </span>
                  </div>
                  {canCorrectKeyNode(keyNodeType) && onKeyNodeCorrectionRequest && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openCorrectionModal(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', fontSize: 11,
                        background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)',
                        borderRadius: 4, color: 'var(--accent-orange, #FFA500)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,165,0,0.1)'}
                    >
                      <RefreshCw size={12} /> 更正
                    </button>
                  )}
                </div>

                {/* 收货入库详情 */}
                {keyNodeType === 'op_receive' && (() => {
                  const receiptNotes = meta.receipt_notes || meta.notes;
                  const hasData = meta.at_receipt_sn || receiptNotes;
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {meta.at_receipt_sn && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>修正序列号</span>
                          <span style={{ color: '#F59E0B', fontFamily: 'monospace' }}>{meta.at_receipt_sn}</span>
                        </div>
                      )}
                      {receiptNotes && (
                        <div style={{ fontSize: 13 }}>
                          <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>收货备注:</div>
                          <div style={{ color: 'var(--text-main)' }}>{receiptNotes}</div>
                        </div>
                      )}
                      {!hasData && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>已确认收货，无其他备注信息</div>
                      )}
                    </div>
                  );
                })()}

                {/* 发货信息详情 */}
                {keyNodeType === 'op_shipping' && (() => {
                  const carrier = meta.carrier || meta.shipping_carrier;
                  const methodMap: Record<string, string> = {
                    'express': '快递直发',
                    'forwarder': '货代中转',
                    'pickup': '客户自提',
                    'combined': '合并发货'
                  };
                  const hasData = meta.shipping_method || carrier || meta.tracking_number || 
                    meta.forwarder_name || meta.pickup_person || meta.associated_order_ref;
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {meta.shipping_method && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>发货方式</span>
                          <span style={{ color: '#10B981' }}>{methodMap[meta.shipping_method] || meta.shipping_method}</span>
                        </div>
                      )}
                      {/* 快递直发 */}
                      {meta.shipping_method === 'express' && carrier && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>快递公司</span>
                          <span style={{ color: 'var(--text-main)' }}>{carrier}</span>
                        </div>
                      )}
                      {meta.shipping_method === 'express' && meta.tracking_number && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>快递单号</span>
                          <span style={{ color: '#10B981', fontFamily: 'monospace' }}>{meta.tracking_number}</span>
                        </div>
                      )}
                      {/* 货代中转 */}
                      {meta.shipping_method === 'forwarder' && meta.forwarder_name && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>货代名称</span>
                          <span style={{ color: 'var(--text-main)' }}>{meta.forwarder_name}</span>
                        </div>
                      )}
                      {meta.shipping_method === 'forwarder' && meta.forwarder_domestic_tracking && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>国内转运单号</span>
                          <span style={{ color: '#10B981', fontFamily: 'monospace' }}>{meta.forwarder_domestic_tracking}</span>
                        </div>
                      )}
                      {/* 客户自提 */}
                      {meta.shipping_method === 'pickup' && meta.pickup_person && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>提货人</span>
                          <span style={{ color: 'var(--text-main)' }}>{meta.pickup_person}</span>
                        </div>
                      )}
                      {/* 合并发货 */}
                      {meta.shipping_method === 'combined' && meta.associated_order_ref && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>关联订单</span>
                          <span style={{ color: '#3B82F6', fontFamily: 'monospace' }}>{meta.associated_order_ref}</span>
                        </div>
                      )}
                      {/* 通用单号（非 express 模式） */}
                      {meta.shipping_method !== 'express' && meta.tracking_number && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>运单号</span>
                          <span style={{ color: '#10B981', fontFamily: 'monospace' }}>{meta.tracking_number}</span>
                        </div>
                      )}
                      {!hasData && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>已确认发货，无详细信息</div>
                      )}
                    </div>
                  );
                })()}

                {/* 商务审核详情 */}
                {keyNodeType === 'ms_review' && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {meta.warranty_decision && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>保修判定</span>
                        <span style={{ color: meta.warranty_decision === 'in_warranty' ? '#10B981' : 'var(--text-main)', fontWeight: 500 }}>
                          {meta.warranty_decision === 'in_warranty' ? '保内' : (meta.warranty_decision === 'out_warranty' ? '保外' : meta.warranty_decision)}
                        </span>
                      </div>
                    )}
                    {meta.estimated_cost !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>预估费用</span>
                        <span style={{ color: 'var(--text-main)' }}>¥{meta.estimated_cost}</span>
                      </div>
                    )}
                    {meta.review_notes && (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>审核备注:</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{meta.review_notes}</div>
                      </div>
                    )}
                    {!meta.warranty_decision && meta.estimated_cost === undefined && !meta.review_notes && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>暂无详细信息</div>
                    )}
                  </div>
                )}

                {/* 结案确认详情 */}
                {keyNodeType === 'ms_closing' && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {meta.settlement_type && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>发货方式</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{meta.settlement_type}</span>
                      </div>
                    )}
                    {meta.payment_confirmed !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>款项确认</span>
                        <span style={{ color: meta.payment_confirmed ? '#10B981' : 'var(--text-secondary)' }}>
                          {meta.payment_confirmed ? '已确认' : '未确认'}
                        </span>
                      </div>
                    )}
                    {meta.actual_payment && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>实收金额</span>
                        <span style={{ color: 'var(--text-main)' }}>¥{meta.actual_payment}</span>
                      </div>
                    )}
                    {meta.closing_notes && (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>留言备注:</div>
                        <div style={{ color: 'var(--text-main)' }}>{meta.closing_notes}</div>
                      </div>
                    )}
                    {!meta.settlement_type && !meta.payment_confirmed && !meta.actual_payment && !meta.closing_notes && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>暂无详细信息</div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Text Content */}
          {activity.content && !(activity.activity_type === 'comment' && activity.metadata?.action === 'repair_complete') && !(activity.activity_type === 'diagnostic_report') && !(activity.activity_type === 'op_repair_report') && !isKeyNodeActivity && (() => {
            // 过滤掉无意义的空字段修改内容
            let displayContent = activity.content_html || activity.content.replace(/\n/g, '<br/>');
            // 移除 "修改了 未知字段 (空) → (空)" 这样的无意义内容
            displayContent = displayContent.replace(/修改了\s*未知字段\s*\(空\)\s*→\s*\(空\)/g, '').trim();
            if (!displayContent) return null;
            
            return (
              <div style={{
                fontSize: 14, color: 'var(--text-main)', lineHeight: 1.6, wordBreak: 'break-word',
                background: 'var(--glass-bg)', padding: 16, borderRadius: 8
              }} dangerouslySetInnerHTML={{ __html: displayContent }} />
            );
          })()}

          {/* Diagnostic Report Content */}
          {activity.activity_type === 'diagnostic_report' && activity.metadata && (() => {
            const meta = activity.metadata as any;
            const correctionCount = meta?._correction_count || 0;
            return (
              <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Header with Correction Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>
                    <Wrench size={14} /> {meta.submission_type === 'technical_diagnosis' ? '详细诊断报告' : '诊断记录'}
                    {correctionCount > 0 && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,165,0,0.2)', color: 'var(--accent-orange, #FFA500)', textTransform: 'none' }}>
                        已更正 {correctionCount}次
                      </span>
                    )}
                  </div>
                  {canCorrectActivity(activity) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openCorrectionModal(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11,
                        background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)',
                        borderRadius: 4, color: 'var(--accent-orange, #FFA500)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,165,0,0.1)'}
                    >
                      <RefreshCw size={12} /> 更正
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 13 }}>
                  <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>故障判定:</div>
                  <div style={{ color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{meta.diagnosis || '-'}</div>
                </div>

                <div style={{ fontSize: 13 }}>
                  <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>维修方案/建议:</div>
                  <div style={{ color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{meta.repair_advice || '-'}</div>
                </div>

                {(meta.technical_damage_status || meta.technical_warranty_suggestion) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                    {meta.technical_damage_status && (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>损坏判定:</div>
                        <div style={{ color: meta.technical_damage_status === 'physical_damage' ? '#EF4444' : (meta.technical_damage_status === 'no_damage' ? '#10B981' : 'var(--text-main)'), fontWeight: 500 }}>
                          {meta.technical_damage_status === 'physical_damage' ? '人为损坏/物理损伤' : (meta.technical_damage_status === 'no_damage' ? '无人为损坏/正常故障' : '无法判定')}
                        </div>
                      </div>
                    )}
                    {meta.technical_warranty_suggestion && (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>保修建议:</div>
                        <div style={{ color: meta.technical_warranty_suggestion === 'suggest_out_warranty' ? 'var(--text-main)' : (meta.technical_warranty_suggestion === 'suggest_in_warranty' ? '#10B981' : '#3B82F6'), fontWeight: 500 }}>
                          {meta.technical_warranty_suggestion === 'suggest_out_warranty' ? '建议保外' : (meta.technical_warranty_suggestion === 'suggest_in_warranty' ? '建议保内' : '需进一步核实')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(meta.estimated_labor_hours > 0 || (meta.estimated_parts && meta.estimated_parts.length > 0)) && (
                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 8, fontSize: 12, fontWeight: 600 }}>预估配件与工时</div>
                    {meta.estimated_labor_hours > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>预估工时</span>
                        <span style={{ color: 'var(--text-main)' }}>{meta.estimated_labor_hours} 小时</span>
                      </div>
                    )}
                    {meta.estimated_parts && meta.estimated_parts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                        {meta.estimated_parts.map((p: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name} {p.sku && `(${p.sku})`}</span>
                            <span style={{ color: 'var(--text-main)', paddingLeft: 8 }}>x{p.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Repair Report Content */}
          {activity.activity_type === 'comment' && activity.metadata?.action === 'repair_complete' && (() => {
            const meta = activity.metadata as any;
            return (
              <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>
                  <Wrench size={14} /> 维修记录细节
                </div>

                {meta.repair_content && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>维修工作详述:</div>
                    <div style={{ color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{meta.repair_content}</div>
                  </div>
                )}

                {meta.test_result && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>老化/测试结论:</div>
                    <div style={{ color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{meta.test_result}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* OP Repair Report Content - Full Detail View */}
          {activity.activity_type === 'op_repair_report' && activity.metadata && (() => {
            const meta = activity.metadata as any;
            const repairProcess = meta?.repair_process || {};
            const conclusion = meta?.conclusion || {};
            const laborCharges = meta?.labor_charges || [];
            const correctionCount = meta?._correction_count || 0;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header with Correction Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)', fontWeight: 600, fontSize: 14 }}>
                    <Wrench size={18} />
                    <span>OP维修记录</span>
                    {correctionCount > 0 && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,165,0,0.2)', color: 'var(--accent-orange, #FFA500)' }}>
                        已更正 {correctionCount}次
                      </span>
                    )}
                  </div>
                  {canCorrectActivity(activity) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCorrectionModal();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', fontSize: 11,
                        background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)',
                        borderRadius: 4, color: 'var(--accent-orange, #FFA500)', cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,165,0,0.1)'}
                    >
                      <RefreshCw size={12} />
                      更正
                    </button>
                  )}
                </div>

                {/* Repair Actions */}
                {repairProcess.actions_taken && repairProcess.actions_taken.length > 0 && (
                  <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase' }}>维修操作</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {repairProcess.actions_taken.map((action: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--text-main)', fontSize: 12, fontWeight: 600 }}>{i + 1}.</span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parts Replaced */}
                {repairProcess.parts_replaced && repairProcess.parts_replaced.length > 0 && (
                  <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase' }}>更换零件</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {repairProcess.parts_replaced.map((part: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--glass-bg-light)', borderRadius: 6 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{part.name}</span>
                            {part.part_number && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{part.part_number}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>x{part.quantity}</span>
                            <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>¥{(part.unit_price * part.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Labor Charges */}
                {laborCharges.length > 0 && (
                  <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase' }}>工时费用</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {laborCharges.map((labor: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, color: 'var(--text-main)' }}>{labor.description || '维修工时'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{labor.hours}小时 x ¥{labor.rate}/小时</div>
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>¥{labor.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conclusion */}
                {(conclusion.summary || conclusion.test_result) && (
                  <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase' }}>维修结论</div>
                    {conclusion.summary && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>总结</div>
                        <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>{conclusion.summary}</div>
                      </div>
                    )}
                    {conclusion.test_result && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>测试结果</div>
                        <div style={{ fontSize: 13, color: '#10B981', lineHeight: 1.5 }}>{conclusion.test_result}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 创建工单活动详情 */}
          {activity.activity_type === 'system_event' && (activity.metadata as any)?.event_type === 'creation' && (() => {
            const meta = activity.metadata as any;
            const ticketType = meta?.ticket_type || ticket?.ticket_type || 'rma';
            const isRmaOrSvc = ticketType === 'rma' || ticketType === 'svc';
            
            // 优先从 ticket 读取数据，如果不存在则从 activity.metadata 读取
            const customerName = ticket?.account?.name || ticket?.account_name || meta?.customer_name || '-';
            const contactName = ticket?.contact?.name || ticket?.contact_name || meta?.contact_name || '-';
            const dealerName = ticket?.dealer?.name || ticket?.dealer_name || meta?.dealer_name;
            const productName = ticket?.product?.name || ticket?.product_name || meta?.product_name || '-';
            const serialNumber = ticket?.serial_number || meta?.serial_number || '-';
            const problemDescription = ticket?.problem_description || meta?.problem_description;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 更正按钮 - 移到右上角 */}
                {canCorrectCreation() && onCorrectionRequest && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 请求打开完整编辑器进行工单更正
                        onCorrectionRequest({
                          activityId: activity.id,
                          activityType: 'ticket_creation',
                          reason: '',
                          originalContent: activity.content,
                          metadata: activity.metadata
                        });
                        onClose();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11,
                        background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)',
                        borderRadius: 4, color: 'var(--accent-orange, #FFA500)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,165,0,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,165,0,0.1)'}
                    >
                      <RefreshCw size={12} /> 更正
                    </button>
                  </div>
                )}

                {/* 分组1: 客户信息 */}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>客户信息</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>客户名称</label>
                      <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>{customerName}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>联系人</label>
                      <div style={{ fontSize: 13, color: 'var(--text-main)' }}>{contactName}</div>
                    </div>
                    {dealerName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>经销商</label>
                        <div style={{ fontSize: 13, color: 'var(--text-main)' }}>{dealerName}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 分组2: 设备信息 (RMA/SVC) */}
                {isRmaOrSvc && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>设备信息</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>产品型号</label>
                        <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>{productName}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>序列号</label>
                        <div style={{ fontSize: 13, color: 'var(--text-main)', fontFamily: 'var(--font-mono, monospace)' }}>{serialNumber}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 分组3: 问题描述 */}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>问题描述</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {problemDescription ? (
                      <div style={{ padding: '10px 12px', background: 'var(--glass-bg)', borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{problemDescription}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px 0' }}>暂无问题描述</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Field Updates (if any) */}
          {activity.activity_type.endsWith('_change') && activity.metadata && (
            <div style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 8 }}>
              <FieldUpdateContent content={activity.content} metadata={activity.metadata as unknown as FieldUpdateMetadata} />
            </div>
          )}

          {/* Attachments Grid */}
          {activity.attachments && activity.attachments.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>附件 ({activity.attachments.length})</h4>
              {(() => {
                const count = activity.attachments!.length;
                // Dynamic layout based on attachment count
                // 1: full width, auto aspect ratio
                // 2: two columns, 4:3 ratio
                // 3: first large + two small below
                // 4: 2x2 grid
                // 5+: small grid tiles
                
                const getGridStyle = () => {
                  if (count === 1) return { gridTemplateColumns: '1fr' };
                  if (count === 2) return { gridTemplateColumns: '1fr 1fr' };
                  if (count === 3) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto' };
                  if (count === 4) return { gridTemplateColumns: '1fr 1fr' };
                  return { gridTemplateColumns: 'repeat(3, 1fr)' }; // 5+ items
                };

                return (
                  <div style={{
                    display: 'grid',
                    ...getGridStyle(),
                    gap: 8,
                    alignItems: 'start'
                  }}>
                    {activity.attachments!.map((att, idx) => {
                      const isImage = att.file_type?.startsWith('image/');
                      const isVideo = att.file_type?.startsWith('video/');
                      const isHeic = att.file_name?.toLowerCase().endsWith('.heic') || att.file_name?.toLowerCase().endsWith('.heif');
                      // For HEIC images, use thumbnail API preview mode (converts to WebP for Chrome compatibility)
                      const mediaUrl = (isImage && isHeic) 
                        ? `/api/v1/system/attachments/${att.id}/thumbnail?size=preview` + (token ? `&token=${token}` : '')
                        : att.file_url + '?inline=true' + (token ? `&token=${token}` : '');
                      const thumbUrl = (att.thumbnail_url || att.file_url) + (token ? `?token=${token}` : '');

                      // Determine size/style based on position and count
                      const isLargeItem = count === 1 || (count === 3 && idx === 0);
                      const isSmallItem = count >= 5;

                      // Aspect ratio: auto for single/large, 4:3 for medium, 1:1 for small grid
                      const aspectRatio = isLargeItem ? 'auto' : (isSmallItem ? '1' : '4/3');
                      // For count=3, first item spans full width
                      const gridColumn = (count === 3 && idx === 0) ? '1 / -1' : undefined;
                      // Object fit: contain for large/medium to show full image, cover for small grid
                      const objectFit = isSmallItem ? 'cover' : 'contain';
                      // Max height for large items to prevent excessive height
                      const maxHeight = isLargeItem ? 400 : undefined;

                      return (
                        <div key={att.id}
                          onClick={() => (isImage || isVideo) ? setLightboxMedia({ url: mediaUrl, type: isVideo ? 'video' : 'image' }) : window.open(mediaUrl)}
                          style={{
                            aspectRatio,
                            gridColumn,
                            maxHeight,
                            width: '100%',
                            background: '#111',
                            borderRadius: 8,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.1)',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {isImage ? (
                            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#222' }}>
                              {/* Loading spinner */}
                              <div style={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#555', transition: 'opacity 0.3s'
                              }} className="thumb-loading">
                                <div style={{ width: 20, height: 20, border: '2px solid #333', borderTopColor: '#FFD700', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                              </div>
                              <img
                                src={thumbUrl}
                                alt={att.file_name}
                                key={`${att.id}-${activity.id}`}
                                onLoad={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  const loader = e.currentTarget.parentElement?.querySelector('.thumb-loading') as HTMLElement;
                                  if (loader) loader.style.opacity = '0';
                                }}
                                style={{
                                  width: '100%', height: '100%', objectFit,
                                  opacity: 0, transition: 'opacity 0.3s'
                                }}
                              />
                            </div>
                          ) : isVideo ? (
                            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#222' }}>
                              {att.thumbnail_url ? (
                                <img src={thumbUrl} alt={att.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                                  <Clock size={24} style={{ animation: 'spin 2s linear infinite' }} />
                                </div>
                              )}
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '50%', padding: 12, color: 'var(--text-main)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: 12, textAlign: 'center' }}>
                              <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{att.file_name}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      <MediaLightbox url={lightboxMedia?.url || null} type={lightboxMedia?.type || null} onClose={() => setLightboxMedia(null)} />
      
      {/* 更正弹窗 */}
      {correctionModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setCorrectionModal(false)}>
          <div style={{
            background: 'var(--modal-bg)', borderRadius: 12, 
            width: isComplexActivityType(activity?.activity_type || '') ? 420 : 500, 
            maxWidth: '90vw',
            border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow-lg)',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-main)', fontWeight: 600 }}>
                {isComplexActivityType(activity?.activity_type || '') ? '确认更正' : '更正活动记录'}
              </h3>
              <button onClick={() => setCorrectionModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>活动类型</div>
                <div style={{ fontSize: 14, color: 'var(--text-main)' }}>
                  {{
                    'op_repair_report': 'OP维修记录',
                    'diagnostic_report': '诊断报告',
                    'shipping_info': '发货信息',
                    'comment': '评论',
                    'internal_note': '内部备注',
                    'key_node_op_receive': '收货入库',
                    'key_node_op_shipping': '发货信息',
                    'key_node_ms_review': '商务审核',
                    'key_node_ms_closing': '结案确认'
                  }[activity?.activity_type || ''] || activity?.activity_type}
                </div>
              </div>
              
              {/* 关键节点更正提示 */}
              {isKeyNodeActivity && (
                <div style={{ 
                  fontSize: 13, color: 'var(--text-main)', marginBottom: 16, padding: 12, 
                  background: 'var(--accent-blue-subtle)', borderRadius: 8, 
                  border: '1px solid var(--accent-blue-border)',
                  lineHeight: 1.6
                }}>
                  确认后将打开对应的编辑界面，您可以在其中修改详细内容。
                </div>
              )}
              
              {/* 复杂类型的提示说明 */}
              {!isKeyNodeActivity && isComplexActivityType(activity?.activity_type || '') && (
                <div style={{ 
                  fontSize: 13, color: 'var(--text-main)', marginBottom: 16, padding: 12, 
                  background: 'var(--accent-blue-subtle)', borderRadius: 8, 
                  border: '1px solid var(--accent-blue-border)',
                  lineHeight: 1.6
                }}>
                  确认后将打开完整的编辑界面，您可以在其中修改详细内容。
                </div>
              )}
              
              {/* 内容编辑区 - 仅简单类型显示（非关键节点且非复杂类型） */}
              {!isKeyNodeActivity && !isComplexActivityType(activity?.activity_type || '') && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>内容（可编辑）</label>
                  <textarea
                    value={correctedContent}
                    onChange={e => setCorrectedContent(e.target.value)}
                    placeholder="编辑内容..."
                    style={{
                      width: '100%', padding: 12, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                      borderRadius: 8, color: 'var(--text-main)', fontSize: 13, resize: 'vertical', minHeight: 100, fontFamily: 'inherit'
                    }}
                  />
                  {correctedContent !== (activity?.content || '') && (
                    <div style={{ fontSize: 11, color: 'var(--accent-orange, #FFA500)', marginTop: 6 }}>
                      内容已修改
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>更正原因 *</label>
                <textarea
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  placeholder="请说明更正原因，例如：快递单号填写错误、图片贴错等..."
                  style={{
                    width: '100%', padding: 12, background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                    borderRadius: 8, color: 'var(--text-main)', fontSize: 13, resize: 'vertical', minHeight: 80
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16, padding: 12, background: 'var(--badge-warning-bg)', borderRadius: 6, border: '1px solid var(--glass-border)' }}>
                <strong style={{ color: 'var(--badge-warning-text)' }}>提示：</strong> 此操作将记录更正历史并在时间线上公示，原操作人将收到通知。
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setCorrectionModal(false)}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
                >
                  取消
                </button>
                <button
                  onClick={isKeyNodeActivity ? handleKeyNodeCorrection : handleCorrection}
                  disabled={correcting || !correctionReason.trim()}
                  style={{
                    flex: 1.5, padding: '10px', background: correcting || !correctionReason.trim() ? 'var(--glass-bg-hover)' : 'var(--accent-blue)',
                    border: 'none', color: correcting || !correctionReason.trim() ? 'var(--text-secondary)' : '#000', borderRadius: 8, fontWeight: 600, cursor: correcting || !correctionReason.trim() ? 'not-allowed' : 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  {correcting ? '处理中...' : (isKeyNodeActivity ? '确认并编辑' : (isComplexActivityType(activity?.activity_type || '') ? '确认并编辑' : '确认更正'))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default {
  ActivityTimeline,
  CommentInput,
  ParticipantsPanel,
  TicketInfoCard,
  CollapsiblePanel
};
