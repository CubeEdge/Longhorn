/**
 * UnifiedTicketDetailPage (统一工单详情页入口)
 * 所有工单详情路由统一指向此页面
 * 路由: /service/tickets/:id
 * 支持 ?ctx=my_tasks|team_queue|mentioned|search|archive 传递场景语境
 */

import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import UnifiedTicketDetail from '../Workspace/UnifiedTicketDetail';

const UnifiedTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const ticketId = parseInt(id || '0', 10);
    const ctx = searchParams.get('ctx') as any || 'search';

    if (!ticketId) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                无效的工单ID
            </div>
        );
    }

    return (
        <UnifiedTicketDetail
            ticketId={ticketId}
            onBack={() => navigate(-1)}
            viewContext={ctx}
        />
    );
};

export default UnifiedTicketDetailPage;
