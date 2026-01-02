import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Trash2, RotateCcw, Trash, Info } from 'lucide-react';
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
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Trash2 className="w-6 h-6 text-blue-600" />
                        回收站
                    </h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-1 text-sm">
                        <Info className="w-4 h-4" />
                        删除的文件将保留 30 天，过期后将自动物理销毁
                    </p>
                </div>
                {items.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Trash className="w-4 h-4" />
                        清空回收站
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500">回收站是空的</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">文件名</th>
                                <th className="px-6 py-4">原路径</th>
                                <th className="px-6 py-4">删除时间</th>
                                <th className="px-6 py-4">执行人</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                                {item.is_directory ? (
                                                    <Trash2 className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <Trash className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-gray-400 font-mono">{item.original_path}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {format(new Date(item.deletion_date), 'yyyy-MM-dd HH:mm')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {item.deleted_by}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 isolate opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleRestore(item.id)}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="恢复"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePermanently(item.id)}
                                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                title="彻底删除"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default RecycleBin;
