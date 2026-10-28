'use client';

import { useRouter } from 'next/navigation';
import { LandingView } from '@/components/landing/LandingView';

export default function HomePage() {
  const router = useRouter();

  const handleOpenStudio = () => {
    router.push('/dashboard');
  };

  return <LandingView onOpenStudio={handleOpenStudio} />;
}
