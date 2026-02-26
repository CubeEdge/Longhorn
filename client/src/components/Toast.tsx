import React from 'react';
import { useToast } from '../store/useToast';
import type { ToastType } from '../store/useToast';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={20} color="#10B981" />,
    error: <XCircle size={20} color="#ef4444" />,
    info: <Info size={20} color="#3b82f6" />,
    warning: <AlertTriangle size={20} color="#f59e0b" />
};

const borderColorMap: Record<ToastType, string> = {
    success: '#10B981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b'
};

const Toast: React.FC = () => {
    const { toasts, hideToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast-item"
                    style={{ borderLeftColor: borderColorMap[toast.type] }}
                >
                    <div className="toast-icon">{iconMap[toast.type]}</div>
                    <div className="toast-message">{toast.message}</div>
                    <button className="toast-close" onClick={() => hideToast(toast.id)}>
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default Toast;
