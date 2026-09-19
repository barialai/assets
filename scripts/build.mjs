import fs from 'node:fs/promises';
// An explicit allow-list keeps SQL, tests, .env and private JSON files out of
// the public deployment. Never copy the entire repository into public/.
await fs.rm('public',{recursive:true,force:true});await fs.mkdir('public');
for(const name of ['index.html','app.js','styles.css','logo.svg','tickmark.png','manifest.webmanifest','sw.js'])await fs.copyFile(name,'public/'+name);
await fs.cp('icons','public/icons',{recursive:true});
console.log('Built public app shell. No private records or environment files included.');
