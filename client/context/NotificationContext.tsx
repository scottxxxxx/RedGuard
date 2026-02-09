"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';

interface NotificationContextType {
    showToast: (message: string, type?: ToastType) => void;
    confirm: (options: {
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        isDanger?: boolean;
    }) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        isDanger?: boolean;
        resolve: (value: boolean) => void;
    } | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    }, []);

    const confirm = useCallback((options: {
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        isDanger?: boolean;
    }) => {
        return new Promise<boolean>((resolve) => {
            setConfirmation({ ...options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        if (confirmation) {
            confirmation.resolve(true);
            setConfirmation(null);
        }
    };

    const handleCancel = () => {
        if (confirmation) {
            confirmation.resolve(false);
            setConfirmation(null);
        }
    };

    return (
        <NotificationContext.Provider value={{ showToast, confirm }}>
            {children}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            {confirmation && (
                <ConfirmationModal
                    isOpen={!!confirmation}
                    title={confirmation.title}
                    message={confirmation.message}
                    confirmLabel={confirmation.confirmLabel}
                    cancelLabel={confirmation.cancelLabel}
                    isDanger={confirmation.isDanger}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
