/**
 * 通用断点续传上传Hook
 * 支持分块上传、断点续传、进度跟踪、取消上传
 */

import { useState, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

interface UploadProgress {
    uploadedBytes: number;
    totalBytes: number;
    percentage: number;
    speed: string;
}

interface UseResumableUploadOptions {
    onProgress?: (progress: UploadProgress) => void;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
}

interface UploadResult {
    success: boolean;
    path?: string;
    error?: string;
}

export function useResumableUpload(options: UseResumableUploadOptions = {}) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress>({
        uploadedBytes: 0,
        totalBytes: 0,
        percentage: 0,
        speed: '0 B/s'
    });
    
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * 生成稳定的uploadId（基于文件特征）
     */
    const generateUploadId = (file: File): string => {
        const fileHash = `${file.name}-${file.size}-${file.lastModified}`;
        try {
            // 尝试使用btoa，如果失败则使用简单hash
            return btoa(encodeURIComponent(fileHash)).replace(/[/+=]/g, '').substring(0, 32);
        } catch (e) {
            // Fallback: 使用简单的字符串hash
            let hash = 0;
            for (let i = 0; i < fileHash.length; i++) {
                const char = fileHash.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36) + Date.now().toString(36);
        }
    };

    /**
     * 检查已存在的chunks
     */
    const checkExistingChunks = async (
        uploadId: string,
        totalChunks: number,
        token: string,
        signal: AbortSignal
    ): Promise<number[]> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/upload/check-chunks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uploadId, totalChunks }),
                signal
            });

            if (response.ok) {
                const data = await response.json();
                return data.existingChunks || [];
            }
        } catch (err) {
            console.warn('[Upload] Failed to check existing chunks:', err);
        }
        return [];
    };

    /**
     * 上传单个chunk
     */
    const uploadChunk = (
        chunk: Blob,
        uploadId: string,
        fileName: string,
        chunkIndex: number,
        totalChunks: number,
        path: string,
        token: string,
        signal: AbortSignal
    ): Promise<void> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && options.onProgress) {
                    // 进度在外部统一计算
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Chunk upload failed: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('uploadId', uploadId);
            formData.append('fileName', fileName);
            formData.append('chunkIndex', chunkIndex.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append('path', path);

            xhr.open('POST', `${API_BASE_URL}/api/upload/chunk`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);

            signal.addEventListener('abort', () => {
                xhr.abort();
            });
        });
    };

    /**
     * 合并chunks
     */
    const mergeChunks = async (
        uploadId: string,
        fileName: string,
        totalChunks: number,
        path: string,
        token: string,
        signal: AbortSignal
    ): Promise<UploadResult> => {
        const response = await fetch(`${API_BASE_URL}/api/upload/merge`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId,
                fileName,
                totalChunks,
                path
            }),
            signal
        });

        if (!response.ok) {
            throw new Error('Failed to merge chunks');
        }

        return await response.json();
    };

    /**
     * 上传文件（支持断点续传）
     */
    const uploadFile = useCallback(async (
        file: File,
        targetPath: string,
        token: string
    ): Promise<UploadResult> => {
        setIsUploading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const uploadId = generateUploadId(file);
            
            console.log(`[Upload] Starting: ${file.name}, uploadId: ${uploadId}, chunks: ${totalChunks}`);

            // 检查已存在的chunks
            let existingChunks = await checkExistingChunks(
                uploadId,
                totalChunks,
                token,
                controller.signal
            );

            console.log(`[Upload] Found ${existingChunks.length}/${totalChunks} existing chunks`);

            // 计算已上传字节数
            let uploadedBytes = existingChunks.length * CHUNK_SIZE;
            if (uploadedBytes > file.size) uploadedBytes = file.size;

            let lastLoaded = uploadedBytes;
            let lastTime = Date.now();

            // 更新初始进度
            const updateProgress = (current: number) => {
                const percentage = Math.round((current / file.size) * 100);
                
                const currentTime = Date.now();
                const timeDiff = (currentTime - lastTime) / 1000;
                const loadedDiff = current - lastLoaded;
                
                let speed = '0 B/s';
                if (timeDiff > 0.5) {
                    const bytesPerSecond = loadedDiff / timeDiff;
                    if (bytesPerSecond >= 1024 * 1024) {
                        speed = `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
                    } else if (bytesPerSecond >= 1024) {
                        speed = `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
                    } else {
                        speed = `${bytesPerSecond.toFixed(0)} B/s`;
                    }
                    lastLoaded = current;
                    lastTime = currentTime;
                }

                const progressData = {
                    uploadedBytes: current,
                    totalBytes: file.size,
                    percentage: Math.min(percentage, 99), // Cap at 99% until merge
                    speed
                };
                
                setProgress(progressData);
                options.onProgress?.(progressData);
            };

            updateProgress(uploadedBytes);

            // 上传缺失的chunks
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                if (controller.signal.aborted) {
                    throw new Error('Upload cancelled');
                }

                // 跳过已存在的chunk
                if (existingChunks.includes(chunkIndex)) {
                    const start = chunkIndex * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    uploadedBytes = Math.max(uploadedBytes, end);
                    continue;
                }

                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                await uploadChunk(
                    chunk,
                    uploadId,
                    file.name,
                    chunkIndex,
                    totalChunks,
                    targetPath,
                    token,
                    controller.signal
                );

                uploadedBytes += (end - start);
                updateProgress(uploadedBytes);
            }

            // 合并chunks
            const result = await mergeChunks(
                uploadId,
                file.name,
                totalChunks,
                targetPath,
                token,
                controller.signal
            );

            // 完成，更新到100%
            setProgress({
                uploadedBytes: file.size,
                totalBytes: file.size,
                percentage: 100,
                speed: '0 B/s'
            });

            options.onSuccess?.(result);
            return result;

        } catch (error: any) {
            console.error('[Upload] Error:', error);
            options.onError?.(error);
            throw error;
        } finally {
            setIsUploading(false);
            abortControllerRef.current = null;
        }
    }, [options]);

    /**
     * 取消上传
     */
    const cancelUpload = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    /**
     * 重置状态
     */
    const reset = useCallback(() => {
        setProgress({
            uploadedBytes: 0,
            totalBytes: 0,
            percentage: 0,
            speed: '0 B/s'
        });
        setIsUploading(false);
    }, []);

    return {
        uploadFile,
        cancelUpload,
        reset,
        isUploading,
        progress
    };
}
