/**
 * Knowledge Base Generator - macOS26 Style
 * Tool for importing knowledge from DOCX, URL, or text input
 * Optimized for DOCX→MD→Knowledge workflow (2026-02-07)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface ImportResult {
    success: boolean;
    imported_count: number;
    skipped_count: number;
    failed_count: number;
    article_ids?: number[];
    error?: string;
}

interface ProgressStep {
    id: string;
    label: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    details?: string;
}

interface ImportProgress {
    currentStep: string;
    steps: ProgressStep[];
    stats: {
        chapters: number;
        images: number;
        tables: number;
        totalSize: string;
    };
}

export default function KnowledgeGenerator() {
    const navigate = useNavigate();
    
    // Import mode
    const [importMode, setImportMode] = useState<'docx' | 'url' | 'text'>('docx');
    
    // Form state
    const [docxFile, setDocxFile] = useState<File | null>(null);
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Manual');
    const [productLine, setProductLine] = useState('A');
    const [productModels, setProductModels] = useState<string[]>([]);
    const [visibility, setVisibility] = useState<'Public' | 'Dealer' | 'Internal' | 'Department'>('Public');
    const [tags, setTags] = useState('');
    
    // UI state
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [uploadSpeed, setUploadSpeed] = useState<string>('');
    const [uploadedSize, setUploadedSize] = useState<number>(0);
    const [totalFileSize, setTotalFileSize] = useState<number>(0);
    const [warningDialog, setWarningDialog] = useState<{
        visible: boolean;
        message: string;
        details?: any;
    }>({ visible: false, message: '' });

    const categories = [
        { value: 'FAQ', label: 'FAQ - 常见问题' },
        { value: 'Troubleshooting', label: 'Troubleshooting - 故障排查' },
        { value: 'Compatibility', label: 'Compatibility - 兼容性' },
        { value: 'Manual', label: 'Manual - 操作手册' },
        { value: 'Firmware', label: 'Firmware - 固件知识' },
        { value: 'Application Note', label: 'Application Note - 应用笔记' },
        { value: 'Technical Spec', label: 'Technical Spec - 技术规格' }
    ];

    const productLines = [
        { value: 'A', label: 'A类 - 在售电影摄影机', desc: 'MAVO Edge系列、Mark2等' },
        { value: 'B', label: 'B类 - 历史机型', desc: 'MAVO LF、Terra、MAVO S35等' },
        { value: 'C', label: 'C类 - 电子寻像器', desc: 'Eagle系列（仅保证Kinefinity适配）' },
        { value: 'D', label: 'D类 - 通用配件', desc: 'GripBAT、Magic Arm等跨代配件' }
    ];

    const productModelOptions: Record<string, string[]> = {
        'A': ['MAVO Edge 8K', 'MAVO Edge 6K', 'MAVO Mark2 LF', 'MAVO Mark2 S35'],
        'B': ['MAVO LF', 'MAVO S35', 'Terra 4K', 'Terra 6K'],
        'C': ['Eagle SDI', 'Eagle HDMI'],
        'D': ['GripBAT系列', 'Magic Arm', 'Dark Tower', 'KineBAT', '线缆配件']
    };

    const visibilityOptions = [
        { value: 'Public', label: 'Public - 对外公开', desc: '所有人可见（客户、经销商、员工）' },
        { value: 'Dealer', label: 'Dealer - 经销商可见', desc: '经销商和内部员工可见' },
        { value: 'Internal', label: 'Internal - 内部员工', desc: '仅内部员工可见' },
        { value: 'Department', label: 'Department - 特定部门', desc: '仅指定部门可见（需单独配置）' }
    ];

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    // Debug: Monitor progress state changes
    useEffect(() => {
        console.log('[Progress State Changed]:', progress);
    }, [progress]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validTypes = [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword'
            ];
            if (!validTypes.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
                setError('只支持DOCX/DOC文件');
                return;
            }
            setDocxFile(file);
            setError('');
            
            // Auto-detect product from filename
            const filename = file.name;
            if (filename.includes('Edge 6K') || filename.includes('Edge6K')) {
                setTitle('MAVO Edge 6K 操作说明书');
                setProductLine('A');
                setProductModels(['MAVO Edge 6K']);
            } else if (filename.includes('Edge 8K') || filename.includes('Edge8K')) {
                setTitle('MAVO Edge 8K 操作说明书');
                setProductLine('A');
                setProductModels(['MAVO Edge 8K']);
            } else if (filename.includes('Eagle')) {
                setTitle('Eagle 监视器说明书');
                setProductLine('C');
                setProductModels(['Eagle SDI', 'Eagle HDMI']);
            } else if (filename.includes('MAVO LF')) {
                setTitle('MAVO LF 操作说明书');
                setProductLine('B');
                setProductModels(['MAVO LF']);
            } else if (filename.includes('Terra')) {
                setTitle('Terra 操作说明书');
                setProductLine('B');
                setProductModels(['Terra 4K', 'Terra 6K']);
            }
        }
    };

    const handleModelToggle = (model: string) => {
        setProductModels(prev => 
            prev.includes(model) 
                ? prev.filter(m => m !== model)
                : [...prev, model]
        );
    };

    const handleCancel = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setLoading(false);
            setProgress(null);
            setError('导入已取消');
        }
    };

    const handleImport = async () => {
        console.log('[Import] Starting import...');
        setLoading(true);
        setError('');
        setResult(null);
        
        // 初始化进度
        const initialSteps: ProgressStep[] = [
            { id: 'upload', label: '上传文件', status: 'pending' },
            { id: 'parse', label: '解析DOCX结构', status: 'pending' },
            { id: 'extract_images', label: '提取图片', status: 'pending' },
            { id: 'convert_md', label: '转换Markdown', status: 'pending' },
            { id: 'generate', label: '生成知识条目', status: 'pending' }
        ];
        
        console.log('[Import] Setting initial progress...');
        const progressState = {
            currentStep: 'upload',
            steps: initialSteps,
            stats: { chapters: 0, images: 0, tables: 0, totalSize: '0KB' }
        };
        console.log('[Import] Progress state:', progressState);
        setProgress(progressState);
        
        // Force a small delay to ensure React updates the DOM
        await new Promise(resolve => setTimeout(resolve, 100));

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('未登录，请先登录');
                setLoading(false);
                setProgress(null);
                return;
            }

            let response: Response;

            if (importMode === 'docx') {
                if (!docxFile) {
                    setError('请选择DOCX文件');
                    setLoading(false);
                    setProgress(null);
                    return;
                }
                
                // 验证产品型号必填
                if (!productModels || productModels.length === 0) {
                    setError('请选择产品型号');
                    setLoading(false);
                    setProgress(null);
                    return;
                }

                // 步骤1: 上传文件（分块上传 + 断点续传）
                setProgress(prev => prev ? {
                    ...prev,
                    currentStep: 'upload',
                    steps: prev.steps.map(s => s.id === 'upload' ? { ...s, status: 'processing', progress: 0 } : s)
                } : null);

                const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
                const totalChunks = Math.ceil(docxFile.size / CHUNK_SIZE);
                
                // 生成稳定的uploadId（基于文件名和大小，确保重试时ID相同）
                // 使用更安全的方式处理中文文件名
                const fileHash = `${docxFile.name}-${docxFile.size}-${docxFile.lastModified}`;
                let uploadId = '';
                try {
                    // 尝试使用btoa，如果失败则使用简单hash
                    uploadId = btoa(encodeURIComponent(fileHash)).replace(/[/+=]/g, '').substring(0, 32);
                } catch (e) {
                    // Fallback: 使用简单的字符串hash
                    let hash = 0;
                    for (let i = 0; i < fileHash.length; i++) {
                        const char = fileHash.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash; // Convert to 32bit integer
                    }
                    uploadId = Math.abs(hash).toString(36) + Date.now().toString(36);
                }
                
                console.log(`[Upload] Starting upload: ${docxFile.name}, uploadId: ${uploadId}, chunks: ${totalChunks}`);
                
                // 设置文件总大小
                setTotalFileSize(docxFile.size);
                let uploadedBytes = 0;
                let lastLoaded = 0;
                let lastTime = Date.now();

                // 检查已存在的chunks（断点续传）
                let existingChunks: number[] = [];
                try {
                    const checkResponse = await fetch(`${API_BASE_URL}/api/upload/check-chunks`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ uploadId, totalChunks }),
                        signal: controller.signal
                    });
                    
                    if (checkResponse.ok) {
                        const checkData = await checkResponse.json();
                        existingChunks = checkData.existingChunks || [];
                        console.log(`[Upload] Found ${existingChunks.length}/${totalChunks} existing chunks`);
                        
                        // 计算已上传的字节数
                        uploadedBytes = existingChunks.length * CHUNK_SIZE;
                        if (uploadedBytes > docxFile.size) uploadedBytes = docxFile.size;
                        setUploadedSize(uploadedBytes);
                        lastLoaded = uploadedBytes;
                    }
                } catch (err) {
                    console.warn('[Upload] Failed to check existing chunks, will upload all:', err);
                }

                // Upload each chunk (跳过已存在的)
                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    if (controller.signal.aborted) {
                        throw new Error('Upload cancelled');
                    }

                    // 跳过已存在的chunk
                    if (existingChunks.includes(chunkIndex)) {
                        console.log(`[Upload] Skipping existing chunk ${chunkIndex + 1}/${totalChunks}`);
                        const start = chunkIndex * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, docxFile.size);
                        uploadedBytes = Math.max(uploadedBytes, end);
                        continue;
                    }

                    const start = chunkIndex * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, docxFile.size);
                    const chunk = docxFile.slice(start, end);

                    const chunkFormData = new FormData();
                    chunkFormData.append('chunk', chunk);
                    chunkFormData.append('uploadId', uploadId);
                    chunkFormData.append('fileName', docxFile.name);
                    chunkFormData.append('chunkIndex', chunkIndex.toString());
                    chunkFormData.append('totalChunks', totalChunks.toString());
                    chunkFormData.append('path', 'knowledge_uploads'); // 临时目录

                    // 使用axios上传（和FileBrowser一样）
                    console.log(`[Upload] Uploading chunk ${chunkIndex + 1}/${totalChunks}...`);
                    await axios.post(`${API_BASE_URL}/api/upload/chunk`, chunkFormData, {
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        },
                        signal: controller.signal,
                        onUploadProgress: (progressEvent) => {
                            const chunkUploaded = progressEvent.loaded || 0;
                            const currentTotal = uploadedBytes + chunkUploaded;
                            const percentComplete = Math.round((currentTotal / docxFile.size) * 100);
                            setUploadedSize(currentTotal);
                            
                            // 计算上传速度
                            const currentTime = Date.now();
                            const timeDiff = (currentTime - lastTime) / 1000;
                            const loadedDiff = currentTotal - lastLoaded;
                            
                            if (timeDiff > 0.5) {
                                const speed = loadedDiff / timeDiff;
                                if (speed >= 1024 * 1024) {
                                    setUploadSpeed(`${(speed / (1024 * 1024)).toFixed(1)} MB/s`);
                                } else if (speed >= 1024) {
                                    setUploadSpeed(`${(speed / 1024).toFixed(0)} KB/s`);
                                } else {
                                    setUploadSpeed(`${speed.toFixed(0)} B/s`);
                                }
                                lastLoaded = currentTotal;
                                lastTime = currentTime;
                            }
                            
                            setProgress(prev => prev ? {
                                ...prev,
                                steps: prev.steps.map(s => 
                                    s.id === 'upload' ? { ...s, progress: Math.min(percentComplete, 99) } : s
                                )
                            } : null);
                        }
                    });

                    console.log(`[Upload] Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
                    uploadedBytes += (end - start);
                }

                // Merge chunks
                const mergeResponse = await fetch(`${API_BASE_URL}/api/upload/merge`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uploadId,
                        fileName: docxFile.name,
                        totalChunks,
                        path: '.temp'  // Use .temp directory in user's Members folder (has write permission)
                    }),
                    signal: controller.signal
                });

                if (!mergeResponse.ok) {
                    throw new Error('Failed to merge chunks');
                }

                const mergedFile = await mergeResponse.json();
                console.log('[Upload] Chunks merged:', mergedFile);

                // 上传完成
                setProgress(prev => prev ? {
                    ...prev,
                    steps: prev.steps.map(s => s.id === 'upload' ? { ...s, status: 'completed', progress: 100 } : s)
                } : null);
                setUploadedSize(docxFile.size);

                // 准备元数据，调用DOCX导入API
                const formData = new FormData();
                formData.append('mergedFilePath', mergedFile.path); // 后端返回的合并文件路径
                formData.append('title_prefix', title || '');
                formData.append('category', category);
                formData.append('product_line', productLine);
                formData.append('product_models', JSON.stringify(productModels));
                formData.append('visibility', visibility);
                formData.append('tags', tags);

                response = await fetch(`${API_BASE_URL}/api/v1/knowledge/import/docx`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData,
                    signal: controller.signal
                });
            } else if (importMode === 'url') {
                if (!urlInput) {
                    setError('请输入网页URL');
                    setLoading(false);
                    return;
                }
                
                // 验证产品型号必填
                if (!productModels || productModels.length === 0) {
                    setError('请选择产品型号');
                    setLoading(false);
                    return;
                }

                response = await fetch(`${API_BASE_URL}/api/v1/knowledge/import/url`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: urlInput,
                        title: title || undefined,
                        category,
                        product_line: productLine,
                        product_models: productModels,
                        visibility,
                        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
                    })
                });
            } else {
                // text mode
                if (!textInput || !title) {
                    setError('请输入标题和内容');
                    setLoading(false);
                    return;
                }
                
                // 验证产品型号必填
                if (!productModels || productModels.length === 0) {
                    setError('请选择产品型号');
                    setLoading(false);
                    return;
                }

                response = await fetch(`${API_BASE_URL}/api/v1/knowledge`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title,
                        content: textInput,
                        category,
                        product_line: productLine,
                        product_models: productModels,
                        visibility,
                        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                        status: 'Published'
                    })
                });
            }

            // 步骤2-5: 服务器处理中 - 按顺序显示
            const processingSteps = ['parse', 'extract_images', 'convert_md', 'generate'];
            for (const stepId of processingSteps) {
                setProgress(prev => prev ? {
                    ...prev,
                    currentStep: stepId,
                    steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'processing' } : s)
                } : null);
                
                // 模拟每个步骤的处理时间（实际上是后端处理，这里只是视觉效果）
                await new Promise(resolve => setTimeout(resolve, 300));
                
                setProgress(prev => prev ? {
                    ...prev,
                    steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'completed' } : s)
                } : null);
            }

            const data = await response.json();
            console.log('[Import] Response data:', data);
            
            if (!response.ok || !data.success) {
                console.error('[Import] API error:', data.error);
                throw new Error(data.error?.message || '导入失败');
            }

            // 检查是否有警告
            if (data.warning && data.warning.type === 'title_mismatch') {
                setWarningDialog({
                    visible: true,
                    message: data.warning.message,
                    details: data.warning.details
                });
            }

            // 标记所有步骤完成
            setProgress(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => ({ ...s, status: 'completed' })),
                stats: {
                    chapters: data.data?.chapter_count || data.data?.imported_count || 0,
                    images: data.data?.image_count || 0,
                    tables: data.data?.table_count || 0,
                    totalSize: data.data?.total_size || '0KB'
                }
            } : null);

            setResult({
                success: true,
                imported_count: data.data?.imported_count || 1,
                skipped_count: data.data?.skipped_count || 0,
                failed_count: data.data?.failed_count || 0,
                article_ids: data.data?.article_ids || [data.data?.id]
            });

        } catch (err: any) {
            console.error('Import error:', err);
            if (err.name === 'AbortError') {
                setError('导入已取消');
            } else {
                setError(err.message || '导入失败');
            }
            // 标记失败的步骤
            setProgress(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => 
                    s.status === 'processing' ? { ...s, status: 'failed' } : s
                )
            } : null);
        } finally {
            setLoading(false);
            setAbortController(null);
        }
    };

    const handleViewImported = () => {
        navigate('/tech-hub/wiki');
    };

    return (
        <div style={{
            padding: '32px',
            maxWidth: '1400px',
            margin: '0 auto',
            background: 'linear-gradient(to bottom, #1a1a1a 0%, #151515 100%)',
            minHeight: '100vh'
        }}>
            {/* Header - macOS26 Style */}
            <div style={{
                marginBottom: '40px',
                paddingBottom: '24px',
                borderBottom: '1px solid rgba(255,215,0,0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ 
                            fontSize: '32px', 
                            fontWeight: 700, 
                            marginBottom: '12px', 
                            color: '#FFD700',
                            letterSpacing: '-0.5px'
                        }}>
                            知识库导入器
                        </h1>
                        <p style={{ 
                            color: '#999', 
                            fontSize: '15px', 
                            lineHeight: '1.6',
                            maxWidth: '600px'
                        }}>
                            导入Word文档、网页内容或手动输入知识到知识库
                            <span style={{ display: 'block', fontSize: '13px', color: '#666', marginTop: '4px' }}>
                                DOCX → Markdown → 知识库（准确率99%+）
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/tech-hub/wiki')}
                        style={{
                            padding: '10px 20px',
                            background: 'rgba(255,215,0,0.1)',
                            border: '1px solid rgba(255,215,0,0.3)',
                            borderRadius: '10px',
                            color: '#FFD700',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,215,0,0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        浏览 WIKI
                    </button>
                </div>
            </div>

            {/* Import Mode Selector - macOS26 Style */}
            {/* 移除独立的大横条，改为放在左侧内容框内 */}

            {/* Main Content: Left 1/3 Content, Right 2/3 Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                {/* Left: Content Input */}
                <div style={{
                    background: 'linear-gradient(145deg, #252525 0%, #1f1f1f 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>
                    <h3 style={{ 
                        fontSize: '16px', 
                        fontWeight: 600, 
                        marginBottom: '16px', 
                        color: '#FFD700',
                        letterSpacing: '0.3px'
                    }}>
                        内容来源
                    </h3>

                    {/* 模式选择标签页 - 紧凑设计 */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '20px',
                        padding: '4px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        {[
                            { mode: 'docx' as const, label: 'Word文档' },
                            { mode: 'url' as const, label: '网页URL' },
                            { mode: 'text' as const, label: '文本输入' }
                        ].map(({ mode, label }) => (
                            <button
                                key={mode}
                                onClick={() => setImportMode(mode)}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    background: importMode === mode 
                                        ? 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)'
                                        : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: importMode === mode ? '#FFD700' : '#999',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                    boxShadow: importMode === mode 
                                        ? '0 2px 8px rgba(255,215,0,0.3)'
                                        : 'none'
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {importMode === 'docx' && (
                        <div>
                            <label style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '40px 20px',
                                background: 'rgba(255,215,0,0.03)',
                                border: '2px dashed rgba(255,215,0,0.3)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{ 
                                    fontSize: '48px', 
                                    fontWeight: 700,
                                    color: '#FFD700',
                                    marginBottom: '12px'
                                }}>+</div>
                                <div style={{ fontSize: '15px', color: '#ddd', marginBottom: '6px', fontWeight: 500 }}>
                                    选择Word文档
                                </div>
                                <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
                                    或拖拽DOCX文件到此处
                                </div>
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: '#999',
                                    padding: '6px 12px',
                                    background: 'rgba(255,215,0,0.1)',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,215,0,0.2)'
                                }}>
                                    支持: .docx / .doc
                                </div>
                                <input
                                    type="file"
                                    accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                            {docxFile && (
                                <div style={{
                                    marginTop: '12px',
                                    padding: '12px',
                                    background: 'rgba(255,215,0,0.1)',
                                    border: '1px solid rgba(255,215,0,0.3)',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFD700', marginBottom: '2px' }}>
                                            {docxFile.name}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#999' }}>
                                            {formatSize(docxFile.size)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setDocxFile(null)}
                                        style={{
                                            padding: '4px 8px',
                                            background: '#ff4444',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        移除
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {importMode === 'url' && (
                        <div>
                            <input
                                type="url"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="https://kinefinity.com/support/application-notes/..."
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#1a1a1a',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '13px'
                                }}
                            />
                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                                💡 提示：支持Application Note、技术博客等网页内容
                            </div>
                        </div>
                    )}

                    {importMode === 'text' && (
                        <div>
                            <textarea
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder="在此粘贴或输入知识内容...&#10;&#10;支持Markdown格式：&#10;# 标题&#10;## 子标题&#10;- 列表项"
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    padding: '10px',
                                    background: '#1a1a1a',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Right: Metadata */}
                <div style={{
                    background: 'linear-gradient(145deg, #252525 0%, #1f1f1f 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Header with Import Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ 
                            fontSize: '16px', 
                            fontWeight: 600, 
                            color: '#FFD700',
                            letterSpacing: '0.3px',
                            margin: 0
                        }}>
                            知识属性
                        </h3>
                        <button
                            onClick={handleImport}
                            disabled={loading || (importMode === 'docx' && !docxFile) || (importMode === 'url' && !urlInput) || (importMode === 'text' && (!title || !textInput))}
                            style={{
                                padding: '12px 28px',
                                background: loading 
                                    ? 'rgba(255,255,255,0.05)' 
                                    : 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                border: 'none',
                                borderRadius: '10px',
                                color: loading ? '#666' : '#000',
                                fontSize: '15px',
                                fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1,
                                transition: 'all 0.2s',
                                boxShadow: loading ? 'none' : '0 4px 12px rgba(255,215,0,0.4)',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,215,0,0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,215,0,0.4)';
                                }
                            }}
                        >
                            {loading ? '导入中...' : '开始导入'}
                        </button>
                    </div>

                    {/* Metadata Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                        {/* Title */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                标题 {importMode !== 'text' && '(可选)'}
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={importMode === 'docx' ? "自动从DOCX提取" : "知识标题"}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                分类 *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Product Line */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                产品族群 *
                            </label>
                            <select
                                value={productLine}
                                onChange={(e) => {
                                    setProductLine(e.target.value);
                                    setProductModels([]);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                {productLines.map(line => (
                                    <option key={line.value} value={line.value}>
                                        {line.label} - {line.desc}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Product Models */}
                        {productModelOptions[productLine].length > 0 && (
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    fontSize: '13px', 
                                    color: '#999', 
                                    marginBottom: '8px', 
                                    fontWeight: 500 
                                }}>
                                    产品型号 *
                                    <span style={{ 
                                        color: '#ff6b6b', 
                                        marginLeft: '4px',
                                        fontSize: '12px'
                                    }}>
                                        (必选)
                                    </span>
                                </label>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    padding: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    minHeight: '80px'
                                }}>
                                    {productModelOptions[productLine].map(model => (
                                        <button
                                            key={model}
                                            onClick={() => handleModelToggle(model)}
                                            style={{
                                                padding: '6px 12px',
                                                background: productModels.includes(model) 
                                                    ? 'rgba(255,215,0,0.15)' 
                                                    : 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${productModels.includes(model) ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                                borderRadius: '6px',
                                                color: productModels.includes(model) ? '#FFD700' : '#999',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Visibility */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                可见性 *
                            </label>
                            <select
                                value={visibility}
                                onChange={(e) => setVisibility(e.target.value as any)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                {visibilityOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label} - {opt.desc}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Tags */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                标签 (逗号分隔)
                            </label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="固件升级, SDI, 故障排查"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Modal - macOS26 Style */}
            {progress && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '560px',
                        background: 'linear-gradient(145deg, #2a2a2a 0%, #1f1f1f 100%)',
                        borderRadius: '20px',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                        padding: '32px',
                        border: '1px solid rgba(255,215,0,0.1)'
                    }}>
                        {/* Header */}
                        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                            <h3 style={{ 
                                fontSize: '20px', 
                                fontWeight: 600, 
                                color: '#FFD700',
                                margin: 0,
                                letterSpacing: '0.5px'
                            }}>
                                导入进度
                            </h3>
                        </div>

                        {/* Progress Steps */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                            {progress.steps.map((step, index) => (
                                <div key={step.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '14px',
                                    padding: '16px',
                                    background: step.status === 'processing' ? 'rgba(255,215,0,0.08)' : 
                                               step.status === 'completed' ? 'rgba(255,215,0,0.05)' :
                                               step.status === 'failed' ? 'rgba(255,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${step.status === 'processing' ? 'rgba(255,215,0,0.4)' :
                                                         step.status === 'completed' ? 'rgba(255,215,0,0.2)' :
                                                         step.status === 'failed' ? 'rgba(255,68,68,0.4)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '12px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    {/* Step Number */}
                                    <div style={{ 
                                        minWidth: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: step.status === 'completed' ? '#FFD700' :
                                                   step.status === 'processing' ? 'rgba(255,215,0,0.2)' :
                                                   step.status === 'failed' ? '#ff4444' : 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        color: step.status === 'completed' ? '#000' :
                                               step.status === 'processing' ? '#FFD700' :
                                               step.status === 'failed' ? '#fff' : '#666'
                                    }}>
                                        {step.status === 'completed' ? '✓' : index + 1}
                                    </div>

                                    {/* Step Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ 
                                            fontSize: '15px', 
                                            fontWeight: 600, 
                                            color: step.status === 'processing' ? '#FFD700' :
                                                   step.status === 'completed' ? '#fff' : '#999',
                                            marginBottom: step.id === 'upload' && step.status === 'processing' ? '8px' : '0'
                                        }}>
                                            {step.label}
                                        </div>
                                        
                                        {/* Upload Progress Bar and Info */}
                                        {step.id === 'upload' && step.status === 'processing' && (
                                            <>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    fontSize: '12px',
                                                    color: '#999',
                                                    marginBottom: '6px'
                                                }}>
                                                    <span>{formatSize(uploadedSize)} / {formatSize(totalFileSize)}</span>
                                                    <span style={{ color: '#FFD700' }}>{uploadSpeed}</span>
                                                </div>
                                                <div style={{
                                                    width: '100%',
                                                    height: '4px',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    borderRadius: '2px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        width: `${step.progress || 0}%`,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                                                        transition: 'width 0.3s ease-out'
                                                    }} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Statistics */}
                        {(progress.stats.chapters > 0 || progress.stats.images > 0) && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '12px',
                                padding: '20px',
                                background: 'rgba(255,215,0,0.03)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,215,0,0.1)',
                                marginBottom: '20px'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700', marginBottom: '4px' }}>
                                        {progress.stats.chapters}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999', fontWeight: 500 }}>
                                        知识章节
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700', marginBottom: '4px' }}>
                                        {progress.stats.images}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999', fontWeight: 500 }}>
                                        提取图片
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700', marginBottom: '4px' }}>
                                        {progress.stats.tables}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999', fontWeight: 500 }}>
                                        转换表格
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700', marginBottom: '4px' }}>
                                        {progress.stats.totalSize}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999', fontWeight: 500 }}>
                                        文件大小
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            {loading && (
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        padding: '12px 28px',
                                        background: 'rgba(255,68,68,0.15)',
                                        border: '1px solid rgba(255,68,68,0.4)',
                                        borderRadius: '10px',
                                        color: '#ff4444',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,68,68,0.25)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,68,68,0.15)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    取消导入
                                </button>
                            )}
                            {!loading && (
                                <button
                                    onClick={() => setProgress(null)}
                                    style={{
                                        padding: '12px 32px',
                                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#000',
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(255,215,0,0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,215,0,0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,215,0,0.3)';
                                    }}
                                >
                                    完成
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* macOS26 风格错误对话框 */}
            {error && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #2a2a2a 0%, #222 100%)',
                        border: '1px solid rgba(255,68,68,0.3)',
                        borderRadius: '16px',
                        padding: '32px',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        {/* 图标 */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 24px',
                            background: 'rgba(255,68,68,0.1)',
                            border: '2px solid rgba(255,68,68,0.3)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px'
                        }}>
                            ❌
                        </div>

                        {/* 标题 */}
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#ff6b6b',
                            textAlign: 'center',
                            marginBottom: '16px'
                        }}>
                            操作失败
                        </h3>

                        {/* 消息 */}
                        <div style={{
                            background: 'rgba(255,68,68,0.05)',
                            border: '1px solid rgba(255,68,68,0.15)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '24px'
                        }}>
                            <p style={{
                                fontSize: '14px',
                                color: '#ccc',
                                lineHeight: '1.6',
                                textAlign: 'center',
                                margin: 0
                            }}>
                                {error}
                            </p>
                        </div>

                        {/* 按钮 */}
                        <button
                            onClick={() => setError('')}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '15px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(255,68,68,0.3)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,68,68,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,68,68,0.3)';
                            }}
                        >
                            我知道了
                        </button>
                    </div>
                </div>
            )}

            {/* Success Result */}
            {result && result.success && (
                <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: 'rgba(0,255,0,0.1)',
                    border: '1px solid rgba(0,255,0,0.3)',
                    borderRadius: '8px'
                }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#0f0' }}>
                        ✅ 导入成功！
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 600, color: '#0f0' }}>{result.imported_count}</div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>成功导入</div>
                        </div>
                        <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 600, color: '#ff0' }}>{result.skipped_count}</div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>跳过重复</div>
                        </div>
                        <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 600, color: '#f00' }}>{result.failed_count}</div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>导入失败</div>
                        </div>
                    </div>
                    <button
                        onClick={handleViewImported}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        📚 前往 Kinefinity WIKI 查看
                    </button>
                </div>
            )}

            {/* macOS26 风格警告对话框 */}
            {warningDialog.visible && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #2a2a2a 0%, #222 100%)',
                        border: '1px solid rgba(255,215,0,0.2)',
                        borderRadius: '16px',
                        padding: '32px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        {/* 图标 */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 24px',
                            background: 'rgba(255,215,0,0.1)',
                            border: '2px solid rgba(255,215,0,0.3)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px'
                        }}>
                            ⚠️
                        </div>

                        {/* 标题 */}
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#FFD700',
                            textAlign: 'center',
                            marginBottom: '16px'
                        }}>
                            产品型号不匹配
                        </h3>

                        {/* 消息 */}
                        <div style={{
                            background: 'rgba(255,215,0,0.05)',
                            border: '1px solid rgba(255,215,0,0.15)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '24px'
                        }}>
                            <p style={{
                                fontSize: '14px',
                                color: '#ccc',
                                lineHeight: '1.6',
                                marginBottom: '12px',
                                textAlign: 'center'
                            }}>
                                {warningDialog.message}
                            </p>
                            {warningDialog.details && (
                                <div style={{
                                    fontSize: '13px',
                                    color: '#999',
                                    marginTop: '12px',
                                    paddingTop: '12px',
                                    borderTop: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ marginBottom: '6px' }}>
                                        <span style={{ color: '#666' }}>文档内容：</span>
                                        <span style={{ color: '#FFD700', fontWeight: 500 }}>{warningDialog.details.detected}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#666' }}>您的选择：</span>
                                        <span style={{ color: '#0f0', fontWeight: 500 }}>{warningDialog.details.selected}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 按钮 */}
                        <button
                            onClick={() => setWarningDialog({ visible: false, message: '' })}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#000',
                                fontSize: '15px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(255,215,0,0.3)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,215,0,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,215,0,0.3)';
                            }}
                        >
                            我知道了
                        </button>

                        <p style={{
                            fontSize: '12px',
                            color: '#666',
                            textAlign: 'center',
                            marginTop: '16px',
                            lineHeight: '1.5'
                        }}>
                            系统已按您选择的产品型号导入，<br/>
                            如有错误请删除后重新导入
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

{/* 动画 CSS */}
<style>{`
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`}</style>
