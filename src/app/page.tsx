'use client';

import React, { useState } from 'react';
import { LandingView } from '@/components/landing/LandingView';
import { MotionTrackStudio } from '@/components/editor/MotionTrackStudio';

export default function Home() {
  const [inStudio, setInStudio] = useState<boolean>(false);

  if (inStudio) {
    return <MotionTrackStudio />;
  }

  return <LandingView onOpenStudio={() => setInStudio(true)} />;
}
