import { useState, useCallback } from 'react';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

export const useConfirm = () => {
    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        options: ConfirmOptions;
        resolve: (value: boolean) => void;
    } | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({
                open: true,
                options: {
                    title: options.title || '确认操作',
                    message: options.message,
                    confirmText: options.confirmText || '确认',
                    cancelText: options.cancelText || '取消',
                    type: options.type || 'danger'
                },
                resolve
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (confirmState) {
            confirmState.resolve(true);
            setConfirmState(null);
        }
    }, [confirmState]);

    const handleCancel = useCallback(() => {
        if (confirmState) {
            confirmState.resolve(false);
            setConfirmState(null);
        }
    }, [confirmState]);

    return {
        confirm,
        confirmState: confirmState ? {
            open: confirmState.open,
            ...confirmState.options
        } : null,
        handleConfirm,
        handleCancel
    };
};
