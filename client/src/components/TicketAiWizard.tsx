import React, { useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Sparkles, ArrowRight, Save, RotateCcw } from 'lucide-react';

interface TicketData {
    customer_name: string;
    contact_info: string;
    product_model: string;
    issue_summary: string;
    issue_description: string;
    urgency: 'Normal' | 'High' | 'Critical';
}

const TicketAiWizard: React.FC = () => {
    const { token } = useAuthStore();
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!inputText.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const res = await axios.post('/api/ai/ticket_parse',
                { text: inputText },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success && res.data.data) {
                setTicketData(res.data.data);
            } else {
                setError('Failed to parse ticket data');
            }
        } catch (err: any) {
            console.error('AI Processing Error:', err);
            setError(err.response?.data?.details || err.message || 'AI processing failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        // TODO: Connect to actual ticket creation API
        alert(JSON.stringify(ticketData, null, 2));
        console.log('Submitting ticket:', ticketData);
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-main)' }}>
            <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    padding: '10px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
                }}>
                    <Sparkles size={24} color="#000" />
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>AI Smart Ticket Assistant</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
                        Paste email or chat logs below, and Bokeh will fill the form for you.
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* LEFT COLUMN: Input */}
                <div className="card" style={{
                    background: 'var(--glass-bg-light)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Input Source</span>
                        <button
                            onClick={() => { setInputText(''); setTicketData(null); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            title="Clear"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </h3>
                    <textarea
                        placeholder="Paste email content, WeChat history, or issue description here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        style={{
                            width: '100%',
                            flex: 1,
                            minHeight: '300px',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            padding: '12px',
                            color: 'var(--text-main)',
                            fontSize: '0.95rem',
                            lineHeight: '1.5',
                            resize: 'none',
                            marginBottom: '16px'
                        }}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !inputText.trim()}
                        style={{
                            background: loading ? 'var(--text-secondary)' : '#FFD700',
                            color: loading ? 'white' : 'black',
                            border: 'none',
                            padding: '12px',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            boxShadow: loading ? 'none' : '0 2px 8px rgba(255, 215, 0, 0.3)'
                        }}
                    >
                        {loading ? (
                            <>Generating...</>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Analyze & Extract
                            </>
                        )}
                    </button>
                    {error && (
                        <div style={{ marginTop: '12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                            Error: {error}
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Output Form */}
                <div className="card" style={{
                    background: loading ? 'rgba(255,255,255,0.02)' : 'var(--glass-bg-light)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--glass-border)',
                    opacity: ticketData ? 1 : 0.5,
                    pointerEvents: ticketData ? 'auto' : 'none',
                    transition: 'all 0.3s'
                }}>
                    <h3 style={{ marginTop: 0 }}>Ticket Preview</h3>

                    {!ticketData && !loading && (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', flexDirection: 'column', gap: '12px' }}>
                            <ArrowRight size={32} />
                            <div>Waiting for generation...</div>
                        </div>
                    )}

                    {ticketData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="field-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Customer Name</label>
                                <input
                                    type="text"
                                    value={ticketData.customer_name || ''}
                                    onChange={(e) => setTicketData({ ...ticketData, customer_name: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div className="field-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Contact Info</label>
                                <input
                                    type="text"
                                    value={ticketData.contact_info || ''}
                                    onChange={(e) => setTicketData({ ...ticketData, contact_info: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div className="field-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Product Model</label>
                                <input
                                    type="text"
                                    value={ticketData.product_model || ''}
                                    onChange={(e) => setTicketData({ ...ticketData, product_model: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div className="field-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Urgency</label>
                                <select
                                    value={ticketData.urgency || 'Normal'}
                                    onChange={(e) => setTicketData({ ...ticketData, urgency: e.target.value as any })}
                                    style={inputStyle}
                                >
                                    <option value="Normal">Normal</option>
                                    <option value="High">High</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </div>

                            <div className="field-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Issue Summary</label>
                                <input
                                    type="text"
                                    value={ticketData.issue_summary || ''}
                                    onChange={(e) => setTicketData({ ...ticketData, issue_summary: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div className="field-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Detailed Description</label>
                                <textarea
                                    value={ticketData.issue_description || ''}
                                    onChange={(e) => setTicketData({ ...ticketData, issue_description: e.target.value })}
                                    style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={handleCreate}
                                    style={{
                                        flex: 1,
                                        background: '#10b981', // Success green is allowed for confirming actions
                                        color: 'var(--text-main)',
                                        border: 'none',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Save size={18} />
                                    Confirm & Create Ticket
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--glass-border)',
    background: 'var(--glass-shadow)',
    color: 'var(--text-main)',
    fontSize: '0.9rem'
};

export default TicketAiWizard;
