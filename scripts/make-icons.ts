   import sharp from 'sharp';

   const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
     <rect width="512" height="512" fill="#111111"/>
     <text x="256" y="285" font-family="Arial, sans-serif" font-size="190" font-weight="700" fill="#ffffff" text-anchor="middle">HR</text>
     <text x="256" y="385" font-family="Arial, sans-serif" font-size="100" font-weight="600" fill="#9ec5ff" text-anchor="middle">Q&amp;A</text>
   </svg>`;

   async function main() {
     await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('public/icon-512.png');
     await sharp(Buffer.from(svg)).resize(192, 192).png().toFile('public/icon-192.png');
     console.log('✅ Icons created in public/');
   }

   main();