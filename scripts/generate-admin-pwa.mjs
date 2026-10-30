// Deterministic brand assets, not generated artwork. Colors come from existing tokens.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const tokens=await readFile('src/styles/tokens.css','utf8');
const color=name=>{const match=tokens.match(new RegExp(`--color-${name}:\\s*(#[a-fA-F0-9]+)`));if(!match)throw Error(`Missing token ${name}`);return match[1];};
const red=color('primary'),cream=color('background'),charcoal=color('text');
const mark=()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${charcoal}"/><path d="M150 370V142h198v60H218v45h108v57H218v66Z" fill="${cream}"/><circle cx="353" cy="346" r="27" fill="${red}"/></svg>`;
await mkdir('public/admin/icons',{recursive:true});
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]])await sharp(Buffer.from(mark(name.startsWith('maskable')))).resize(size,size).png({compressionLevel:9}).toFile(`public/admin/icons/${name}`);
await writeFile('public/admin/icons/mark.svg',mark());
console.log('Admin icons: 192, 512, maskable safe zone and Apple 180 generated from brand tokens.');
