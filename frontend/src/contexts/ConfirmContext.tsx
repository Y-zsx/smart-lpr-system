import React, { createContext, useContext, ReactNode } from 'react';
import { useConfirm, ConfirmOptions } from '../hooks/useConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {confirmState && (
                <ConfirmDialog
                    open={confirmState.open}
                    title={confirmState.title || '确认操作'}
                    message={confirmState.message}
                    confirmText={confirmState.confirmText}
                    cancelText={confirmState.cancelText}
                    type={confirmState.type}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirmContext = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirmContext must be used within ConfirmProvider');
    }
    return context;
};
