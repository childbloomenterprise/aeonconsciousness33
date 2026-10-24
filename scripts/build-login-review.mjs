import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFile, readFile, unlink } from 'node:fs/promises';
const entry = new URL('../src/login-preview-entry.tsx',import.meta.url);
await writeFile(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {LoginExperience} from './onboarding/LoginExperience';import '@fontsource/inter/latin-400.css';import '@fontsource/inter/latin-500.css';import '@fontsource/inter/latin-600.css';createRoot(document.getElementById('root')!).render(<LoginExperience/>);`);
try {
  const built = await build({configFile:false,plugins:[react()],build:{write:false,minify:true,lib:{entry:entry.pathname.replace(/^\/(\w:)/,'$1'),formats:['iife'],name:'LoginPreview'},cssCodeSplit:false}});
  const outputs = (Array.isArray(built)?built:[built]).flatMap(x=>x.output);
  const js=outputs.filter(x=>x.type==='chunk').map(x=>x.code).join('\n');
  const css=outputs.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n');
  await writeFile(new URL('../LOGIN-PREVIEW.html',import.meta.url),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LINC-33 · Personal setup preview</title><style>html,body{margin:0;padding:0}button,input{font:inherit}${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
  console.log('Standalone LOGIN-PREVIEW.html created. No localhost server or network requests required.');
}finally{await unlink(entry);}
