const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||'login-offline.html','utf8');const errors=[];let requests=0;
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'file:///C:/preview/login-offline.html',virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.fetch=()=>{requests++;throw Error('Unexpected network')};w.XMLHttpRequest=function(){requests++;throw Error('Unexpected network')};w.WebSocket=function(){requests++;throw Error('Unexpected network')}}});
const d=dom.window.document;const assert=(v,m)=>{if(!v)throw Error(m)};const click=s=>{assert(d.querySelector(s),'Missing '+s);d.querySelector(s).click()};const submit=s=>d.querySelector(s).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
assert(d.querySelector('h1').textContent.includes('Travel anywhere.'),'Travel headline');assert(d.querySelector('#email'),'Login rendered');
click('[data-panel="help"]');assert(!d.querySelector('#modal').hidden,'Help opens');d.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(d.querySelector('#modal').hidden,'Escape closes');
click('[data-save="greece"]');assert(d.querySelector('#saved-count').textContent==='1','Saved count');assert(d.querySelector('[data-save="greece"]').getAttribute('aria-pressed')==='true','Save state');click('[data-panel="saved"]');assert(d.querySelector('#modal').textContent.includes('Santorini'),'Saved places list');click('#close-dialog');
click('[data-destination="greece"]');assert(d.querySelector('#modal').textContent.includes('Day 1'),'Destination detail');click('[data-dialog-save="greece"]');assert(d.querySelector('#saved-count').textContent==='0','Remove saved destination');click('#close-dialog');
for(const name of ['about','plan','context','discover','trip']){click('[data-panel="'+name+'"]');assert(!d.querySelector('#modal').hidden,name+' panel');click('#close-dialog')}
click('#language-toggle');assert(!d.querySelector('#language-menu').hidden,'Language opens');click('[data-language="HI"]');assert(d.querySelector('h1').textContent.includes('सफ़र'),'Language preview');click('#language-toggle');click('[data-language="EN"]');
click('#show-password');assert(d.querySelector('#password').type==='text','Password reveal');click('#show-password');
click('[data-mode="signup"]');assert(d.querySelector('#password').minLength===8,'Signup validation');click('[data-mode="login"]');
click('[data-provider="Google"]');click('[data-confirm-provider="Google"]');assert(d.querySelector('#form-panel').textContent.includes('Google sign-in preview completed'),'Provider demo');click('#back-login');
d.querySelector('#email').value='sample@example.test';d.querySelector('#password').value='sample-only';submit('#auth-form');assert(d.querySelector('#submit-auth').disabled,'Loading feedback');await new Promise(r=>setTimeout(r,720));assert(d.querySelector('.demo-success'),'Login success');click('#back-login');assert(d.querySelector('#password').value==='','No password retained');
click('[data-mode="reset"]');d.querySelector('#email').value='sample@example.test';submit('#auth-form');await new Promise(r=>setTimeout(r,720));assert(d.querySelector('#form-panel').textContent.includes('No email was sent'),'Recovery demo');click('#back-login');
click('[data-panel="contact"]');d.querySelector('#contact-email').value='sample@example.test';d.querySelector('#contact-message').value='A sample idea';submit('#contact-form');assert(d.querySelector('#modal').textContent.includes('not transmitted'),'Offline contact demo');click('#close-dialog');
assert(errors.length===0,errors.join('; '));assert(requests===0,'No network');assert(!html.includes('__HERO__'),'Hero embedded');assert(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html),'No remote assets');assert(html.includes("connect-src 'none'"),'Network blocked');
console.log('PASS: 15 interaction groups: navigation, dialogs, keyboard dismiss, saved places, trip details, language, password, signup, provider preview, sign-in loading/success, clearing, recovery, contact, embedded assets, zero API calls.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});

