/**
 * Knowledge Base Generator - macOS26 Style
 * Tool for importing knowledge from DOCX, URL, or text input
 * Optimized for DOCX→MD→Knowledge workflow (2026-02-07)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Sparkles, BookOpen } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';



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
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
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

interface KnowledgeGeneratorProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function KnowledgeGenerator({ isOpen = true, onClose }: KnowledgeGeneratorProps) {
    const { t, language } = useLanguage();



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

    // 导入方式选项：直接导入 or Bokeh优化
    const [bokehOptimize, setBokehOptimize] = useState(true);
    // 新增：Turbo 模式 (使用 Jina Reader 自动绕过反爬、提取表格图片)
    const [turboMode, setTurboMode] = useState(true);

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
        { value: 'FAQ', label: t('wiki.category_faq') },
        { value: 'Troubleshooting', label: t('wiki.category_troubleshooting') },
        { value: 'Compatibility', label: t('wiki.category_compatibility') },
        { value: 'Manual', label: t('wiki.category_manual') },
        { value: 'Firmware', label: t('wiki.category_firmware') },
        { value: 'Application Note', label: t('wiki.category_application_note') },
        { value: 'Technical Spec', label: t('wiki.category_technical_spec') }
    ];

    const productLines = [
        { value: 'A', label: t('wiki.import_line_a'), desc: t('wiki.import_line_a_desc') },
        { value: 'B', label: t('wiki.import_line_b'), desc: t('wiki.import_line_b_desc') },
        { value: 'C', label: t('wiki.import_line_c'), desc: t('wiki.import_line_c_desc') },
        { value: 'D', label: t('wiki.import_line_d'), desc: t('wiki.import_line_d_desc') }
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

    const handleCancel = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setLoading(false);
            // 不要清空progress，保留当前状态显示部分完成
            // 如果正在Bokeh优化阶段，标记为部分完成
            setProgress(prev => {
                if (!prev) return null;
                const currentOptimizeStep = prev.steps.find(s => s.id === 'optimize');
                const optimizeProgress = currentOptimizeStep?.progress || 0;
                return {
                    ...prev,
                    steps: prev.steps.map(s =>
                        s.status === 'processing'
                            ? { ...s, status: 'partial', details: `已停止优化（完成了 ${optimizeProgress}%）` }
                            : s
                    )
                };
            });
            // 不设置错误，而是显示部分完成的结果
            setResult(prev => prev || {
                success: true,
                imported_count: progress?.stats.chapters || 0,
                skipped_count: 0,
                failed_count: 0,
                article_ids: []
            });
        }
    };

    const handleImport = async () => {
        console.log('[Import] Starting import...');
        setLoading(true);
        setError('');
        setResult(null);

        // 初始化进度 - 根据导入模式动态调整
        const initialSteps: ProgressStep[] = [
            ...(importMode === 'url'
                ? [{ id: 'fetch', label: '初始化抓取', status: 'pending' as const }]
                : importMode === 'docx'
                    ? [{ id: 'upload', label: '上传文件', status: 'pending' as const }]
                    : []), // text mode usually doesn't have an upload step but we can add one if needed
            { id: 'process', label: '解析与生成内容', status: 'pending' as const, details: '提取核心干货、解析结构、生成摘要' },
            ...(bokehOptimize ? [{ id: 'optimize', label: 'Bokeh 优化', status: 'pending' as const, details: '' }] : [])
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
                    const mergeError = await mergeResponse.json();
                    console.error('[Upload] Merge failed:', mergeError);
                    throw new Error(mergeError.error || mergeError.details || 'Failed to merge chunks');
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
                formData.append('product_line', productModels.length > 0 ? productLine : 'GENERIC');
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



                const formDataUrl = new FormData();
                if (urlInput) formDataUrl.append('url', urlInput);
                if (title) formDataUrl.append('title', title);
                formDataUrl.append('category', category);
                formDataUrl.append('product_line', productModels.length > 0 ? productLine : 'GENERIC');
                formDataUrl.append('product_models', JSON.stringify(productModels));
                formDataUrl.append('visibility', visibility);
                formDataUrl.append('tags', tags);
                formDataUrl.append('turbo', String(turboMode));

                // 标记 fetch 开始处理
                setProgress(prev => prev ? {
                    ...prev,
                    steps: prev.steps.map(s => s.id === 'fetch' ? { ...s, status: 'processing', progress: 0 } : s)
                } : null);

                // 启动模拟进度
                let testProgress = 0;
                const fetchInterval = setInterval(() => {
                    testProgress += (90 - testProgress) * 0.05; // 渐近到90%
                    setProgress(prev => prev ? {
                        ...prev,
                        steps: prev.steps.map(s => s.id === 'fetch' ? { ...s, progress: Math.floor(testProgress) } : s)
                    } : null);
                }, 500);

                try {
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
                            product_line: productModels.length > 0 ? productLine : 'GENERIC',
                            product_models: productModels,
                            visibility,
                            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                            turbo: turboMode,
                            locale: language === 'en' ? 'en-US' : language === 'zh' ? 'zh-CN' : language  // Pass current app language for title translation
                        })
                    });
                } finally {
                    clearInterval(fetchInterval);
                }

                if (response.ok) {
                    setProgress(prev => prev ? {
                        ...prev,
                        steps: prev.steps.map(s => s.id === 'fetch' ? { ...s, status: 'completed', progress: 100 } : s)
                    } : null);
                }

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
                        product_line: productModels.length > 0 ? productLine : 'GENERIC',
                        product_models: productModels,
                        visibility,
                        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                        status: 'Published'
                    })
                });
            }

            // 步骤2: 处理文档 - 调用后端API
            setProgress(prev => prev ? {
                ...prev,
                currentStep: 'process',
                steps: prev.steps.map(s => s.id === 'process' ? { ...s, status: 'processing' } : s)
            } : null);

            // 检查响应
            const contentType = response.headers.get('content-type');
            let data;

            if (!response.ok) {
                // 尝试解析错误信息
                try {
                    if (contentType && contentType.includes('application/json')) {
                        data = await response.json();
                    } else {
                        const textError = await response.text();
                        console.error('[Import] Server returned non-JSON:', textError.substring(0, 500));
                        throw new Error(`服务器错误 (${response.status}): 请稍后重试`);
                    }
                } catch (parseErr) {
                    console.error('[Import] Failed to parse response:', parseErr);
                    throw new Error(`服务器错误 (${response.status}): 请检查服务器状态`);
                }
            } else {
                data = await response.json();
            }

            console.log('[Import] Response data:', data);

            if (!data.success) {
                console.error('[Import] API error:', data.error);
                throw new Error(data.error?.message || '导入失败');
            }

            // 标记处理步骤完成
            setProgress(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => s.id === 'process' ? { ...s, status: 'completed' } : s),
                stats: {
                    chapters: data.data?.chapter_count || data.data?.imported_count || 0,
                    images: data.data?.image_count || 0,
                    tables: data.data?.table_count || 0,
                    totalSize: data.data?.total_size ? formatSize(data.data.total_size) : '0KB'
                }
            } : null);

            // 检查是否有警告
            if (data.warning && data.warning.type === 'title_mismatch') {
                setWarningDialog({
                    visible: true,
                    message: data.warning.message,
                    details: data.warning.details
                });
            }

            const articleIds = data.data?.article_ids || [data.data?.id];

            // 如果选择了Bokeh优化，调用format API
            if (bokehOptimize && articleIds && articleIds.length > 0) {
                setProgress(prev => prev ? {
                    ...prev,
                    currentStep: 'optimize',
                    steps: prev.steps.map(s =>
                        s.id === 'optimize' ? { ...s, status: 'processing' } : s
                    )
                } : null);

                console.log('[Import] Starting Bokeh optimization for', articleIds.length, 'articles');

                const totalArticles = articleIds.length;
                let optimizedCount = 0;

                for (let i = 0; i < articleIds.length; i++) {
                    if (controller.signal.aborted) {
                        console.log('[Import] Bokeh optimization cancelled by user');
                        break;
                    }

                    const articleId = articleIds[i];
                    try {
                        console.log(`[Import] Optimizing article ${i + 1}/${articleIds.length}: ID=${articleId}`);

                        // 优化进度动画 - 使用更平滑的增量，在90%前快速，90%后减慢
                        const basePercent = Math.round((optimizedCount / totalArticles) * 100);
                        const nextStepPercent = Math.round(((optimizedCount + 1) / totalArticles) * 100);

                        let currentSimulated = basePercent;
                        const maxProgress = nextStepPercent - 2; // 留2%给完成跳转
                        const progressInterval = setInterval(() => {
                            if (currentSimulated < maxProgress) {
                                // 渐进式增速：前期快，后期慢，避免卡顿感
                                const remaining = maxProgress - currentSimulated;
                                const increment = remaining > 30 ? 3 : remaining > 15 ? 2 : 1;
                                currentSimulated = Math.min(currentSimulated + increment, maxProgress);
                                setProgress(prev => prev ? {
                                    ...prev,
                                    steps: prev.steps.map(s =>
                                        s.id === 'optimize' ? { ...s, progress: currentSimulated, details: `正在优化... ${currentSimulated}%` } : s
                                    )
                                } : null);
                            }
                        }, 400); // 更频繁更新，动画更平滑

                        try {
                            await axios.post(`${API_BASE_URL}/api/v1/knowledge/${articleId}/format`,
                                { mode: 'full' },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                        } finally {
                            clearInterval(progressInterval);
                        }

                        optimizedCount++;

                        // 更新进度（优化完成后更新一次）
                        const finalPercent = Math.round((optimizedCount / totalArticles) * 100);
                        setProgress(prev => prev ? {
                            ...prev,
                            steps: prev.steps.map(s =>
                                s.id === 'optimize'
                                    ? { ...s, progress: finalPercent, details: `${optimizedCount}/${totalArticles} 篇` }
                                    : s
                            )
                        } : null);
                    } catch (err) {
                        console.warn(`[Import] Failed to optimize article ${articleId}:`, err);
                        // 不中断整个流程，继续优化其他文章
                    }
                }

                setProgress(prev => prev ? {
                    ...prev,
                    steps: prev.steps.map(s =>
                        s.id === 'optimize' ? { ...s, status: 'completed' } : s
                    )
                } : null);
            }

            // 标记所有步骤完成
            setProgress(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => ({ ...s, status: 'completed' }))
            } : null);

            // 导入完成，设置结果以显示“阅读文章”按钮
            setResult({
                success: true,
                imported_count: data.data?.chapter_count || data.data?.imported_count || 0,
                skipped_count: data.data?.skipped_count || 0,
                failed_count: 0,
                article_ids: articleIds
            });

        } catch (err: any) {
            console.error('Import error:', err);
            if (err.name === 'AbortError') {
                setError('导入已取消');
            } else {
                setError(err.message || '导入失败');
            }
            // 清空成功的result，避免显示之前的成功状态
            setResult(null);
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

    // handleViewImported 已移除 - 导入完成后直接点击完成按钮返回


    if (!isOpen) return null;

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
            }} onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
                <div style={{
                    position: 'relative',
                    width: '90%', maxWidth: '1400px', maxHeight: '90vh',
                    background: 'linear-gradient(to bottom, #1a1a1a 0%, #151515 100%)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Header - matching Manual TOC modal */}
                    <div style={{
                        padding: '24px 32px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <h2 style={{
                                fontSize: '24px',
                                fontWeight: 700,
                                margin: 0,
                                color: '#fff'
                            }}>
                                {t('wiki.import_knowledge')}
                            </h2>
                            <p style={{
                                color: '#888',
                                fontSize: '14px',
                                margin: 0,
                                fontWeight: 400
                            }}>
                                {t('wiki.import_description')}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        >
                            <X size={22} color="#fff" />
                        </button>
                    </div>

                    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

                        {/* Import Mode Selector - macOS26 Style */}
                        {/* 移除独立的大横条，改为放在左侧内容框内 */}

                        {/* Main Content: Left 2/5 Content, Right 3/5 Metadata */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '20px', alignItems: 'stretch' }}>
                            {/* Left: Content Input */}
                            <div style={{
                                background: 'linear-gradient(145deg, #252525 0%, #1f1f1f 100%)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '16px',
                                padding: '20px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%'
                            }}>
                                <h3 style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    marginBottom: '16px',
                                    color: '#fff',
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
                                        { mode: 'docx' as const, label: t('wiki.import_mode_docx') },
                                        { mode: 'url' as const, label: t('wiki.import_mode_url') },
                                        { mode: 'text' as const, label: t('wiki.import_mode_text') }
                                    ].map(({ mode, label }) => (
                                        <button
                                            key={mode}
                                            onClick={() => setImportMode(mode)}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                background: importMode === mode
                                                    ? 'rgba(255,215,0,0.12)'
                                                    : 'transparent',
                                                border: `1px solid ${importMode === mode ? 'rgba(255,215,0,0.4)' : 'transparent'}`,
                                                borderRadius: '8px',
                                                color: importMode === mode ? '#fff' : '#888',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 700,
                                                transition: 'all 0.2s',
                                                boxShadow: importMode === mode
                                                    ? '0 4px 12px rgba(0,0,0,0.2)'
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

                                        {/* 导入方式选项 - 紧凑单选 */}
                                        <div style={{
                                            marginTop: '16px',
                                            padding: '12px',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.06)'
                                        }}>
                                            <div style={{ fontSize: '12px', color: '#999', marginBottom: '10px', fontWeight: 500 }}>
                                                导入方式
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => setBokehOptimize(true)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '10px 12px',
                                                        background: bokehOptimize ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px solid ${bokehOptimize ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: bokehOptimize ? '#fff' : '#888' }}>
                                                        <Sparkles size={14} style={{ opacity: bokehOptimize ? 1 : 0.6 }} />
                                                        <div style={{ fontSize: '13px', fontWeight: 700 }}>
                                                            Bokeh 优化
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: bokehOptimize ? '#666' : '#666', marginTop: '2px' }}>
                                                        优化排版 + 摘要
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => setBokehOptimize(false)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '10px 12px',
                                                        background: !bokehOptimize ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px solid ${!bokehOptimize ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: !bokehOptimize ? '#fff' : '#888', textAlign: 'center' }}>
                                                        直接导入
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: !bokehOptimize ? '#666' : '#666', marginTop: '2px', textAlign: 'center' }}>
                                                        保持原始格式
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
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
                                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="checkbox"
                                                id="turbo-mode"
                                                checked={turboMode}
                                                onChange={(e) => setTurboMode(e.target.checked)}
                                                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                            />
                                            <label htmlFor="turbo-mode" style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                🚀 Turbo 模式 (Jina Reader 增强：自动还原表格、图片并绕过反爬)
                                            </label>
                                        </div>
                                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                                            💡 提示：支持导入 Application Note、官方博客等，建议默认开启
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
                                padding: '20px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Header with Import Button */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h3 style={{
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: '#fff',
                                        letterSpacing: '0.3px',
                                        margin: 0
                                    }}>
                                        {t('wiki.import_metadata')}
                                    </h3>
                                    <button
                                        onClick={handleImport}
                                        disabled={loading || (importMode === 'docx' && !docxFile) || (importMode === 'url' && !urlInput) || (importMode === 'text' && (!title || !textInput))}
                                        style={{
                                            padding: '12px 28px',
                                            background: loading
                                                ? 'rgba(255,255,255,0.05)'
                                                : '#FFD700',
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

                                {/* Metadata Form - Layout: Title → Product Line → Product Models → (Category + Visibility) → Tags */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                                    {/* Title Input (optional) */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                            {t('wiki.import_title_label')}
                                            <span style={{ color: '#666', marginLeft: '4px', fontSize: '11px' }}>{t('common.optional')}</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder={t('wiki.import_title_placeholder')}
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

                                    {/* Product Line */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                            {t('wiki.import_product_line')} *
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

                                    {/* Product Models - Multi-select Tags */}
                                    <div>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '13px',
                                            color: '#999',
                                            marginBottom: '8px',
                                            fontWeight: 500
                                        }}>
                                            {t('wiki.import_product_models')}
                                            <span style={{
                                                color: '#666',
                                                marginLeft: '4px',
                                                fontSize: '11px'
                                            }}>
                                                {t('common.optional')}
                                            </span>
                                        </label>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                            padding: '12px',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '10px'
                                        }}>
                                            {(productModelOptions[productLine] || []).map(model => {
                                                const isSelected = productModels.includes(model);
                                                return (
                                                    <button
                                                        key={model}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setProductModels(productModels.filter(m => m !== model));
                                                            } else {
                                                                setProductModels([...productModels, model]);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: isSelected ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
                                                            border: `1px solid ${isSelected ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                                            borderRadius: '6px',
                                                            color: isSelected ? '#FFFFFF' : '#ccc',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {model}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Category + Visibility side by side */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {/* Category */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                                {t('wiki.import_category')} *
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

                                        {/* Visibility */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                                {t('wiki.import_visibility')} *
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
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 500 }}>
                                            {t('wiki.import_tags')}
                                        </label>
                                        <input
                                            type="text"
                                            value={tags}
                                            onChange={(e) => setTags(e.target.value)}
                                            placeholder={t('wiki.import_tags_placeholder')}
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
                                    maxWidth: '680px',
                                    background: 'linear-gradient(145deg, #2a2a2a 0%, #1f1f1f 100%)',
                                    borderRadius: '20px',
                                    boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                                    padding: '32px',
                                    border: '1px solid rgba(255,215,0,0.1)'
                                }}>
                                    {/* Header */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <h3 style={{
                                            fontSize: '20px',
                                            fontWeight: 600,
                                            color: '#fff',
                                            margin: '0 0 16px 0',
                                            letterSpacing: '0.5px',
                                            textAlign: 'center'
                                        }}>
                                            正在导入知识
                                        </h3>
                                        {/* Import Info Summary - Redesigned to text description */}
                                        <div style={{
                                            padding: '16px 20px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderLeft: '3px solid #FFD700',
                                            borderRadius: '8px',
                                            lineHeight: '1.6',
                                            color: '#aaa',
                                            fontSize: '14px'
                                        }}>
                                            正在为 <span style={{ color: '#fff', fontWeight: 600 }}>{productModels.join(', ')}</span> 导入来自 {importMode === 'url' && urlInput ? (
                                                <a
                                                    href={urlInput}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#FFD700', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >{urlInput}</a>
                                            ) : (
                                                <span style={{ color: '#FFD700', fontWeight: 600 }}>{docxFile?.name || urlInput || '文本输入'}</span>
                                            )} 的知识。
                                            <br />
                                            导入分类：<span style={{ color: '#fff' }}>{category}</span>，源模式：<span style={{ color: '#fff' }}>{importMode.toUpperCase()}</span>{bokehOptimize && '，已开启 Bokeh 优化'}。
                                        </div>
                                    </div>

                                    {/* Progress Steps */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                                        {progress.steps.map((step, index) => (
                                            <div key={step.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '14px',
                                                padding: '16px',
                                                background: step.status === 'processing'
                                                    ? 'rgba(255,255,255,0.03)'
                                                    : step.status === 'completed' ? 'rgba(255,255,255,0.02)' :
                                                        step.status === 'failed' ? 'rgba(255,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${step.status === 'processing'
                                                    ? 'rgba(255,255,255,0.08)' :
                                                    step.status === 'completed' ? 'rgba(255,255,255,0.06)' :
                                                        step.status === 'failed' ? 'rgba(255,68,68,0.3)' : 'rgba(255,255,255,0.05)'}`,
                                                borderRadius: '12px',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}>
                                                {/* Step Number */}
                                                <div style={{
                                                    minWidth: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: step.status === 'processing' ? 'rgba(255,255,255,0.08)' :
                                                        step.status === 'failed' ? '#ff4444' : 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px',
                                                    fontWeight: 700,
                                                    color: step.status === 'processing' ? '#fff' :
                                                        step.status === 'failed' ? '#fff' : '#666'
                                                }}>
                                                    {index + 1}
                                                </div>

                                                {/* Step Info */}
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{
                                                            fontSize: '15px',
                                                            fontWeight: 600,
                                                            color: step.status === 'processing' ? '#fff' :
                                                                step.status === 'completed' ? '#fff' : '#999'
                                                        }}>
                                                            {step.label}
                                                        </div>
                                                        {/* Step details */}
                                                        {step.details && step.status === 'processing' && (
                                                            <div style={{
                                                                fontSize: '12px',
                                                                color: '#666',
                                                                marginTop: '4px'
                                                            }}>
                                                                {step.details}
                                                            </div>
                                                        )}
                                                        {/* Processing progress bar - indeterminate */}
                                                        {step.id === 'process' && step.status === 'processing' && (
                                                            <div style={{ marginTop: '10px' }}>
                                                                <div style={{
                                                                    width: '100%',
                                                                    height: '4px',
                                                                    background: 'rgba(255,215,0,0.1)',
                                                                    borderRadius: '2px',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    <div style={{
                                                                        width: '30%',
                                                                        height: '100%',
                                                                        background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                                                                        animation: 'indeterminate 1.5s infinite ease-in-out',
                                                                        borderRadius: '2px'
                                                                    }} />
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '11px',
                                                                    color: '#888',
                                                                    marginTop: '6px'
                                                                }}>
                                                                    正在解析文档结构、提取图片、生成AI摘要...
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Bokeh optimize progress bar */}
                                                        {step.id === 'optimize' && step.status === 'processing' && (
                                                            <div style={{ marginTop: '10px' }}>
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
                                                                        background: '#FFFFFF',
                                                                        transition: 'width 0.3s ease-out',
                                                                        borderRadius: '2px'
                                                                    }} />
                                                                </div>
                                                                {/* 移除重复的百分比显示，details中已包含进度信息 */}
                                                            </div>
                                                        )}
                                                        {/* Upload Progress Bar and Info */}
                                                        {step.id === 'upload' && step.status === 'processing' && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                <div style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    fontSize: '12px',
                                                                    color: '#999'
                                                                }}>
                                                                    <span>{formatSize(uploadedSize)} / {formatSize(totalFileSize)}</span>
                                                                    <span style={{ color: '#FFD700' }}>{uploadSpeed}</span>
                                                                </div>
                                                                <div style={{
                                                                    width: '100%',
                                                                    height: '4px',
                                                                    background: 'rgba(255,255,255,0.1)',
                                                                    borderRadius: '2px',
                                                                    overflow: 'hidden',
                                                                    marginTop: '6px'
                                                                }}>
                                                                    <div style={{
                                                                        width: `${step.progress || 0}%`,
                                                                        height: '100%',
                                                                        background: '#00A88E', // Kine Green
                                                                        transition: 'width 0.3s ease-out'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Fetch Progress Bar */}
                                                        {step.id === 'fetch' && step.status === 'processing' && (
                                                            <div style={{ marginTop: '10px' }}>
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
                                                                        background: '#FFFFFF',
                                                                        transition: 'width 0.3s ease-out',
                                                                        borderRadius: '2px'
                                                                    }} />
                                                                </div>
                                                                <div style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    fontSize: '11px',
                                                                    color: '#888',
                                                                    marginTop: '6px'
                                                                }}>
                                                                    <span>正在获取...</span>
                                                                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{step.progress || 0}%</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                    </div>

                                                    {/* Completed Checkmark - Right side */}
                                                    {step.status === 'completed' && (
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: '#10B981',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '14px',
                                                            color: '#000',
                                                            fontWeight: 700
                                                        }}>
                                                            ✓
                                                        </div>
                                                    )}

                                                    {/* Bokeh Optimize Stop Button - Right side */}
                                                    {step.id === 'optimize' && step.status === 'processing' && (
                                                        <button
                                                            onClick={handleCancel}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '36px',
                                                                height: '36px',
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                borderRadius: '50%',
                                                                color: '#EF4444',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                marginLeft: '12px',
                                                                padding: 0
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                            }}
                                                            title="停止优化"
                                                        >
                                                            <X size={20} />
                                                        </button>

                                                    )}

                                                    {/* Failed indicator */}
                                                    {step.status === 'failed' && (
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: '#EF4444',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '14px',
                                                            color: '#fff',
                                                            fontWeight: 700
                                                        }}>
                                                            ✗
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Statistics */}
                                    {(progress.stats.chapters > 0 || progress.stats.images > 0) && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: importMode === 'docx' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                                            gap: '12px',
                                            padding: '20px',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            marginBottom: '20px'
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                                    {progress.stats.chapters}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
                                                    知识文章
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                                    {progress.stats.images}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
                                                    提取图片
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                                    {progress.stats.tables}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
                                                    转换表格
                                                </div>
                                            </div>
                                            {importMode === 'docx' && (
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                                        {progress.stats.totalSize.split(' ')[0]}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
                                                        文件大小({progress.stats.totalSize.split(' ')[1] || 'MB'})
                                                    </div>
                                                </div>
                                            )}
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
                                            <>
                                                {result?.article_ids && result.article_ids.length > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            window.open(`/tech-hub/wiki/${result.article_ids![0]}`, '_blank');
                                                        }}
                                                        style={{
                                                            padding: '12px 24px',
                                                            background: 'rgba(255, 215, 0, 0.1)',
                                                            border: '1px solid rgba(255, 215, 0, 0.3)',
                                                            borderRadius: '10px',
                                                            color: '#FFD700',
                                                            fontSize: '14px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255, 215, 0, 0.2)';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <BookOpen size={16} />
                                                        阅读文章
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setProgress(null)}
                                                    style={{
                                                        padding: '12px 32px',
                                                        background: '#00A650',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        color: '#fff',
                                                        fontSize: '14px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 4px 12px rgba(0,166,80,0.3)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,166,80,0.4)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,166,80,0.3)';
                                                    }}
                                                >
                                                    完成
                                                </button>
                                            </>
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
                                        onClick={() => {
                                            setError('');
                                            setProgress(null); // 清空进度状态，避免显示之前的成功状态
                                        }}
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
                                        系统已按您选择的产品型号导入，<br />
                                        如有错误请删除后重新导入
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
            @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
            }
        `}</style>
        </>
    );
}
