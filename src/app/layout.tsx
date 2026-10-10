import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'HR Policy Q&A Assistant',
  description: 'Cited answers on Singapore employment rules and a sample company handbook.',
};

   const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

   export default function RootLayout({
     children,
   }: Readonly<{
     children: React.ReactNode;
   }>) {
     return (
       <html
         lang="en"
         className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
         suppressHydrationWarning
       >
         <head>
           <script dangerouslySetInnerHTML={{ __html: themeScript }} />
         </head>
         <body className="min-h-full flex flex-col" suppressHydrationWarning>
           <ServiceWorkerRegister />
           {children}
         </body>
       </html>
     );
   }