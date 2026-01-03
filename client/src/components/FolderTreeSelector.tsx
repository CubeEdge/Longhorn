import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, ChevronRight, ChevronDown } from 'lucide-react';

interface FolderNode {
    path: string;
    name: string;
    children?: FolderNode[];
}

interface Props {
    token: string;
    currentPath: string;
    onSelect: (path: string) => void;
    onClose: () => void;
}

const FolderTreeSelector: React.FC<Props> = ({ token, currentPath, onSelect, onClose }) => {
    // Auto-expand current path and parent paths
    const getInitialExpandedPaths = () => {
        const paths = new Set<string>(['']); // Always expand root
        if (currentPath) {
            const parts = currentPath.split('/').filter(Boolean);
            let accumulated = '';
            for (const part of parts) {
                accumulated = accumulated ? `${accumulated}/${part}` : part;
                paths.add(accumulated);
            }
        }
        return paths;
    };

    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(getInitialExpandedPaths());
    const [selectedPath, setSelectedPath] = useState<string>(currentPath || '');
    const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFolderTree();
    }, []);

    const fetchFolderTree = async () => {
        try {
            const res = await axios.get('/api/folders/tree', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFolderTree(res.data);
        } catch (err) {
            console.error('Failed to fetch folder tree:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (path: string) => {
        const newExpanded = new Set(expandedPaths);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedPaths(newExpanded);
    };

    const handleSelect = (path: string) => {
        setSelectedPath(path);
    };

    const handleConfirm = () => {
        if (selectedPath !== currentPath) {
            onSelect(selectedPath);
        }
        onClose();
    };

    const renderNode = (node: FolderNode, level: number = 0) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = selectedPath === node.path;
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.path}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 12px',
                        paddingLeft: `${12 + level * 20}px`,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                        color: isSelected ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '8px',
                        marginBottom: '4px',
                        border: isSelected ? '2px solid var(--accent-blue)' : 'none',
                        transition: 'all 0.2s',
                        fontWeight: isSelected ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                        if (!isSelected) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                        }
                    }}
                    onClick={() => handleSelect(node.path)}
                    onDoubleClick={() => hasChildren && toggleExpand(node.path)}
                >
                    {hasChildren && (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(node.path);
                            }}
                            style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}
                        >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                    )}
                    {!hasChildren && <span style={{ width: '24px' }} />}
                    <Folder size={16} style={{ marginRight: '8px' }} />
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                        {node.name || '根目录'}
                    </span>
                </div>
                {isExpanded && hasChildren && (
                    <div>
                        {node.children!.map(child => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#2C2C2E',
                    borderRadius: '20px',
                    padding: '28px',
                    width: '560px',
                    maxHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ marginBottom: '20px' }}>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        margin: 0,
                        color: '#FFFFFF'
                    }}>
                        选择目标文件夹
                    </h2>
                    <p style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        margin: '8px 0 0 0'
                    }}>
                        选择要移动到的文件夹位置
                    </p>
                </div>

                {/* Tree Container */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '12px',
                        padding: '12px',
                        marginBottom: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                >
                    {loading ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '30px',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }}>
                            加载中...
                        </div>
                    ) : (
                        folderTree.map(node => renderNode(node))
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'transparent',
                            color: 'rgba(255, 255, 255, 0.8)',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedPath || selectedPath === currentPath}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: selectedPath && selectedPath !== currentPath
                                ? 'var(--accent-blue)'
                                : 'rgba(255, 255, 255, 0.1)',
                            color: selectedPath && selectedPath !== currentPath
                                ? '#FFF'
                                : 'rgba(255, 255, 255, 0.3)',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: selectedPath && selectedPath !== currentPath ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (selectedPath && selectedPath !== currentPath) {
                                e.currentTarget.style.background = '#0066CC';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (selectedPath && selectedPath !== currentPath) {
                                e.currentTarget.style.background = 'var(--accent-blue)';
                            }
                        }}
                    >
                        确定移动
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderTreeSelector;
