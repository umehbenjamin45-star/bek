import type { Metadata } from 'next';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = { title: 'Bek — Voice to text', description: 'A personal workspace for recording, transcribing, and saving your thoughts.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><Shell>{children}</Shell></body></html>; }
