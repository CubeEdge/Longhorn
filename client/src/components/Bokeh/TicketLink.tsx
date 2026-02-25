import { MessageCircleQuestion, RefreshCw, Wrench, Ticket } from 'lucide-react';

interface TicketLinkProps {
    ticketNumber: string;
    ticketId: number;
    ticketType: 'inquiry' | 'rma' | 'dealer_repair';
    onOpenDetail: () => void;
}

export const getTicketStyles = (type: string | undefined) => {
    switch (type) {
        case 'inquiry':
        case 'Inquiry':
            return {
                bg: 'rgba(59, 130, 246, 0.15)',
                border: 'rgba(59, 130, 246, 0.4)',
                hoverBg: 'rgba(59, 130, 246, 0.25)',
                hoverBorder: 'rgba(59, 130, 246, 0.6)',
                color: '#60A5FA', // Blue
                icon: <MessageCircleQuestion size={14} />,
            };
        case 'rma':
        case 'RMA':
            return {
                bg: 'rgba(249, 115, 22, 0.15)',
                border: 'rgba(249, 115, 22, 0.4)',
                hoverBg: 'rgba(249, 115, 22, 0.25)',
                hoverBorder: 'rgba(249, 115, 22, 0.6)',
                color: '#FB923C', // Orange
                icon: <RefreshCw size={14} />,
            };
        case 'dealer_repair':
        case 'Dealer Repair':
            return {
                bg: 'rgba(168, 85, 247, 0.15)',
                border: 'rgba(168, 85, 247, 0.4)',
                hoverBg: 'rgba(168, 85, 247, 0.25)',
                hoverBorder: 'rgba(168, 85, 247, 0.6)',
                color: '#C084FC', // Purple
                icon: <Wrench size={14} />,
            };
        default:
            return {
                bg: 'rgba(16, 185, 129, 0.15)',
                border: 'rgba(16, 185, 129, 0.4)',
                hoverBg: 'rgba(16, 185, 129, 0.25)',
                hoverBorder: 'rgba(16, 185, 129, 0.6)',
                color: '#10B981', // Kine Green
                icon: <Ticket size={14} />,
            };
    }
};

/**
 * TicketLink Component
 * Renders clickable ticket references in Bokeh chat
 */
// @ts-ignore - ticketId reserved for future use in ticket detail link
const TicketLink: React.FC<TicketLinkProps> = ({ ticketNumber, ticketId, ticketType, onOpenDetail }) => {
    const styles = getTicketStyles(ticketType);
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: styles.bg,
                border: `1px solid ${styles.border}`,
                padding: '1px 8px',
                borderRadius: '6px',
                color: styles.color,
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 500,
                margin: '0 4px',
                verticalAlign: 'bottom',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = styles.hoverBg;
                e.currentTarget.style.borderColor = styles.hoverBorder;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = styles.bg;
                e.currentTarget.style.borderColor = styles.border;
            }}
        >
            <span style={{ display: 'flex', marginTop: '-1px' }}>
                {styles.icon}
            </span>
            [{ticketNumber}]
        </span>
    );
};

/**
 * Parse ticket references from text and render with TicketLink components
 * Supports Format A: [K2602-0001|123|inquiry] (Legacy/Detailed)
 * Supports Format B: [K2602-0001] or [RMA-D-2601-0004] (Simple AI response)
 */
export function parseTicketReferences(
    text: string,
    onOpenTicketDetail: (ticketNumber: string, ticketId: number, ticketType: string) => void
): React.ReactNode[] {
    // Defensive: ensure text is always a string
    if (typeof text !== 'string') {
        const safeText = text ? String(text) : '';
        return safeText ? [safeText] : [];
    }

    // Regex to match either [ID|Num|Type] OR just [ID]
    // Group 1: Complex match Number, Group 2: ID, Group 3: Type
    // Group 4: Simple match Number
    const ticketPattern = /\[([A-Z0-9-]+)\|(\d+)\|(inquiry|rma|dealer_repair)\]|\[(([A-Z]+-)?[A-Z]?\d{4}-\d{4})\]/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = ticketPattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        // Add TicketLink component
        const isComplexMatch = !!match[1];
        const ticketNumber = isComplexMatch ? match[1] : match[4];
        const ticketId = isComplexMatch ? parseInt(match[2]) : 0; // Use 0 or derive from simple

        let ticketType = isComplexMatch ? match[3] : 'inquiry';
        if (!isComplexMatch) {
            if (ticketNumber.startsWith('RMA')) ticketType = 'rma';
            else if (ticketNumber.startsWith('SVC') || ticketNumber.includes('DEALER')) ticketType = 'dealer_repair';
        }

        parts.push(
            <TicketLink
                key={`ticket-${lastIndex}-${match.index}`}
                ticketNumber={ticketNumber}
                ticketId={ticketId}
                ticketType={ticketType as 'inquiry' | 'rma' | 'dealer_repair'}
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
