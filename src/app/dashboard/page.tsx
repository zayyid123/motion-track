'use client';

import { MotionTrackStudio } from '@/components/editor/MotionTrackStudio';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/toast';

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <MotionTrackStudio />
      </ToastProvider>
    </ErrorBoundary>
  );
}
