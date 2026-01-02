import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Trash2, RotateCcw, Trash, Info, FileText, Folder } from 'lucide-react';
import { format } from 'date-fns';

interface RecycleItem {
    id: number;
    name: string;
    original_path: string;
    deleted_path: string;
    deletion_date: string;
    user_id: number;
    is_directory: number;
    deleted_by: string;
}

const RecycleBin: React.FC = () => {
    const [items, setItems] = useState<RecycleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();

    const fetchRecycleItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/recycle-bin', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(res.data);
        } catch (err) {
            console.error('Failed to fetch recycle items', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecycleItems();
    }, []);

    const handleRestore = async (id: number) => {
        try {
            await axios.post(`/api/recycle-bin/restore/${id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchRecycleItems();
        } catch (err) {
            alert('恢复失败');
        }
    };

    const handleDeletePermanently = async (id: number) => {
        if (!confirm('确定要永久删除此项吗？此操作不可撤销。')) return;
        try {
            await axios.delete(`/api/recycle-bin/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchRecycleItems();
        } catch (err) {
            alert('彻底删除失败');
        }
    };

    const handleClearAll = async () => {
        if (!confirm('确定要清空回收站吗？所有文件将直接物理删除且无法恢复！')) return;
        try {
            await axios.delete('/api/recycle-bin-clear', {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchRecycleItems();
        } catch (err) {
            alert('清空失败');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start mb-10 shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                        <Trash2 className="w-8 h-8 text-blue-600" />
                        回收站
                    </h1>
                    <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-blue-50/50 border border-blue-100/50 rounded-full w-fit">
                        <Info className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-blue-700 text-xs font-medium">删除的文件将保留 30 天，过期后将自动物理销毁</span>
                    </div>
                </div>
                {items.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="px-5 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 hover:shadow-sm active:scale-95 transition-all flex items-center gap-2 text-sm font-semibold"
                    >
                        <Trash className="w-4 h-4" />
                        清空回收站
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-blue-600"></div>
                        </div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200 p-12 transition-all">
                        <div className="w-24 h-24 bg-white rounded-3xl shadow-lg border border-gray-100 flex items-center justify-center mb-6 transform hover:rotate-6 transition-transform">
                            <Trash2 className="w-12 h-12 text-gray-200" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">回收站为空</h3>
                        <p className="text-gray-400 text-sm max-w-xs text-center">
                            暂无被删除的文件。您可以放心浏览其他目录。
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-100">
                                    <tr className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                        <th className="px-8 py-5">文件名</th>
                                        <th className="px-8 py-5">原位置</th>
                                        <th className="px-8 py-5">删除日期</th>
                                        <th className="px-8 py-5">操作者</th>
                                        <th className="px-8 py-5 text-right whitespace-nowrap">管理</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-blue-50/20 transition-all group">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.is_directory ? 'bg-amber-50' : 'bg-blue-50'}`}>
                                                        {item.is_directory ? (
                                                            <Folder className={`w-5 h-5 ${item.is_directory ? 'text-amber-500' : 'text-blue-500'}`} />
                                                        ) : (
                                                            <FileText className="w-5 h-5 text-blue-500" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900 line-clamp-1">{item.name}</div>
                                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter mt-0.5">
                                                            {item.is_directory ? '文件夹' : '文件'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block font-mono max-w-[200px] truncate">
                                                    {item.original_path}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-sm text-gray-600 font-medium">
                                                {format(new Date(item.deletion_date), 'yyyy-MM-dd HH:mm')}
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                                                    {item.deleted_by}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleRestore(item.id)}
                                                        className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm hover:shadow active:scale-90"
                                                        title="立即恢复"
                                                    >
                                                        <RotateCcw className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePermanently(item.id)}
                                                        className="p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all shadow-sm hover:shadow active:scale-90"
                                                        title="永久删除"
                                                    >
                                                        <Trash className="w-4.5 h-4.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecycleBin;
