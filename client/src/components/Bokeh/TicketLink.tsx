import React from 'react';

interface TicketLinkProps {
    ticketNumber: string;
    ticketId: number;
    ticketType: 'inquiry' | 'rma' | 'dealer_repair';
    onOpenDetail: () => void;
}

/**
 * TicketLink Component
 * Renders clickable ticket references in Bokeh chat
 */
// @ts-ignore - ticketId reserved for future use in ticket detail link
const TicketLink: React.FC<TicketLinkProps> = ({ ticketNumber, ticketId, ticketType, onOpenDetail }) => {
    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'inquiry': return '🎫咨询';
            case 'rma': return '🔧维修';
            case 'dealer_repair': return '🛠️经销商';
            default: return '';
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Show detail popup first
        onOpenDetail();
    };

    return (
        <span
            onClick={handleClick}
            className="ticket-link"
            style={{
                color: '#00BFA5',
                textDecoration: 'none',
                fontWeight: 600,
                padding: '2px 6px',
                background: 'rgba(0, 191, 165, 0.1)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 191, 165, 0.2)';
                e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 191, 165, 0.1)';
                e.currentTarget.style.textDecoration = 'none';
            }}
        >
            [{ticketNumber}] <span style={{ fontSize: '0.85em', opacity: 0.8 }}>{getTypeLabel(ticketType)}</span>
        </span>
    );
};

/**
 * Parse ticket references from text and render with TicketLink components
 * Format: [K2602-0001|123|inquiry]
 */
export function parseTicketReferences(
    text: string,
    onOpenTicketDetail: (ticketNumber: string, ticketId: number, ticketType: string) => void
): React.ReactNode[] {
    // Regex to match [ticket_number|ticket_id|ticket_type]
    const ticketPattern = /\[([A-Z0-9-]+)\|(\d+)\|(inquiry|rma|dealer_repair)\]/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = ticketPattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        // Add TicketLink component
        const ticketNumber = match[1];
        const ticketId = parseInt(match[2]);
        const ticketType = match[3] as 'inquiry' | 'rma' | 'dealer_repair';

        parts.push(
            <TicketLink
                key={`ticket-${ticketNumber}-${ticketId}`}
                ticketNumber={ticketNumber}
                ticketId={ticketId}
                ticketType={ticketType}
                onOpenDetail={() => onOpenTicketDetail(ticketNumber, ticketId, ticketType)}
            />
        );

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
}

export default TicketLink;
