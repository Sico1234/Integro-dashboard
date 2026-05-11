import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { FirebaseProvider } from '@/components/FirebaseProvider';
import { Toaster } from '@/components/ui/sonner';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Case Tracking MIS',
  description: 'Professional dashboard for tracking cases, assignments, feedback, and dispatch status.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <FirebaseProvider>
          {children}
          <Toaster position="top-right" />
        </FirebaseProvider>
      </body>
    </html>
  );
}
