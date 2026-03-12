/**
 * ServiceOverviewPage (服务管理仪表盘)
 * PRD P2 Section 6.3.A - Overview (管理仪表盘)
 * 适用角色: Lead / Exec
 * 定位: 登录后的第一站。先看全局，再干细活。
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Users, RefreshCw, ChevronRight, Loader2, Zap, PackageOpen, Info
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useViewAs } from '../Workspace/ViewAsComponents';
import { DispatchRulesDrawer } from './DispatchRulesDrawer';

// PRD v1.7.1: 部门节点映射（用于 UI 提示）
const DEPARTMENT_NODES_DISPLAY: Record<string, { label: string; nodes: string[] }> = {
  'OP': { label: '生产运营部', nodes: ['待收货', '诊断中', '维修中', '待发货', 'QA检测'] },
  'MS': { label: '市场部', nodes: ['草稿', '已提交', 'MS审阅', '待反馈', '待结案'] },
  'GE': { label: '通用台面', nodes: ['GE审阅', 'GE结案'] },
  'RD': { label: '研发部', nodes: ['诊断中', '维修中'] }
};

// Panel 计算逻辑说明
const PANEL_TOOLTIPS: Record<string, { zh: string; en: string }> = {
  unassigned: {
    zh: '统计条件:\n• 对接人为空\n• 当前节点在本部门职责范围内',
    en: 'Criteria:\n• Assignee is empty\n• Current node within dept scope'
  },
  approvals: {
    zh: '统计条件:\n• 节点为 MS审阅 或 GE审阅\n• 仅 MS/GE 部门可见此指标',
    en: 'Criteria:\n• Node is MS Review or GE Review\n• Only visible to MS/GE'
  },
  risks: {
    zh: '统计条件:\n• SLA状态为预警或违约\n• 或工单已打开超过24小时',
    en: 'Criteria:\n• SLA status is Warning or Breached\n• Or ticket open > 24 hours'
  },
  open: {
    zh: '统计条件:\n• 对接人属于本部门\n• 或当前节点属于本部门职责',
    en: 'Criteria:\n• Assignee belongs to dept\n• Or node belongs to dept scope'
  },
  closed_today: {
    zh: '统计条件:\n• 今日由本部门成员关闭的工单',
    en: 'Criteria:\n• Tickets closed today by dept members'
  }
};

interface DashboardStats {
  total_open: number;
  unassigned_count: number;
  total_closed_today: number;
  avg_response_time: number;
  sla_breach_rate: number;
  by_priority: { P0: number; P1: number; P2: number };
  by_status: Record<string, number>;
}

interface TeamMember {
  id: number;
  name: string;
  active_tickets: number;
  avg_resolution_hours: number;
  sla_compliance: number;
}

interface RiskTicket {
  id: number;
  ticket_number: string;
  ticket_type: string;
  problem_summary: string;
  sla_status: string;
  assigned_name: string;
  remaining_hours: number;
}

const ServiceOverviewPage: React.FC = () => {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { viewingAs } = useViewAs();
  const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamLoad, setTeamLoad] = useState<TeamMember[]>([]);
  const [riskTickets, setRiskTickets] = useState<RiskTicket[]>([]);
  const [approvalCount, setApprovalCount] = useState(0);
  const [isDispatchDrawerOpen, setIsDispatchDrawerOpen] = useState(false);

  // Permission check
  const actingDept = viewingAs?.department_code || (user as any)?.department_code || '';
  const isLeadOrAdmin = (user as any)?.role === 'Admin' || (user as any)?.role === 'Exec' || (user as any)?.role === 'Lead';

  // Normalize department code for display
  const normalizeDeptCode = (code: string): string => {
    if (!code) return 'DEFAULT';
    if (/^[A-Z]{2,3}$/.test(code)) return code;
    const map: Record<string, string> = {
      '市场部': 'MS', '生产运营部': 'OP', '运营部': 'OP',
      '研发部': 'RD', '通用台面': 'GE', '综合部': 'GE', '管理层': 'GE'
    };
    return map[code] || code;
  };
  
  const normalizedDept = normalizeDeptCode(actingDept);
  const deptInfo = DEPARTMENT_NODES_DISPLAY[normalizedDept];

  useEffect(() => {
    fetchDashboardData();
  }, [viewingAs]); // Re-fetch if view-as identity changes

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const targetDept = viewingAs?.department_code || (user as any)?.department_code || '';
      const params = targetDept ? { dept: targetDept } : {};

      const res = await axios.get('/api/v1/tickets/team-stats', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const data = res.data.data;

      setStats({
        total_open: data.total_open,
        unassigned_count: data.unassigned_count || 0,
        total_closed_today: data.total_closed_today,
        avg_response_time: data.avg_response_time,
        sla_breach_rate: data.sla_breach_rate,
        by_priority: data.by_priority,
        by_status: data.by_status
      });

      setRiskTickets(data.risk_tickets.slice(0, 5));
      setTeamLoad(data.team_load.slice(0, 6));
      setApprovalCount(data.approval_count);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 className="animate-spin" size={32} color="#888" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{t('overview.title') || '服务概览'}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{t('overview.subtitle') || 'Service Overview Dashboard'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isLeadOrAdmin && (
            <button
              onClick={() => setIsDispatchDrawerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,210,0,0.1)',
                border: '1px solid rgba(255,210,0,0.2)',
                borderRadius: 8,
                padding: '8px 16px',
                color: '#FFD200',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              <Zap size={16} />
              自动分发规则
            </button>
          )}
          <button
            onClick={fetchDashboardData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--glass-bg-light)',
              border: '1px solid var(--card-border)',
              borderRadius: 8,
              padding: '8px 16px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            {t('overview.refresh') || '刷新'}
          </button>
        </div>
      </div>

      {/* 方案D: 数据范围提示条 - PRD v1.7.1 数据隔离原则 */}
      {deptInfo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          marginBottom: 20,
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text-secondary)'
        }}>
          <Info size={16} color="#3B82F6" style={{ flexShrink: 0 }} />
          <span>
            {lang === 'zh' ? '当前视角' : 'Current View'}: <strong style={{ color: 'var(--text-main)' }}>{deptInfo.label} ({normalizedDept})</strong>
            <span style={{ margin: '0 8px', color: 'var(--text-tertiary)' }}>·</span>
            {lang === 'zh' ? '可见节点' : 'Visible Nodes'}: {deptInfo.nodes.join(', ')}
          </span>
        </div>
      )}

      {/* Action Zone - PRD Section A.1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24, position: 'relative', zIndex: 10 }}>
        {/* Unassigned Card - NEW */}
        <ActionCard
          title={t('overview.unassigned') || "待分配"}
          subtitle={t('overview.unassigned_sub') || "Unassigned"}
          value={stats?.unassigned_count || 0}
          icon={PackageOpen}
          color="#FFD200"
          onClick={() => navigate(`/service/team-hub?assignee=0`)}
          alert={(stats?.unassigned_count || 0) > 0}
          tooltipKey="unassigned"
          lang={lang}
        />

        {/* Approvals Card */}
        <ActionCard
          title={t('overview.approvals') || "待审批"}
          subtitle={t('overview.approvals_sub') || "Approvals"}
          value={approvalCount}
          icon={CheckCircle}
          color="#10B981"
          onClick={() => navigate('/service/team-hub?assignee=all&node=ms_review,ge_review')}
          tooltipKey="approvals"
          lang={lang}
        />

        {/* Risks Card */}
        <ActionCard
          title={t('overview.risks') || "风险工单"}
          subtitle={t('overview.risks_sub') || "SLA Risks"}
          value={riskTickets.length}
          icon={AlertTriangle}
          color="#EF4444"
          onClick={() => navigate('/service/team-hub?assignee=all&sla_status=warning,breached')}
          alert={riskTickets.length > 0}
          tooltipKey="risks"
          lang={lang}
        />

        {/* Open Tickets */}
        <ActionCard
          title={t('overview.open') || "进行中"}
          subtitle={t('overview.open_sub') || "Open Tickets"}
          value={stats?.total_open || 0}
          icon={Clock}
          color="#3B82F6"
          onClick={() => navigate('/service/team-hub?assignee=all')}
          tooltipKey="open"
          lang={lang}
        />

        {/* Closed Today */}
        <ActionCard
          title={t('overview.closed_today') || "今日完成"}
          subtitle={t('overview.closed_today_sub') || "Closed Today"}
          value={stats?.total_closed_today || 0}
          icon={CheckCircle}
          color="#10B981"
          trend={{ value: 12, isPositive: true }}
          tooltipKey="closed_today"
          lang={lang}
        />
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, position: 'relative', zIndex: 5 }}>
        {/* Left: Risk Tickets */}
        <div style={{
          background: 'var(--card-bg)',
          backdropFilter: 'var(--glass-blur)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={18} color="#EF4444" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>{t('overview.risks') || '风险工单'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('overview.risks_hint') || '点击可催办 @Assignee'}
            </span>
          </div>

          {riskTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
              {t('overview.no_risks') || '暂无风险工单 🎉'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riskTickets.map(ticket => (
                <RiskTicketRow key={ticket.id} ticket={ticket} onClick={() => navigate(`/service/tickets/${ticket.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Team Health */}
        <div style={{
          background: 'var(--card-bg)',
          backdropFilter: 'var(--glass-blur)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Users size={18} color="var(--accent-blue)" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>{t('overview.team_load') || '团队负载'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('overview.team_hint') || '点击柱子可改派任务'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {teamLoad.map(member => (
              <TeamLoadBar key={member.id || member.name} member={member} maxTickets={Math.max(...teamLoad.map(m => m.active_tickets), 1)} />
            ))}
          </div>
        </div>
      </div>

      {/* SLA Health Indicator */}
      <div style={{
        marginTop: 20,
        background: 'var(--card-bg)',
        backdropFilter: 'var(--glass-blur)',
        borderRadius: 12,
        padding: 20,
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock size={18} color="var(--accent-blue)" />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>{t('overview.sla_health') || 'SLA 健康度'}</span>
        </div>

        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <SlaGauge breachRate={stats?.sla_breach_rate || 0} />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <MiniStat label={t('overview.avg_response') || "平均响应"} value={`${stats?.avg_response_time || 0}h`} trend={-8} />
              <MiniStat label={t('overview.today_processed') || "今日处理"} value={stats?.total_closed_today || 0} trend={15} />
              <MiniStat label={t('overview.breach_rate') || "超时率"} value={`${(stats?.sla_breach_rate || 0).toFixed(1)}%`} trend={stats?.sla_breach_rate ? 5 : -10} negative />
            </div>
          </div>
        </div>
      </div>

      <DispatchRulesDrawer
        isOpen={isDispatchDrawerOpen}
        onClose={() => setIsDispatchDrawerOpen(false)}
        departmentCode={actingDept}
      />
    </div>
  );
};

// Sub-components
const ActionCard: React.FC<{
  title: string;
  subtitle: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
  alert?: boolean;
  trend?: { value: number; isPositive: boolean };
  tooltipKey?: string;
  lang?: string;
}> = ({ title, subtitle, value, icon: Icon, color, onClick, alert, trend, tooltipKey, lang = 'zh' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltip = tooltipKey ? PANEL_TOOLTIPS[tooltipKey]?.[lang as 'zh' | 'en'] : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        position: 'relative',
        background: 'var(--card-bg)',
        backdropFilter: 'var(--glass-blur)',
        borderRadius: 12,
        padding: 20,
        border: `1px solid ${alert ? color + '40' : 'var(--card-border)'}`,
        boxShadow: 'var(--card-shadow)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={20} color={color} />
        </div>
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trend.isPositive ? '#10B981' : '#EF4444' }}>
            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend.value)}%
          </div>
        )}
        {tooltip && (
          <Info size={14} color="var(--text-tertiary)" style={{ opacity: 0.6 }} />
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{subtitle}</div>

      {/* 方案A: Hover Tooltip - positioned below the card */}
      {showTooltip && tooltip && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 8,
          padding: '10px 14px',
          background: '#1C1C1E',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 1000,
          whiteSpace: 'pre-line',
          fontSize: 12,
          color: 'var(--text-secondary)',
          minWidth: 180,
          lineHeight: 1.6
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
};

const RiskTicketRow: React.FC<{ ticket: RiskTicket; onClick: () => void }> = ({ ticket, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      background: 'rgba(239, 68, 68, 0.08)',
      borderRadius: 8,
      cursor: 'pointer',
      border: '1px solid rgba(239, 68, 68, 0.2)'
    }}
  >
    <div style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: ticket.sla_status === 'breached' ? '#EF4444' : '#FFD200'
    }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main)' }}>{ticket.ticket_number}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {ticket.problem_summary}
      </div>
    </div>
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>@{ticket.assigned_name}</div>
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: ticket.sla_status === 'breached' ? '#EF4444' : '#FFD200'
    }}>
      {ticket.remaining_hours > 0 ? `${Math.round(ticket.remaining_hours)}h` : '已超时'}
    </div>
    <ChevronRight size={16} color="#666" />
  </div>
);

const TeamLoadBar: React.FC<{ member: TeamMember; maxTickets: number }> = ({ member, maxTickets }) => {
  const navigate = useNavigate();
  const width = (member.active_tickets / maxTickets) * 100;
  const isOverloaded = member.active_tickets > 10;
  const color = isOverloaded ? '#EF4444' : '#10B981';

  return (
    <div
      onClick={() => navigate(`/service/team-hub?assignee=${member.id}`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0', transition: 'opacity 0.2s' }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ width: 80, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {member.name}
      </div>
      <div style={{ flex: 1, height: 24, background: 'var(--glass-bg-light)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${width}%`,
          height: '100%',
          background: `${color}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 8,
          minWidth: 30
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF' }}>{member.active_tickets}</span>
        </div>
      </div>
      {isOverloaded && (
        <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 500 }}>超负荷</span>
      )}
    </div>
  );
};

const SlaGauge: React.FC<{ breachRate: number }> = ({ breachRate }) => {
  const { t } = useLanguage();
  const healthRate = 100 - breachRate;
  const color = breachRate > 20 ? '#EF4444' : breachRate > 10 ? '#FFD200' : '#10B981';
  const label = breachRate > 20 ? (t('overview.health_poor') || '需关注') : breachRate > 10 ? (t('overview.health_fair') || '一般') : (t('overview.health_good') || '健康');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: `conic-gradient(${color} ${healthRate}%, var(--glass-bg-light) 0)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'var(--card-bg-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <span style={{ fontSize: 18, fontWeight: 600, color }}>{healthRate.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 500, color, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>超时率: {breachRate.toFixed(1)}%</div>
      </div>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string | number; trend: number; negative?: boolean }> = ({ label, value, trend, negative }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-main)' }}>{value}</span>
      <span style={{
        fontSize: 11,
        color: (negative ? trend > 0 : trend < 0) ? '#EF4444' : '#10B981',
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(trend)}%
      </span>
    </div>
  </div>
);

export default ServiceOverviewPage;
