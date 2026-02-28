/**
 * Service Overview Dashboard (服务概览仪表盘)
 * P2 架构升级 - macOS26 风格
 */

import React from 'react';
import {
  TrendingUp, TrendingDown, Clock, AlertTriangle,
  CheckCircle,
  PieChart, Activity
} from 'lucide-react';

// ==============================
// Types
// ==============================

interface DashboardStats {
  total_open: number;
  total_closed_today: number;
  avg_response_time: number;
  sla_breach_rate: number;
  by_type: { inquiry: number; rma: number; svc: number };
  by_priority: { P0: number; P1: number; P2: number };
  by_status: Record<string, number>;
  trend: { date: string; count: number }[];
}

// ==============================
// Stat Card
// ==============================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; isPositive: boolean };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend
}) => {
  return (
    <div style={{
      background: 'rgba(30, 30, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: 20,
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        marginBottom: 12
      }}>
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: trend.isPositive ? '#10B981' : '#EF4444'
          }}>
            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      
      <div style={{ 
        fontSize: 28, 
        fontWeight: 600, 
        color: '#fff',
        marginBottom: 4
      }}>
        {value}
      </div>
      
      <div style={{ fontSize: 13, color: '#888' }}>
        {title}
      </div>
      
      {subtitle && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

// ==============================
// SLA Health Indicator
// ==============================

interface SlaHealthProps {
  breachRate: number;
  warningCount: number;
  breachedCount: number;
}

export const SlaHealthIndicator: React.FC<SlaHealthProps> = ({
  breachRate,
  warningCount,
  breachedCount
}) => {
  const getHealthColor = () => {
    if (breachRate > 20) return '#EF4444';
    if (breachRate > 10) return '#FFD700';
    return '#10B981';
  };

  const getHealthLabel = () => {
    if (breachRate > 20) return '需关注';
    if (breachRate > 10) return '一般';
    return '健康';
  };

  return (
    <div style={{
      background: 'rgba(30, 30, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: 20,
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 16
      }}>
        <Activity size={18} color="#FFD700" />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
          SLA 健康度
        </span>
      </div>

      {/* Health Gauge */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 16,
        marginBottom: 16
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `conic-gradient(${getHealthColor()} ${100 - breachRate}%, rgba(255,255,255,0.1) 0)`,
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
            <span style={{ fontSize: 18, fontWeight: 600, color: getHealthColor() }}>
              {(100 - breachRate).toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div>
          <div style={{ 
            fontSize: 16, 
            fontWeight: 500, 
            color: getHealthColor(),
            marginBottom: 4
          }}>
            {getHealthLabel()}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            超时率: {breachRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Counts */}
      <div style={{ 
        display: 'flex', 
        gap: 16,
        paddingTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            marginBottom: 4
          }}>
            <AlertTriangle size={14} color="#FFD700" />
            <span style={{ fontSize: 12, color: '#888' }}>即将超时</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 600, color: '#FFD700' }}>
            {warningCount}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            marginBottom: 4
          }}>
            <AlertTriangle size={14} color="#EF4444" />
            <span style={{ fontSize: 12, color: '#888' }}>已超时</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 600, color: '#EF4444' }}>
            {breachedCount}
          </span>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Type Distribution
// ==============================

interface TypeDistributionProps {
  data: { inquiry: number; rma: number; svc: number };
}

export const TypeDistribution: React.FC<TypeDistributionProps> = ({ data }) => {
  const total = data.inquiry + data.rma + data.svc;
  
  const items = [
    { label: '咨询', value: data.inquiry, color: '#3B82F6' },
    { label: 'RMA', value: data.rma, color: '#10B981' },
    { label: 'SVC', value: data.svc, color: '#FFD700' }
  ];

  return (
    <div style={{
      background: 'rgba(30, 30, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: 20,
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 16
      }}>
        <PieChart size={18} color="#FFD700" />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
          工单类型分布
        </span>
      </div>

      {/* Bar */}
      <div style={{
        display: 'flex',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16
      }}>
        {items.map(item => (
          <div
            key={item.label}
            style={{
              flex: item.value,
              background: item.color
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16 }}>
        {items.map(item => (
          <div key={item.label} style={{ flex: 1 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              marginBottom: 4
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: item.color
              }} />
              <span style={{ fontSize: 12, color: '#888' }}>{item.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
              {item.value}
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>
              {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==============================
// Recent Activity List
// ==============================

interface RecentActivityProps {
  activities: Array<{
    id: number;
    ticket_number: string;
    action: string;
    actor: string;
    time: string;
  }>;
}

export const RecentActivityList: React.FC<RecentActivityProps> = ({ activities }) => {
  return (
    <div style={{
      background: 'rgba(30, 30, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: 20,
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 16
      }}>
        <Clock size={18} color="#FFD700" />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
          最近活动
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activities.slice(0, 5).map(activity => (
          <div 
            key={activity.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#FFD700'
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#ccc' }}>
                <span style={{ color: '#FFD700' }}>{activity.ticket_number}</span>
                {' '}{activity.action}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>
                {activity.actor} · {activity.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==============================
// Overview Dashboard
// ==============================

interface OverviewDashboardProps {
  stats?: DashboardStats;
  loading?: boolean;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  stats,
  loading
}) => {
  if (loading || !stats) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: '#666' 
      }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 600, 
          color: '#fff',
          marginBottom: 4
        }}>
          服务概览
        </h1>
        <p style={{ fontSize: 14, color: '#888' }}>
          实时监控工单状态与 SLA 健康度
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24
      }}>
        <StatCard
          title="待处理工单"
          value={stats.total_open}
          icon={Clock}
          color="#3B82F6"
        />
        <StatCard
          title="今日完成"
          value={stats.total_closed_today}
          icon={CheckCircle}
          color="#10B981"
        />
        <StatCard
          title="平均响应时间"
          value={`${stats.avg_response_time}h`}
          subtitle="首次响应"
          icon={TrendingUp}
          color="#FFD700"
        />
        <StatCard
          title="P0 紧急工单"
          value={stats.by_priority.P0}
          icon={AlertTriangle}
          color="#EF4444"
        />
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 16
      }}>
        <SlaHealthIndicator
          breachRate={stats.sla_breach_rate}
          warningCount={stats.by_status?.warning || 0}
          breachedCount={stats.by_status?.breached || 0}
        />
        <TypeDistribution data={stats.by_type} />
        <RecentActivityList activities={[]} />
      </div>
    </div>
  );
};

export default {
  StatCard,
  SlaHealthIndicator,
  TypeDistribution,
  RecentActivityList,
  OverviewDashboard
};
