import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import {
    Folder,
    File,
    Video,
    Share2,
    Plus,
    ChevronLeft,
    Upload,
    Check,
    LayoutGrid,
    List,
    X,
    Download,
    FileText,
    Table as TableIcon,
    MoreHorizontal,
    Info,
    Trash2,
    Eye,
    User,
    Clock,
    ChevronRight,
    Star,
    Link2,
    Move,
    FolderPlus
} from 'lucide-react';
import { format } from 'date-fns';
import FolderTreeSelector from './FolderTreeSelector';
import ShareResultModal from './ShareResultModal';
import { useCachedFiles, prefetchDirectories } from '../hooks/useCachedFiles';

interface FileItem {
    name: string;
    isDirectory: boolean;
    path: string;
    size: number;
    mtime: string;
    accessCount?: number;
    uploader?: string;
}

interface AccessLog {
    username: string;
    count: number;
    last_access: string;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'name' | 'mtime' | 'size' | 'accessCount' | 'uploader';
type SortOrder = 'asc' | 'desc';

interface MenuAnchor {
    x: number;
    y: number;
    file: FileItem;
}

interface FileBrowserProps {
    mode?: 'all' | 'recent' | 'starred' | 'personal';
}

const FileBrowser: React.FC<FileBrowserProps> = ({ mode = 'all' }) => {
    const { t } = useLanguage();
    const params = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    // Calculate effective path based on router params and mode
    const effectivePath = React.useMemo(() => {
        if (mode === 'personal') {
            const user = useAuthStore.getState().user;
            return user && user.username ? `Members/${user.username}` : '';
        } else if (mode === 'all') {
            let path = params.deptCode || '';
            if (params['*']) {
                const subPath = params['*'];
                path = path ? `${path}/${subPath}` : subPath;
            }
            return path;
        }
        return '';
    }, [mode, params.deptCode, params['*']]);

    // Use SWR hook for file listing
    const {
        files,
        userCanWrite: canWrite,
        isLoading: isFilesLoading,
        refresh
    } = useCachedFiles(effectivePath, mode);

    // Derived state for current path
    const currentPath = effectivePath;

    // Other UI states
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Preview & Menu State
    const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [excelHtml, setExcelHtml] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);

    // Stats Modal State
    const [statsFile, setStatsFile] = useState<FileItem | null>(null);
    const [accessHistory, setAccessHistory] = useState<AccessLog[]>([]);

    // New Folder State
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Bulk Actions State
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [moveTargetDir, setMoveTargetDir] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [shareItem, setShareItem] = useState<any>(null);
    const [sharePassword, setSharePassword] = useState('');
    const [shareExpires, setShareExpires] = useState('7');
    const [shareLanguage, setShareLanguage] = useState<'zh' | 'en' | 'de' | 'ja'>('zh');
    const [shareResult, setShareResult] = useState<{ url: string, password: string, expires: string } | null>(null);
    const [showBatchShareDialog, setShowBatchShareDialog] = useState(false);
    const [batchShareName, setBatchShareName] = useState('');
    const [batchSharePassword, setBatchSharePassword] = useState('');
    const [batchShareExpires, setBatchShareExpires] = useState('7');
    const [batchShareLanguage, setBatchShareLanguage] = useState<'zh' | 'en' | 'de' | 'ja'>('zh');
    const [starredFiles, setStarredFiles] = useState<string[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState<string>('');
    const [isSharing, setIsSharing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // General loading state for file ops

    // const { deptCode } = useParams(); // Removed in favor of params usage below
    const { token } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docContainerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Wrapper for manual refresh (used by other actions)
    const fetchFiles = async (_path?: string) => {
        // path argument is ignored because SWR handles it via props
        await refresh();
    };

    const effectiveMode = React.useMemo(() => {
        return mode;
    }, [mode]);

    // Cleanup selection when path changes
    useEffect(() => {
        setSelectedPaths([]);
    }, [currentPath]);

    // Fetch starred files
    useEffect(() => {
        if (token) {
            axios.get('/api/starred', {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                setStarredFiles(res.data.map((item: any) => item.file_path));
            }).catch(err => console.error('Failed to fetch starred:', err));
        }
    }, [token]);

    // Prefetch visible subdirectories for faster navigation
    useEffect(() => {
        if (files.length > 0 && token) {
            const subdirs = files.filter(f => f.isDirectory).map(f => f.name).slice(0, 5); // Prefetch first 5 subdirs
            prefetchDirectories(subdirs, currentPath, token);
        }
    }, [files, currentPath, token]);

    const handleStar = async (item: FileItem) => {
        const isStarred = starredFiles.includes(item.path);

        try {
            if (isStarred) {
                // Unstar: find the starred file ID first
                const check = await axios.get(`/api/starred/check?path=${encodeURIComponent(item.path)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (check.data.id) {
                    await axios.delete(`/api/starred/${check.data.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setStarredFiles(starredFiles.filter(p => p !== item.path));
                    alert('✅ 已取消星标');
                }
            } else {
                // Star
                await axios.post('/api/starred', {
                    path: item.path
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStarredFiles([...starredFiles, item.path]);
                alert(`⭐ ${t('starred.added')}`);
            }
        } catch (err: any) {
            console.error('Failed to toggle star:', err);
            alert('❌ 操作失败：' + (err.response?.data?.error || err.message));
        }
    };


    // Event Listeners
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closePreview();
                setIsCreatingFolder(false);
                setStatsFile(null);
            }
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuAnchor(null);
            }
            // Note: Modal click-outside is handled by its own overlay
        };
        window.addEventListener('keydown', handleEsc);
        window.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('keydown', handleEsc);
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Increment hit counter
    const recordAccess = async (file: FileItem) => {
        try {
            await axios.post('/api/files/hit', { path: file.path }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await refresh(); // Revalidate to get new hit count
        } catch (err) {
            console.error("Failed to record access", err);
        }
    };

    // Fetch detailed stats
    const fetchStats = async (file: FileItem) => {
        try {
            const res = await axios.get(`/api/files/stats?path=${file.path}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAccessHistory(res.data);
            setStatsFile(file);
        } catch (err) {
            console.error("Failed to fetch statistics", err);
        }
    };

    // Rendering logic for DOCX/XLSX
    useEffect(() => {
        if (previewFile && (docContainerRef.current || previewFile)) {
            const ext = previewFile.name.split('.').pop()?.toLowerCase();
            recordAccess(previewFile);

            if (ext === 'docx' && docContainerRef.current) {
                axios.get(`/preview/${previewFile.path}`, { responseType: 'blob' })
                    .then(res => renderAsync(res.data, docContainerRef.current!))
                    .catch(err => console.error(err));
            } else if (['xlsx', 'xls'].includes(ext || '')) {
                axios.get(`/preview/${previewFile.path}`, { responseType: 'arraybuffer' })
                    .then(res => {
                        const workbook = XLSX.read(res.data, { type: 'array' });
                        const html = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]], { id: 'excel-table' });
                        setExcelHtml(html.replace('<table', '<table class="excel-table"'));
                    });
            } else if (['txt', 'md', 'js', 'ts', 'css'].includes(ext || '')) {
                axios.get(`/preview/${previewFile.path}`).then(res => setTextContent(res.data));
            }
        }
    }, [previewFile]);

    const handleFolderClick = (path: string) => {
        // Handle Personal Space Navigation
        if (user && path.startsWith(`Members/${user.username}`)) {
            const prefix = `Members/${user.username}/`;
            if (path === `Members/${user.username}`) {
                navigate('/personal');
            } else {
                // Ensure we don't end up with /personal/Members/admin/foo
                const subPath = path.startsWith(prefix) ? path.substring(prefix.length) : path;
                navigate(`/personal/${subPath}`);
            }
            return;
        }

        // Handle Department/General Navigation
        navigate(`/dept/${path}`);
    };
    const handleBack = () => {
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        fetchFiles(parts.join('/'));
    };


    const handleUploadClick = () => {
        if (uploading) {
            cancelUpload();
        } else {
            fileInputRef.current?.click();
        }
    };

    const cancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setUploading(false);
            setUploadProgress(0);
            setUploadStatus('idle');
            // Reset file input so the same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setUploading(true);
        setUploadProgress(0);

        // Create new AbortController
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const formData = new FormData();
        Array.from(e.target.files).forEach(f => formData.append('files', f));

        let isCancelled = false;

        try {
            await axios.post(`/api/upload?path=${currentPath}`, formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
                signal: controller.signal,
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(percentCompleted);
                    // Calculate speed from rate (bytes per second)
                    if (progressEvent.rate) {
                        const rate = progressEvent.rate;
                        if (rate >= 1024 * 1024) {
                            setUploadSpeed(`${(rate / (1024 * 1024)).toFixed(1)} MB/s`);
                        } else if (rate >= 1024) {
                            setUploadSpeed(`${(rate / 1024).toFixed(0)} KB/s`);
                        } else {
                            setUploadSpeed(`${rate} B/s`);
                        }
                    }
                }
            });
            setUploadStatus('success');
            fetchFiles(currentPath);
        } catch (error: any) {
            if (axios.isCancel(error)) {
                console.log('Upload cancelled');
                isCancelled = true;
                // Status/input reset already handled in cancelUpload if called via UI
                // But if called via abort() here for some reason, we ensure consistency
            } else {
                setUploadStatus('error');
            }
        } finally {
            if (!isCancelled) {
                if (abortControllerRef.current) {
                    setUploading(false);
                    setTimeout(() => setUploadStatus('idle'), 3000);
                    abortControllerRef.current = null;
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await axios.post('/api/folders', { path: currentPath, name: newFolderName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsCreatingFolder(false);
            setNewFolderName('');
            fetchFiles(currentPath);
        } catch (err) {
            alert("创建文件夹失败");
        } finally {
            setIsProcessing(false);
        }
    };

    const formattedSortedFiles = [...files].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        let valA = a[sortKey as keyof FileItem], valB = b[sortKey as keyof FileItem];
        if (typeof valA === 'string' && typeof valB === 'string') return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortOrder === 'asc' ? ((valA as number) || 0) - ((valB as number) || 0) : ((valB as number) || 0) - ((valA as number) || 0);
    });

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '--';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
    };

    const isPreviewable = (f: string) => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'm4v', 'heic', 'heif', 'pdf', 'docx', 'xlsx', 'xls', 'txt', 'md', 'js', 'ts'].includes(f.split('.').pop()?.toLowerCase() || '');

    const handleItemClick = (item: FileItem) => {
        if (item.isDirectory) handleFolderClick(item.path);
        else if (isPreviewable(item.name)) { setPreviewFile(item); setIsZoomed(false); setTextContent(null); setExcelHtml(null); }
    };

    const closePreview = () => { setPreviewFile(null); setIsZoomed(false); setTextContent(null); setExcelHtml(null); };

    const handleOpenMenu = (e: React.MouseEvent, file: FileItem) => {
        e.stopPropagation();
        setMenuAnchor({ x: e.clientX, y: e.clientY, file });
    };

    const handleStarFile = async (item: any) => {
        try {
            const filePath = `${currentPath}/${item.name}`.replace(/^\/+/, '');
            await axios.post('/api/starred',
                { path: filePath },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(t('starred.added'));
        } catch (err: any) {
            if (err.response?.status === 409) {
                alert(t('starred.already_starred'));
            } else {
                alert(t('starred.add_failed'));
            }
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: any) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleDelete = async (item: any) => {
        if (!window.confirm(t('dialog.confirm_delete', { name: item.name }))) return;
        try {
            await axios.delete(`/api/files?path=${item.path}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchFiles(currentPath);
            setMenuAnchor(null);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || t('error.delete_failed');
            alert(errorMsg);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(t('dialog.confirm_batch_delete', { count: selectedPaths.length }))) return;
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const res = await axios.post('/api/files/bulk-delete', { paths: selectedPaths }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.failedItems && res.data.failedItems.length > 0) {
                const successCount = res.data.deletedCount;
                const failCount = res.data.failedItems.length;
                alert(`⚠️ 操作部分完成\n\n✅ 成功删除: ${successCount} 个\n❌ 删除失败: ${failCount} 个\n\n失败项目:\n${res.data.failedItems.join('\n')}\n\n原因: 权限不足 (仅管理员或上传者可删除)`);
            } else {
                alert(`✅ ${t('message.delete_success')}`);
            }

            setSelectedPaths([]);
            fetchFiles(currentPath);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || t('error.batch_delete_failed');
            alert(`❌ ${errorMsg}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkMove = async (targetPath?: string) => {
        const finalTarget = targetPath || moveTargetDir;
        if (!finalTarget) {
            alert(t('modal.select_folder_prompt'));
            return;
        }

        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const res = await axios.post('/api/files/bulk-move', {
                paths: selectedPaths,
                targetDir: finalTarget
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.failedItems && res.data.failedItems.length > 0) {
                const successCount = res.data.movedCount;
                const failCount = res.data.failedItems.length;
                alert(`⚠️ 操作部分完成\n\n✅ 成功移动: ${successCount} 个\n❌ 移动失败: ${failCount} 个\n\n失败项目:\n${res.data.failedItems.join('\n')}\n\n原因: 权限不足 (仅管理员或上传者可移动)`);
            } else {
                alert(t('alert.move_success'));
            }

            fetchFiles(currentPath);
            setSelectedPaths([]);
            setMoveTargetDir('');
            setIsMoveModalOpen(false); // Close modal on success
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || t('error.batch_move_failed');
            alert(`❌ ${errorMsg}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBatchDownload = async () => {
        if (selectedPaths.length === 0) {
            alert(t('alert.select_files_download'));
            return;
        }

        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const response = await axios.post('/api/download-batch',
                { paths: selectedPaths },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Extract filename from content-disposition header or use default
            const contentDisposition = response.headers['content-disposition'];
            const filename = contentDisposition
                ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
                : 'download.zip';

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            // Clear selection after download
            setSelectedPaths([]);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || t('error.download_failed');
            alert(errorMsg);
        }
    };

    const handleBatchShare = async () => {
        if (selectedPaths.length === 0) {
            alert(t('alert.select_files_share'));
            return;
        }

        if (isSharing) return;
        setIsSharing(true);

        try {
            const response = await axios.post('/api/share-collection', {
                paths: selectedPaths,
                name: batchShareName || `Share_${new Date().toISOString().split('T')[0]}`,
                password: batchSharePassword || null,
                expiresIn: batchShareExpires === 'never' ? null : parseInt(batchShareExpires),
                language: batchShareLanguage
            },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (response.data.shareUrl) {
                // Improved clipboard copy with success tracking


                // Method 1: Modern Clipboard API
                try {
                    await navigator.clipboard.writeText(response.data.shareUrl);

                } catch (err1) {
                    console.warn('Clipboard API failed, trying fallback...', err1);

                    // Method 2: execCommand with textarea (more compatible)
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = response.data.shareUrl;
                        textArea.style.position = 'fixed';
                        textArea.style.top = '0';
                        textArea.style.left = '0';
                        textArea.style.width = '2em';
                        textArea.style.height = '2em';
                        textArea.style.padding = '0';
                        textArea.style.border = 'none';
                        textArea.style.outline = 'none';
                        textArea.style.boxShadow = 'none';
                        textArea.style.background = 'transparent';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();

                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                    } catch (err2) {
                        console.warn('execCommand copy also failed', err2);
                    }
                }


                setShareResult({ url: response.data.shareUrl, password: batchSharePassword || "", expires: batchShareExpires === "never" ? t('share.expires_forever') : t('time.days_count', { days: batchShareExpires }) });
                setShowBatchShareDialog(false);
                setSelectedPaths([]);
                setBatchShareName('');
                setBatchSharePassword('');
                setBatchShareExpires('7');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || '创建分享失败';
            alert(`❌ ${errorMsg}`);
        } finally {
            setIsSharing(false);
        }
    };

    const toggleSelect = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        setSelectedPaths(prev =>
            prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
        );
    };

    const selectAll = () => {
        if (selectedPaths.length === files.length) setSelectedPaths([]);
        else setSelectedPaths(files.map(f => f.path));
    };

    const handleShare = async (file: FileItem) => {
        setShareItem(file);
        setShowShareDialog(true);
        setShareExpires('7'); // Default 7 days
        setContextMenu(null);
    };

    const handleCreateShareLink = async () => {
        if (!shareItem) return;
        if (isSharing) return;
        setIsSharing(true);

        try {
            const res = await axios.post('/api/shares', {
                path: shareItem.path,
                password: sharePassword || null,
                expiresIn: shareExpires === 'never' ? null : parseInt(shareExpires),
                language: shareLanguage
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.shareUrl) {
                setShareResult({
                    url: res.data.shareUrl,
                    password: sharePassword || '',
                    expires: shareExpires === 'never' ? t('share.expires_forever') : t('time.days_count', { days: shareExpires })
                });
                setShowShareDialog(false);
                setSharePassword('');
            } else {
                alert('❌ 生成失败：服务器未返回链接');
            }
        } catch (err: any) {
            console.error('Failed to create share link:', err);
            const errorMsg = err.response?.data?.error || err.message || '未知错误';
            alert(`❌ 创建分享链接失败：${errorMsg}`);
        } finally {
            setIsSharing(false);
        }
    };

    const getIcon = (item: FileItem, size: number = 32) => {
        if (item.isDirectory) return <Folder size={size} fill="var(--accent-blue)" color="var(--accent-blue)" opacity={0.9} />;
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext || '')) {
            // Use thumbnail API for faster loading (200px WebP)
            return (
                <div className="thumbnail-box">
                    <img
                        src={`/api/thumbnail?path=${encodeURIComponent(item.path)}&size=200`}
                        className="thumbnail-img"
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                            // Fallback to full preview on thumbnail error
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('/preview/')) {
                                target.src = `/preview/${item.path}`;
                            } else {
                                target.style.display = 'none';
                            }
                        }}
                    />
                </div>
            );
        }
        if (['mp4', 'mov', 'm4v'].includes(ext || '')) return <Video size={size} color="var(--text-secondary)" />;
        if (ext === 'pdf') return <FileText size={size} color="#FF4B4B" />;
        if (ext === 'docx') return <FileText size={size} color="#4B89FF" />;
        if (['xlsx', 'xls'].includes(ext || '')) return <TableIcon size={size} color="#1D6F42" />;
        return <File size={size} color="var(--text-secondary)" />;
    };

    const renderPreviewContent = (file: FileItem) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const url = `/preview/${file.path}`;
        if (ext?.match(/(mp4|mov|m4v|hevc|h265)$/i)) return <video controls autoPlay className="preview-media" onClick={e => e.stopPropagation()}><source src={url} /></video>;
        if (ext === 'pdf') return <iframe src={url} className="doc-preview-container" title="PDF" onClick={e => e.stopPropagation()} />;
        if (ext === 'docx') return <div ref={docContainerRef} className="doc-preview-container" onClick={e => e.stopPropagation()} />;
        if (['xlsx', 'xls'].includes(ext || '')) return <div className="doc-preview-container excel-preview-container" onClick={e => e.stopPropagation()}>{excelHtml ? <div dangerouslySetInnerHTML={{ __html: excelHtml }} /> : t('status.loading_data')}</div>;
        if (['txt', 'md', 'js', 'ts', 'css'].includes(ext || '')) return <div className="doc-preview-container" onClick={e => e.stopPropagation()}><pre className="txt-preview">{textContent}</pre></div>;
        return <img src={url} className={`preview-media ${isZoomed ? 'zoomed' : ''}`} alt="" onDoubleClick={e => { e.stopPropagation(); setIsZoomed(!isZoomed); }} onClick={e => e.stopPropagation()} />;
    };

    return (
        <div className="fade-in">
            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

            {/* Batch Action Bar */}
            {selectedPaths.length > 0 && (
                <div className="batch-action-bar" style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'rgba(32, 32, 32, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '16px',
                    marginBottom: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    flexWrap: 'wrap',
                    gap: 12
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button onClick={() => setSelectedPaths([])} className="btn-icon-only" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                            <X size={18} />
                        </button>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('browser.selected')}<span style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>{selectedPaths.length}</span>{t('browser.items_count')}</span>
                    </div>
                    <div className="batch-action-buttons" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {[
                            { icon: Download, label: t('action.download'), onClick: handleBatchDownload },
                            { icon: Star, label: t('action.star'), onClick: () => selectedPaths.forEach(async (path) => { const file = files.find(f => f.path === path); if (file) await handleStar(file); }) },
                            {
                                icon: Share2, label: t('action.share'), onClick: () => {
                                    setShowBatchShareDialog(true);
                                    const now = new Date();
                                    const dateStr = now.getFullYear() +
                                        String(now.getMonth() + 1).padStart(2, '0') +
                                        String(now.getDate()).padStart(2, '0');
                                    setBatchShareName(dateStr);
                                }
                            },
                            { icon: Move, label: t('action.move'), onClick: () => setIsMoveModalOpen(true) }
                        ].map((action, idx) => (
                            <button
                                key={idx}
                                onClick={action.onClick}
                                disabled={isProcessing}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: '#fff',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                    opacity: isProcessing ? 0.7 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!isProcessing) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isProcessing) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                                    }
                                }}
                            >
                                {isProcessing && action.label === t('action.download') ? <div className="loading-spinner-sm" style={{ width: 14, height: 14 }}></div> : <action.icon size={16} strokeWidth={2.5} color="var(--accent-blue)" />} {action.label}
                            </button>
                        ))}
                        <button
                            onClick={handleBulkDelete}
                            disabled={isProcessing}
                            style={{
                                background: 'rgba(255, 59, 48, 0.1)',
                                color: '#FF3B30',
                                border: '1px solid rgba(255, 59, 48, 0.3)',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.2s',
                                opacity: isProcessing ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!isProcessing) {
                                    e.currentTarget.style.background = 'rgba(255, 59, 48, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 59, 48, 0.3)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isProcessing) {
                                    e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                        >
                            {isProcessing ? <><div className="loading-spinner-sm" style={{ width: 14, height: 14, borderLeftColor: '#FF3B30' }}></div>{t('status.deleting')}</> : <><Trash2 size={16} strokeWidth={2.5} />{t('browser.batch_delete')}</>}
                        </button>

                    </div>
                </div>
            )}


            {/* Top Header */}
            <div className="file-browser-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {mode === 'recent' ? '最近访问' :
                            mode === 'starred' ? '星标文件' :
                                (<>
                                    {/* Breadcrumb with integrated back button */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {currentPath && !(effectiveMode === 'personal' && currentPath.toLowerCase() === `members/${useAuthStore.getState().user?.username.toLowerCase()}`) && (
                                            <button
                                                onClick={handleBack}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.1)',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    borderRadius: '50%',
                                                    width: '40px',
                                                    height: '40px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: 'none'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'var(--accent-blue)';
                                                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                                    e.currentTarget.style.transform = 'scale(1.1)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 210, 0, 0.5)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
                                            </button>
                                        )}
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Kinefinity</span>
                                        {currentPath.split('/').filter(Boolean).map((part, idx, arr) => {
                                            // Handle "Members" hiding in breadcrumb
                                            if (part.toLowerCase() === 'members' && effectiveMode === 'personal') return null;

                                            // Map department codes to full names
                                            let displayName = decodeURIComponent(part);

                                            // Check if this is a top-level department folder (either code 'OP' or full name '运营部 (OP)')
                                            if (idx === 0) {
                                                const deptMap: { [key: string]: string } = {
                                                    'OP': `${t('dept.OP')} (OP)`,
                                                    'MS': `${t('dept.MS')} (MS)`,
                                                    'RD': `${t('dept.RD')} (RD)`,
                                                };

                                                // 1. Try direct code match
                                                if (deptMap[part]) {
                                                    displayName = deptMap[part];
                                                }
                                                // 2. Try extracting code from "Name (CODE)" format
                                                else {
                                                    const match = displayName.match(/\(([A-Z]{2})\)$/);
                                                    if (match && deptMap[match[1]]) {
                                                        displayName = deptMap[match[1]];
                                                    }
                                                }
                                            }

                                            // Calculate path up to this segment
                                            const pathUpTo = arr.slice(0, idx + 1).join('/');
                                            const isLast = idx === arr.length - 1;

                                            return (
                                                <React.Fragment key={idx}>
                                                    <ChevronRight size={16} color="var(--text-secondary)" />
                                                    <span
                                                        onClick={() => {
                                                            if (!isLast) {
                                                                handleFolderClick(pathUpTo);
                                                            }
                                                        }}
                                                        style={{
                                                            color: isLast ? 'var(--text-main)' : 'var(--text-secondary)',
                                                            fontWeight: isLast ? 800 : 400,
                                                            fontSize: isLast ? '1.5rem' : '1rem',
                                                            cursor: isLast ? 'default' : 'pointer',
                                                            transition: 'color 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isLast) e.currentTarget.style.color = 'var(--accent-blue)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isLast) e.currentTarget.style.color = 'var(--text-secondary)';
                                                        }}
                                                    >
                                                        {displayName}
                                                    </span>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </>)
                        }
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="view-toggle">
                        <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid size={18} /></button>
                        <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={18} /></button>
                    </div>
                    {canWrite && (effectiveMode === 'all' || effectiveMode === 'personal') && (
                        <>
                            <button className="btn-icon-only" onClick={() => {
                                setIsCreatingFolder(true);
                                const now = new Date();
                                const dateStr = now.getFullYear() +
                                    String(now.getMonth() + 1).padStart(2, '0') +
                                    String(now.getDate()).padStart(2, '0');
                                setNewFolderName(dateStr);
                            }} title={t("action.new_folder")}>
                                <FolderPlus size={22} color="var(--accent-blue)" strokeWidth={2} />
                            </button>
                            <button className={`btn-primary ${uploading ? 'uploading' : ''}`} onClick={handleUploadClick}>
                                {uploading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <X size={18} />
                                        {uploadProgress === 100 ? (<span>处理中...</span>) : (
                                            <>
                                                {uploadProgress}% {uploadSpeed && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({uploadSpeed})</span>}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Upload size={18} />
                                        <span style={{ fontWeight: 600 }}>{t('common.upload')}</span>
                                    </div>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {
                isCreatingFolder && (
                    <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--accent-blue)', padding: '16px 20px', borderRadius: '12px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', boxShadow: 'var(--shadow-lg)' }}>
                        <Folder color="var(--accent-blue)" size={24} />
                        <input
                            type="text"
                            autoFocus
                            placeholder="文件夹名称"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                            style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent-blue)', color: 'var(--text-main)', outline: 'none', padding: '4px 0', fontSize: '1rem' }}
                        />
                        <button className="btn-primary" onClick={handleCreateFolder} disabled={isProcessing} style={{ padding: '6px 16px', fontSize: '0.85rem', opacity: isProcessing ? 0.7 : 1, cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                            {isProcessing ? <><div className="loading-spinner-sm" style={{ marginRight: 6 }}></div>{t('status.creating')}</> : '创建'}
                        </button>
                        <button onClick={() => setIsCreatingFolder(false)} disabled={isProcessing} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}><X size={20} /></button>
                    </div>
                )
            }

            {
                uploading && (
                    <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '16px 20px', borderRadius: '12px', marginBottom: 20, boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Upload size={16} color="var(--accent-blue)" />
                                <span style={{ fontWeight: 600 }}>{t('status.uploading_files')}</span>
                            </div>
                            <span style={{ fontWeight: 800, color: 'var(--accent-blue)' }}>{uploadProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-blue)', transition: 'width 0.2s ease-out' }} />
                        </div>
                    </div>
                )
            }

            {uploadStatus === 'success' && <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '12px 16px', borderRadius: '10px', marginBottom: 20, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10 }}><Check size={18} />{t('message.upload_success')}</div>}

            {
                isFilesLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 100, gap: 16 }}><div className="loading-spinner"></div><span>{t('status.updating_list')}</span></div>
                ) : viewMode === 'grid' ? (
                    <div className="file-grid">
                        {Array.isArray(files) && formattedSortedFiles.map((file) => (
                            <div key={file.path} className={`file-item ${selectedPaths.includes(file.path) ? 'selected' : ''}`} onClick={() => handleItemClick(file)} onContextMenu={(e) => handleContextMenu(e, file)} style={{ position: 'relative' }}>
                                <div className="item-checkbox" onClick={(e) => toggleSelect(e, file.path)}>
                                    {selectedPaths.includes(file.path) ? <div style={{ width: 16, height: 16, background: 'var(--accent-blue)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" strokeWidth={4} /></div> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 0 }} />}
                                </div>
                                <button className="more-btn" onClick={(e) => handleOpenMenu(e, file)}>
                                    <MoreHorizontal size={16} />
                                </button>
                                <div className="file-icon">{getIcon(file, 40)}</div>
                                <span className="file-name">{file.name}</span>
                            </div>
                        ))}
                        {/* Upload button in grid view */}
                        {canWrite && (mode === 'all' || mode === 'personal') && (
                            <div className="file-item" onClick={handleUploadClick} style={{ border: '2px dashed var(--glass-border)', background: 'transparent' }}>
                                <Plus size={40} color="var(--glass-border)" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="file-list">
                        {/* List Header - Always Visible */}
                        <div className="file-list-header">
                            <div style={{ width: 40, paddingLeft: 12 }} onClick={selectAll}>
                                {files.length > 0 && selectedPaths.length === files.length ? <Check size={16} color="var(--accent-blue)" strokeWidth={4} /> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 0 }} />}
                            </div>
                            <div className="col-name" onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>{t('label.name')}</div>
                            <div className="col-uploader hidden-mobile" onClick={() => { setSortKey('uploader'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>{t('label.uploader')}</div>
                            <div className="col-date hidden-mobile" onClick={() => { setSortKey('mtime'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>{t('label.upload_date')}</div>
                            <div className="col-size" onClick={() => { setSortKey('size'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>{t('label.size')}</div>
                            <div className="col-stats" onClick={() => { setSortKey('accessCount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>{t('label.access_count')}</div>
                            <div style={{ width: 40 }}></div>
                        </div>

                        {/* List Items or Empty State */}
                        {files.length === 0 ? (
                            <div className="empty-hint" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                {t('browser.empty_folder')}
                            </div>
                        ) : (
                            Array.isArray(files) && formattedSortedFiles.map((file) => (
                                <div key={file.path} className={`file-list-row ${selectedPaths.includes(file.path) ? 'selected' : ''}`} onClick={() => handleItemClick(file)}>
                                    <div style={{ width: 40, paddingLeft: 12 }} onClick={(e) => toggleSelect(e, file.path)}>
                                        {selectedPaths.includes(file.path) ? <div style={{ width: 16, height: 16, background: 'var(--accent-blue)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" strokeWidth={4} /></div> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 0 }} />}
                                    </div>
                                    <div className="col-name">
                                        <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>{file.isDirectory ? <Folder size={20} fill="var(--accent-blue)" color="var(--accent-blue)" /> : getIcon(file, 20)}</div>
                                        <span>{file.name}</span>
                                    </div>
                                    <div className="col-uploader hidden-mobile" title={file.uploader}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} opacity={0.5} color="var(--accent-blue)" /> {file.uploader || 'unknown'}</div>
                                    </div>
                                    <div className="col-date hidden-mobile">{format(new Date(file.mtime), 'yyyy-MM-dd HH:mm')}</div>
                                    <div className="col-size">{formatSize(file.size)}</div>
                                    <div className="col-stats" onClick={(e) => { e.stopPropagation(); fetchStats(file); }}>
                                        {file.isDirectory ? '--' : <><Eye size={14} style={{ marginBottom: -2, marginRight: 4 }} color="var(--accent-blue)" /> {file.accessCount || 0}</>}
                                    </div>
                                    <div className="list-more-btn" onClick={(e) => handleOpenMenu(e, file)}>
                                        <MoreHorizontal size={18} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )
            }

            {/* Stats Modal */}
            {
                statsFile && (
                    <div className="modal-overlay" onClick={() => setStatsFile(null)}>
                        <div className="modal-content fade-in" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Eye size={20} color="var(--accent-blue)" />{t('browser.access_analysis')}</h3>
                                <button onClick={() => setStatsFile(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                            </div>
                            <div style={{ marginBottom: 20, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
                                <div className="hint" style={{ marginBottom: 4 }}>{t('label.project_name')}</div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{statsFile.name}</div>
                            </div>
                            <div className="stats-history-list">
                                {accessHistory.length > 0 ? accessHistory.map((log, i) => (
                                    <div key={i} className="stats-history-item">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,210,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={16} color="var(--accent-blue)" />
                                            </div>
                                            <div>
                                                <div className="stats-user">{log.username}</div>
                                                <div className="hint" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Clock size={12} color="var(--accent-blue)" /> {format(new Date(log.last_access), 'yyyy-MM-dd HH:mm')}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{log.count}</div>
                                            <div className="hint" style={{ fontSize: '0.7rem' }}>{t('browser.visits')}</div>
                                        </div>
                                    </div>
                                )) : <div style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>{t('browser.no_detailed_records')}</div>}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Context Menu Overlay */}
            {
                menuAnchor && (
                    <div
                        ref={menuRef}
                        className="context-menu"
                        style={{
                            left: Math.min(menuAnchor.x, window.innerWidth - 240),
                            top: Math.min(menuAnchor.y, window.innerHeight - 380)
                        }}
                    >
                        <div className="context-menu-item" onClick={() => { setPreviewFile(menuAnchor.file); setMenuAnchor(null); }}>
                            <Info size={16} strokeWidth={2.5} />{t('menu.show_info')}
                        </div>
                        <a
                            href={`/preview/${menuAnchor.file.path}`}
                            download={menuAnchor.file.name}
                            className="context-menu-item"
                            style={{ textDecoration: 'none' }}
                            onClick={() => { recordAccess(menuAnchor.file); setMenuAnchor(null); }}
                        >
                            <Download size={16} strokeWidth={2.5} />{t('menu.download_copy')}
                        </a>
                        <div className="context-menu-separator" />
                        <div className="context-menu-item" onClick={() => { handleStar(menuAnchor.file); setMenuAnchor(null); }}>
                            <Star size={16} strokeWidth={2.5} />{t('menu.add_star')}
                        </div>
                        <div className="context-menu-item" onClick={() => handleShare(menuAnchor.file)}>
                            <Share2 size={16} color="var(--accent-blue)" />{t('common.share')}</div>
                        <div className="context-menu-item" onClick={() => {
                            setSelectedPaths([menuAnchor.file.path]);
                            setIsMoveModalOpen(true);
                            setMenuAnchor(null);
                        }}>
                            <Move size={16} color="var(--accent-blue)" /> {t("menu.move_to")}
                        </div>
                        {canWrite && (
                            <>
                                <div className="context-menu-separator" />
                                <div className="context-menu-item danger" onClick={() => handleDelete(menuAnchor.file)}>
                                    <Trash2 size={16} />{t('common.delete')}</div>
                            </>
                        )}
                    </div>
                )
            }

            {/* Context Menu */}
            {
                contextMenu && (
                    <div
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            background: '#fff',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 10000,
                            minWidth: '180px'
                        }}
                    >
                        {!contextMenu.item.isDirectory && (
                            <button
                                onClick={() => {
                                    handleStarFile(contextMenu.item);
                                    setContextMenu(null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    border: 'none',
                                    background: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.9rem'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,210,0,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                                <Star size={16} />
                                添加星标
                            </button>
                        )}
                        {!contextMenu.item.isDirectory && (
                            <button
                                onClick={() => {
                                    setShareItem(contextMenu.item);
                                    setShowShareDialog(true);
                                    setContextMenu(null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    border: 'none',
                                    background: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.9rem'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,210,0,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                                <Link2 size={16} />{t('common.share')}</button>
                        )}
                        <button
                            onClick={() => {
                                setSelectedPaths([contextMenu.item.path]);
                                setIsMoveModalOpen(true);
                                setContextMenu(null);
                            }}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                border: 'none',
                                background: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.9rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,210,0,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                            <Move size={16} />
                            {t('menu.move_to')}
                        </button>
                    </div>
                )
            }

            {/* Share Dialog */}
            {
                showShareDialog && shareItem && (
                    <div className="modal-overlay" onClick={() => setShowShareDialog(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                    <Link2 size={24} color="var(--accent-blue)" />
                                    {t('share.create_link_title')}
                                </h3>
                                <button
                                    onClick={() => setShowShareDialog(false)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>{t('label.file_colon')}</div>
                                <div style={{
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-main)'
                                }}>
                                    {shareItem.name}
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>
                                    {t('share.password_label')} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{t('common.optional')}</span>
                                </label>
                                <input
                                    type="text"
                                    value={sharePassword}
                                    onChange={(e) => setSharePassword(e.target.value)}
                                    placeholder={t('share.password_placeholder')}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        color: 'var(--text-main)',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block', color: 'var(--text-main)' }}>{t('label.validity_colon')}</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShareExpires('7')}
                                        style={{
                                            padding: '12px',
                                            background: shareExpires === '7' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: shareExpires === '7' ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: shareExpires === '7' ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (shareExpires !== '7') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (shareExpires !== '7') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >{t('time.days_7')}</button>
                                    <button
                                        type="button"
                                        onClick={() => setShareExpires('30')}
                                        style={{
                                            padding: '12px',
                                            background: shareExpires === '30' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: shareExpires === '30' ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: shareExpires === '30' ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (shareExpires !== '30') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (shareExpires !== '30') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >{t('time.month_1')}</button>
                                    <button
                                        type="button"
                                        onClick={() => setShareExpires('never')}
                                        style={{
                                            padding: '12px',
                                            background: shareExpires === 'never' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: shareExpires === 'never' ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: shareExpires === 'never' ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (shareExpires !== 'never') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (shareExpires !== 'never') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >{t('time.forever')}</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const days = prompt(t('share.custom_days_prompt'), '1');
                                            if (days && !isNaN(parseInt(days))) {
                                                setShareExpires(days);
                                            }
                                        }}
                                        style={{
                                            padding: '12px',
                                            background: !['7', '30', 'never'].includes(shareExpires) ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: !['7', '30', 'never'].includes(shareExpires) ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: !['7', '30', 'never'].includes(shareExpires) ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (['7', '30', 'never'].includes(shareExpires)) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (['7', '30', 'never'].includes(shareExpires)) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >
                                        {t('time.custom')}
                                    </button>
                                </div>
                            </div>

                            {/* Language Selector */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block', color: 'var(--text-main)' }}>
                                    {t('share.page_language_label')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    {(['zh', 'en', 'de', 'ja'] as const).map(lang => (
                                        <button
                                            key={lang}
                                            type="button"
                                            onClick={() => setShareLanguage(lang)}
                                            style={{
                                                padding: '12px',
                                                background: shareLanguage === lang ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderLeft: shareLanguage === lang ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                color: '#fff',
                                                fontWeight: shareLanguage === lang ? 700 : 600,
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (shareLanguage !== lang) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (shareLanguage !== lang) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            }}
                                        >
                                            {t(`lang.${lang}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        setShowShareDialog(false);
                                        setSharePassword('');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                >{t('common.cancel')}</button>
                                <button
                                    onClick={handleCreateShareLink}
                                    className="btn-primary"
                                    disabled={isSharing}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        height: '48px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: isSharing ? 0.7 : 1,
                                        cursor: isSharing ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isSharing ? (
                                        <>
                                            <div className="loading-spinner-sm" style={{ marginRight: 8 }}></div>
                                            {t('share.generating')}
                                        </>
                                    ) : (
                                        <>
                                            <Link2 size={18} style={{ marginRight: '6px' }} />
                                            {t('share.generate_link')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Share Result Modal */}
            {
                shareResult && (
                    <ShareResultModal
                        result={shareResult}
                        onClose={() => setShareResult(null)}
                    />
                )
            }

            {/* Preview Modal */}
            {
                previewFile && (
                    <div className="preview-overlay" onClick={closePreview}>
                        <div className="preview-header" onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button onClick={closePreview} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                                <span style={{ fontWeight: 600 }}>{previewFile.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <a href={`/preview/${previewFile.path}`} download={previewFile.name} className="btn-preview" onClick={() => recordAccess(previewFile)}><Download size={18} />{t('common.download')}</a>
                                <button className="btn-preview primary" onClick={() => handleShare(previewFile)}><Share2 size={18} />{t('common.share')}</button>
                            </div>
                        </div>
                        <div className="preview-content">{renderPreviewContent(previewFile)}</div>
                        <div className="preview-actions">
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '16px' }}>
                                {formatSize(previewFile.size)} • {t('file.uploader')}: {previewFile.uploader || 'unknown'} • {t('file.total_access')}: {previewFile.accessCount || 0}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Move Modal - Tree Selector */}
            {
                isMoveModalOpen && (
                    <FolderTreeSelector
                        token={token || ''}
                        currentPath={currentPath}
                        username={useAuthStore.getState().user?.username}
                        isProcessing={isProcessing}
                        onSelect={(targetPath) => {
                            // Only trigger the move. Let logic in handleBulkMove close the modal on success.
                            handleBulkMove(targetPath);
                        }}
                        onClose={() => {
                            if (!isProcessing) {
                                setIsMoveModalOpen(false);
                                setSelectedPaths([]);
                            }
                        }}
                    />
                )
            }

            {/* Batch Share Dialog */}
            {
                showBatchShareDialog && (
                    <div className="modal-overlay" onClick={() => setShowBatchShareDialog(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                    <Link2 size={24} color="var(--accent-blue)" />
                                    {t('share.batch_share_title')}
                                </h3>
                                <button
                                    onClick={() => setShowBatchShareDialog(false)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>{t('browser.selected_count_dynamic', { count: selectedPaths.length })}</div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>
                                    {t('share.share_name_label')} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{t('common.optional')}</span>
                                </label>
                                <input
                                    type="text"
                                    value={batchShareName}
                                    onChange={(e) => setBatchShareName(e.target.value)}
                                    placeholder={t('share.default_name', { date: new Date().toLocaleDateString() })}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        color: 'var(--text-main)',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>
                                    {t('share.password_label')} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{t('common.optional')}</span>
                                </label>
                                <input
                                    type="text"
                                    value={batchSharePassword}
                                    onChange={(e) => setBatchSharePassword(e.target.value)}
                                    placeholder={t('share.password_placeholder')}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        color: 'var(--text-main)',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block', color: 'var(--text-main)' }}>{t('label.validity_colon')}</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setBatchShareExpires('7')}
                                        style={{
                                            padding: '12px',
                                            background: batchShareExpires === '7' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: batchShareExpires === '7' ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: batchShareExpires === '7' ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (batchShareExpires !== '7') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (batchShareExpires !== '7') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >{t('time.days_7')}</button>
                                    <button
                                        type="button"
                                        onClick={() => setBatchShareExpires('30')}
                                        style={{
                                            padding: '12px',
                                            background: batchShareExpires === '30' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: batchShareExpires === '30' ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: batchShareExpires === '30' ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: ' 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (batchShareExpires !== '30') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (batchShareExpires !== '30') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >{t('time.month_1')}</button>
                                    <button
                                        type="button"
                                        onClick={() => setBatchShareExpires('never')}
                                        style={{
                                            padding: '12px',
                                            background: batchShareExpires === 'never' ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: batchShareExpires === 'never' ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: batchShareExpires === 'never' ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (batchShareExpires !== 'never') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (batchShareExpires !== 'never') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >{t('time.forever')}</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const days = prompt(t('share.custom_days_prompt'), '1');
                                            if (days && !isNaN(parseInt(days))) {
                                                setBatchShareExpires(days);
                                            }
                                        }}
                                        style={{
                                            padding: '12px',
                                            background: !['7', '30', 'never'].includes(batchShareExpires) ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderLeft: !['7', '30', 'never'].includes(batchShareExpires) ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontWeight: !['7', '30', 'never'].includes(batchShareExpires) ? 700 : 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (['7', '30', 'never'].includes(batchShareExpires)) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (['7', '30', 'never'].includes(batchShareExpires)) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >
                                        {t('time.custom')}
                                    </button>
                                </div>
                            </div>

                            {/* Language Selector */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block', color: 'var(--text-main)' }}>
                                    {t('share.page_language_label')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    {(['zh', 'en', 'de', 'ja'] as const).map(lang => (
                                        <button
                                            key={lang}
                                            type="button"
                                            onClick={() => setBatchShareLanguage(lang)}
                                            style={{
                                                padding: '12px',
                                                background: batchShareLanguage === lang ? 'rgba(255, 210, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderLeft: batchShareLanguage === lang ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                color: '#fff',
                                                fontWeight: batchShareLanguage === lang ? 700 : 600,
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (batchShareLanguage !== lang) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (batchShareLanguage !== lang) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            }}
                                        >
                                            {t(`lang.${lang}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        setShowBatchShareDialog(false);
                                        setBatchSharePassword('');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                >{t('common.cancel')}</button>
                                <button
                                    onClick={handleBatchShare}
                                    className="btn-primary"
                                    disabled={isSharing}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        fontSize: '0.95rem',
                                        fontWeight: 700,
                                        opacity: isSharing ? 0.7 : 1,
                                        cursor: isSharing ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {isSharing ? (
                                        <>
                                            <div className="loading-spinner-sm" style={{ marginRight: 8 }}></div>
                                            {t('share.generating')}
                                        </>
                                    ) : (
                                        t('share.generate_link')
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }



        </div >
    );
};

export default FileBrowser;
