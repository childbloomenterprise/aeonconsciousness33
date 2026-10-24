import fs from 'node:fs';
const root=new URL('../',import.meta.url),at=p=>new URL(p,root);
const target=at('design/login-preview/');fs.mkdirSync(new URL('assets/',target),{recursive:true});
let html=fs.readFileSync(at('login-offline.html'),'utf8');
for(const [file,mime] of [['santorini-hero.jpg','image/jpeg'],['santorini-card.jpg','image/jpeg'],['munnar-card.jpg','image/jpeg']]){
  const bytes=fs.readFileSync(at('travel-assets/'+file));
  html=html.replaceAll('data:'+mime+';base64,'+bytes.toString('base64'),'./assets/'+file);
  fs.writeFileSync(new URL('assets/'+file,target),bytes);
}
html=html.replace("img-src data:;","img-src 'self' data:;");
html=html.replace('</style>',`\n/* Photograph-filled headline, with a readable solid-color fallback. */
@supports ((background-clip:text) or (-webkit-background-clip:text)) {
  .hero h1 {background-image:linear-gradient(#15372b60,#15372b60),url('./assets/santorini-hero.jpg');background-size:cover;background-position:center 67%;background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;}
  .hero h1 span {color:inherit;}
}
@media(forced-colors:active){.hero h1,.hero h1 span{background:none!important;color:CanvasText!important;-webkit-text-fill-color:CanvasText!important;}}
</style>`);
html=html.replace('Offline design preview · Sample details only · Nothing is sent or saved.','UI demo · Use sample details · No credentials are transmitted or saved.');
fs.writeFileSync(new URL('index.html',target),html);
const config={version:2,framework:null,buildCommand:null,installCommand:null,outputDirectory:'.',headers:[{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]},{source:'/assets/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=3600'}]}],rewrites:[{source:'/login-review',destination:'/index.html'}]};
fs.writeFileSync(new URL('vercel.json',target),JSON.stringify(config,null,2)+'\n');
fs.writeFileSync(new URL('README.md',target),'# LINC33 travel login UI preview\n\nStatic travel-companion landing and login experience. All images are served from local assets, and the headline is clipped to the actual landscape photograph. No build step, credentials or API integration is required.\n\nDeploy this directory as the Vercel root directory. Open `/` or `/login-review`. Login, provider sign-in, recovery and contact actions are explicitly labelled local UI demos. They do not create accounts or transmit credentials.\n\nInteractive areas: feature and information panels, saved destinations, itinerary details, language headline preview, password visibility, signup validation, loading and success feedback.\n');
console.log('Prepared static hosted login:',html.length,'HTML characters; three JPEG assets; no app runtime or environment variables required.');
