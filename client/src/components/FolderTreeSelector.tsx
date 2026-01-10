import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { translatePathSegment } from '../utils/pathTranslator';

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
    isProcessing?: boolean;
}

const FolderTreeSelector: React.FC<Props & { username?: string }> = ({ token, currentPath, onSelect, onClose, username, isProcessing }) => {
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
    const { t } = useLanguage();

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

    const processedTree = React.useMemo(() => {
        if (!folderTree.length) return [];
        // The API returns [{ path: '', name: '根目录', children: [...] }]
        // We want to reconstruct the top-level list displayed to the user.
        // 1. Get the actual children of the root
        const rootNode = folderTree[0];
        const actualRoots = rootNode.children || [];

        if (!username) return actualRoots;

        const newTree: FolderNode[] = [];
        const membersNode = actualRoots.find(n => n.path.toLowerCase() === 'members');

        // Add all non-members nodes from the root's children
        actualRoots.forEach(node => {
            if (node.path.toLowerCase() !== 'members' && !node.name.startsWith('.')) {
                newTree.push(node);
            }
        });

        // Hoist personal space
        if (membersNode && membersNode.children) {
            const personalNode = membersNode.children.find(n => n.name.toLowerCase() === username.toLowerCase());
            if (personalNode) {
                // Determine if we should rename or keep as is. User asked for "username".
                // It is already named "username".
                newTree.unshift({ ...personalNode }); // Add to top
            }
        } else if (!membersNode) {
            // If Members node is not found in root's children, maybe I AM the Members node? 
            // Unlikely given API structure.
            // But if specific user permissions are set, maybe personal folder IS at root? (No, structure is fixed)
        }

        return newTree;
    }, [folderTree, username]);

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
        // Don't close immediately if we want to show loading state. 
        // The parent component should handle closing on success.
        if (!isProcessing) {
            // If parent doesn't pass isProcessing (legacy), close immediately.
            // But if we want consistent behavior, we rely on parent.
            // For now, let's keep onClose() if isProcessing is undefined, 
            // but if it IS defined, we expect parent to close it.
            if (typeof isProcessing === 'undefined') {
                onClose();
            }
        }
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
                        background: isSelected ? 'rgba(255, 210, 0, 0.1)' : 'transparent',
                        color: isSelected ? '#FFD700' : 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '8px',
                        marginBottom: '4px',
                        border: isSelected ? '1px solid #FFD700' : '1px solid transparent',
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
                        {node.name ? translatePathSegment(node.name, t) : t('modal.root_folder')}
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
                zIndex: 4500,
                backdropFilter: 'blur(4px)'
            }}
            onClick={isProcessing ? undefined : onClose}
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
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            margin: 0,
                            color: '#FFFFFF'
                        }}>
                            {t('modal.select_destination')}
                        </h2>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            margin: '8px 0 0 0'
                        }}>
                            {t('modal.select_location')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            color: '#fff',
                            transition: 'background 0.2s',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                        onMouseEnter={e => !isProcessing && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
                        onMouseLeave={e => !isProcessing && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
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
                            {t('browser.loading')}
                        </div>
                    ) : (
                        processedTree.map(node => renderNode(node))
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'transparent',
                            color: 'rgba(255, 255, 255, 0.8)',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!isProcessing) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            if (!isProcessing) e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {t('action.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedPath || selectedPath === currentPath || isProcessing}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: selectedPath && selectedPath !== currentPath
                                ? 'var(--accent-blue)'
                                : 'rgba(255, 255, 255, 0.1)',
                            color: selectedPath && selectedPath !== currentPath
                                ? '#000'
                                : 'rgba(255, 255, 255, 0.3)',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: selectedPath && selectedPath !== currentPath && !isProcessing ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: isProcessing ? 0.7 : 1
                        }}
                    >
                        {isProcessing ? <><div className="loading-spinner-sm" style={{ width: 14, height: 14, borderLeftColor: '#000' }}></div>{t('status.moving')}</> : t('modal.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderTreeSelector;
