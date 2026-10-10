   import type { MetadataRoute } from 'next';

   export default function manifest(): MetadataRoute.Manifest {
     return {
       name: 'HR Policy Q&A Assistant',
       short_name: 'HR Policy Q&A',
       description: 'Cited answers on Singapore employment rules and a sample company handbook.',
       start_url: '/',
       display: 'standalone',
       background_color: '#ffffff',
       theme_color: '#111111',
       icons: [
         { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
         { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
         { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
       ],
     };
   }