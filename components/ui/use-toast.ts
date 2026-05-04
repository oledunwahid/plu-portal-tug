'use client';

import { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

type Listener = (toasts: Toast[]) => void;

let _toasts: Toast[] = [];
const _listeners: Set<Listener> = new Set();

function notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

export function toast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2, 9);
  _toasts = [..._toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, 4500);
}

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setToasts([..._toasts]);
    _listeners.add(setToasts);
    return () => {
      _listeners.delete(setToasts);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  return { toasts, dismiss };
}
