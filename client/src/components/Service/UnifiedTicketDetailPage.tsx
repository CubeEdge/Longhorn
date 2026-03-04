/**
 * UnifiedTicketDetailPage (统一工单详情页入口)
 * 所有工单详情路由统一指向此页面
 * 路由: /service/tickets/:id
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UnifiedTicketDetail from '../Workspace/UnifiedTicketDetail';

const UnifiedTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const ticketId = parseInt(id || '0', 10);

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
        />
    );
};

export default UnifiedTicketDetailPage;
