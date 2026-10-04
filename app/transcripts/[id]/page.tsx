'use client';
import { use } from 'react';
import { AuthGate } from '@/components/auth-provider';
import { TranscriptEditor } from '@/components/transcript-editor';
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <AuthGate><TranscriptEditor key={id} id={id} /></AuthGate>; }
