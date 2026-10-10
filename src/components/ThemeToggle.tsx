   'use client';

   import { useEffect, useState } from 'react';

   export default function ThemeToggle() {
     const [dark, setDark] = useState(false);
     const [mounted, setMounted] = useState(false);

     useEffect(() => {
       setDark(document.documentElement.classList.contains('dark'));
       setMounted(true);
     }, []);

     const toggle = () => {
       const next = !dark;
       setDark(next);
       document.documentElement.classList.toggle('dark', next);
       try {
         localStorage.setItem('theme', next ? 'dark' : 'light');
       } catch {}
     };

     return (
       <button
         onClick={toggle}
         aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
         title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
         className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
       >
         {mounted &&
           (dark ? (
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <circle cx="12" cy="12" r="4" />
               <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
             </svg>
           ) : (
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
             </svg>
           ))}
       </button>
     );
   }