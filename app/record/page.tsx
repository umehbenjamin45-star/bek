'use client';
import { AuthGate } from '@/components/auth-provider';
import { RecordingWorkspace } from '@/components/recording-workspace';
export default function Page() { return <AuthGate><RecordingWorkspace /></AuthGate>; }
