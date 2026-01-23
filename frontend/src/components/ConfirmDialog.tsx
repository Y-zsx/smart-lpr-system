import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmText = '确认',
    cancelText = '取消',
    type = 'danger',
    onConfirm,
    onCancel
}) => {
    if (!open) return null;

    const colors = {
        danger: {
            icon: 'bg-red-100 text-red-600',
            button: 'bg-red-600 hover:bg-red-700 text-white'
        },
        warning: {
            icon: 'bg-yellow-100 text-yellow-600',
            button: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        },
        info: {
            icon: 'bg-blue-100 text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700 text-white'
        }
    };

    const color = colors[type];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-full flex-shrink-0 ${color.icon}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {title}
                        </h3>
                        <p className="text-sm text-gray-600">
                            {message}
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 ${color.button} rounded-lg transition-colors`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
