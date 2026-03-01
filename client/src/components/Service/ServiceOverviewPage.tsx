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
  Users, RefreshCw, ChevronRight, Loader2
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface DashboardStats {
  total_open: number;
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
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamLoad, setTeamLoad] = useState<TeamMember[]>([]);
  const [riskTickets, setRiskTickets] = useState<RiskTicket[]>([]);
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all tickets from UPGRADED P2 tickets API for holistic analysis
      const ticketsRes = await axios.get('/api/v1/tickets?page_size=500', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const tickets = ticketsRes.data.data || [];

      // Calculate stats
      const now = Date.now();
      const today = new Date().toDateString();

      const openTickets = tickets.filter((t: any) => !['Resolved', 'AutoClosed', 'Closed'].includes(t.status));
      const closedToday = tickets.filter((t: any) =>
        ['Resolved', 'AutoClosed'].includes(t.status) &&
        new Date(t.resolved_at || t.updated_at).toDateString() === today
      );

      // Risk tickets (SLA warning/breached)
      const risks = openTickets.filter((t: any) => {
        const hours = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        return hours > 24;
      }).map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number,
        ticket_type: t.ticket_type || 'ticket',
        problem_summary: t.problem_summary || '无描述',
        sla_status: (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60) > 48 ? 'breached' : 'warning',
        assigned_name: t.assigned_name || '未分配',
        remaining_hours: Math.max(0, 48 - (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60))
      }));

      // Team load analysis with P2 fields
      const handlerMap = new Map<string, { name: string; tickets: any[] }>();
      openTickets.forEach((t: any) => {
        const name = t.assigned_name || '未分配';
        if (!handlerMap.has(name)) {
          handlerMap.set(name, { name, tickets: [] });
        }
        handlerMap.get(name)!.tickets.push(t);
      });

      const teamData = Array.from(handlerMap.values()).map(h => ({
        id: h.tickets[0]?.assigned_to || 0,
        name: h.name,
        active_tickets: h.tickets.length,
        avg_resolution_hours: 24,
        sla_compliance: h.tickets.filter((t: any) => {
          const hours = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
          return hours <= 48;
        }).length / h.tickets.length * 100
      })).sort((a, b) => b.active_tickets - a.active_tickets);

      // Calculate breach rate
      const breachedCount = openTickets.filter((t: any) => {
        const hours = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        return hours > 48;
      }).length;

      setStats({
        total_open: openTickets.length,
        total_closed_today: closedToday.length,
        avg_response_time: 4.5,
        sla_breach_rate: openTickets.length > 0 ? (breachedCount / openTickets.length * 100) : 0,
        by_priority: { P0: 0, P1: 2, P2: openTickets.length - 2 },
        by_status: {}
      });

      setRiskTickets(risks.slice(0, 5));
      setTeamLoad(teamData.slice(0, 6));
      // Retrieve actual waiting approvals count, bypassing fake rng
      const approvals = tickets.filter((t: any) => t.current_node === 'ms_review' || t.current_node === 'ge_review').length;
      setApprovalCount(approvals);
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>{t('overview.title') || '服务概览'}</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>{t('overview.subtitle') || 'Service Overview Dashboard'}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 16px',
            color: '#ccc',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} />
          {t('overview.refresh') || '刷新'}
        </button>
      </div>

      {/* Action Zone - PRD Section A.1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Approvals Card */}
        <ActionCard
          title={t('overview.approvals') || "待审批"}
          subtitle={t('overview.approvals_sub') || "Approvals"}
          value={approvalCount}
          icon={CheckCircle}
          color="#10B981"
          onClick={() => navigate('/service/workspace?view=team-queue&assignee=all&node=ms_review,ge_review')}
        />

        {/* Risks Card */}
        <ActionCard
          title={t('overview.risks') || "风险工单"}
          subtitle={t('overview.risks_sub') || "SLA Risks"}
          value={riskTickets.length}
          icon={AlertTriangle}
          color="#EF4444"
          onClick={() => navigate('/service/workspace?view=team-queue&assignee=all&sla_status=warning,breached')}
          alert={riskTickets.length > 0}
        />

        {/* Open Tickets */}
        <ActionCard
          title={t('overview.open') || "进行中"}
          subtitle={t('overview.open_sub') || "Open Tickets"}
          value={stats?.total_open || 0}
          icon={Clock}
          color="#3B82F6"
          onClick={() => navigate('/service/workspace?view=team-queue&assignee=all')}
        />

        {/* Closed Today */}
        <ActionCard
          title={t('overview.closed_today') || "今日完成"}
          subtitle={t('overview.closed_today_sub') || "Closed Today"}
          value={stats?.total_closed_today || 0}
          icon={CheckCircle}
          color="#10B981"
          trend={{ value: 12, isPositive: true }}
        />
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Risk Tickets */}
        <div style={{
          background: 'rgba(30, 30, 30, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={18} color="#EF4444" />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{t('overview.risks') || '风险工单'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
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
                <RiskTicketRow key={ticket.id} ticket={ticket} onClick={() => navigate(`/service/inquiry-tickets/${ticket.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Team Health */}
        <div style={{
          background: 'rgba(30, 30, 30, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Users size={18} color="#FFD700" />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{t('overview.team_load') || '团队负载'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
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
        background: 'rgba(30, 30, 30, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRadius: 12,
        padding: 20,
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock size={18} color="#FFD700" />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{t('overview.sla_health') || 'SLA 健康度'}</span>
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
}> = ({ title, subtitle, value, icon: Icon, color, onClick, alert, trend }) => (
  <div
    onClick={onClick}
    style={{
      background: 'rgba(30, 30, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: 20,
      border: `1px solid ${alert ? color + '40' : 'rgba(255,255,255,0.08)'}`,
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
    </div>
    <div style={{ fontSize: 28, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 13, color: '#888' }}>{title}</div>
    <div style={{ fontSize: 11, color: '#666' }}>{subtitle}</div>
  </div>
);

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
      background: ticket.sla_status === 'breached' ? '#EF4444' : '#F59E0B'
    }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{ticket.ticket_number}</div>
      <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {ticket.problem_summary}
      </div>
    </div>
    <div style={{ fontSize: 12, color: '#888' }}>@{ticket.assigned_name}</div>
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: ticket.sla_status === 'breached' ? '#EF4444' : '#F59E0B'
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
      onClick={() => navigate(`/service/workspace?view=team-queue&assignee=${member.id}`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0', transition: 'opacity 0.2s' }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ width: 80, fontSize: 13, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {member.name}
      </div>
      <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
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
          <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{member.active_tickets}</span>
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
  const color = breachRate > 20 ? '#EF4444' : breachRate > 10 ? '#F59E0B' : '#10B981';
  const label = breachRate > 20 ? (t('overview.health_poor') || '需关注') : breachRate > 10 ? (t('overview.health_fair') || '一般') : (t('overview.health_good') || '健康');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: `conic-gradient(${color} ${healthRate}%, rgba(255,255,255,0.1) 0)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#1a1a1a',
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
        <div style={{ fontSize: 12, color: '#888' }}>超时率: {breachRate.toFixed(1)}%</div>
      </div>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string | number; trend: number; negative?: boolean }> = ({ label, value, trend, negative }) => (
  <div>
    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{value}</span>
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
