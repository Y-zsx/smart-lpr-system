import { useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toast';

export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const toast: Toast = { id, message, type, duration };
        setToasts((prev) => [...prev, toast]);
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const success = useCallback((message: string, duration?: number) => {
        return showToast(message, 'success', duration);
    }, [showToast]);

    const error = useCallback((message: string, duration?: number) => {
        return showToast(message, 'error', duration);
    }, [showToast]);

    const warning = useCallback((message: string, duration?: number) => {
        return showToast(message, 'warning', duration);
    }, [showToast]);

    const info = useCallback((message: string, duration?: number) => {
        return showToast(message, 'info', duration);
    }, [showToast]);

    return {
        toasts,
        showToast,
        removeToast,
        success,
        error,
        warning,
        info
    };
};
