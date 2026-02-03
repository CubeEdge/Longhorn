import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Film } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';

interface AttachmentZoneProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
}

const AttachmentZone: React.FC<AttachmentZoneProps> = ({ files, onFilesChange }) => {
    const { t } = useLanguage();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        onFilesChange([...files, ...acceptedFiles]);
    }, [files, onFilesChange]);

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        onFilesChange(newFiles);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': [],
            'video/*': [],
            'application/pdf': [],
            'text/plain': []
        }
    });

    return (
        <div className="space-y-4">
            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer
                    flex flex-col items-center justify-center gap-2
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                `}
                style={{
                    borderColor: isDragActive ? 'var(--kine-yellow)' : 'var(--border-color)',
                    backgroundColor: isDragActive ? 'rgba(255, 184, 0, 0.05)' : 'transparent'
                }}
            >
                <input {...getInputProps()} />
                <div className="p-3 rounded-full bg-muted">
                    <Upload size={24} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                    <p className="font-medium">{t('service.upload.drop_hint') || '点击或拖拽文件到此处上传'}</p>
                    <p className="text-sm text-muted-foreground">
                        {t('service.upload.support_hint') || '支持图片、视频、PDF等 (最大 50MB)'}
                    </p>
                </div>
            </div>

            {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {files.map((file, index) => {
                        const isImage = file.type.startsWith('image/');
                        const isVideo = file.type.startsWith('video/');

                        return (
                            <div
                                key={index}
                                className="group relative rounded-lg border border-border bg-card overflow-hidden aspect-video flex items-center justify-center"
                            >
                                {isImage ? (
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : isVideo ? (
                                    <Film size={32} className="text-primary" />
                                ) : (
                                    <FileText size={32} className="text-muted-foreground" />
                                )}

                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFile(index);
                                        }}
                                        className="p-1.5 bg-destructive text-destructive-foreground rounded-full hover:scale-110 transition-transform"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-[10px] text-white truncate px-2">
                                    {file.name}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AttachmentZone;
