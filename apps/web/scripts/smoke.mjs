import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const envText = readFileSync(path.join(root, '.env'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] ??= m[2].trim();
}

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error('AUTH_SECRET missing');

const user = {
  id: 'b96fb655-977b-4021-9520-8bb01cf08eb7',
  username: 'admin',
  displayName: 'Administrator',
  role: 'admin',
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const body = Buffer.from(JSON.stringify(user)).toString('base64url');
const sig = createHmac('sha256', secret).update(body).digest('base64url');
const cookie = `metrookeh_session=${body}.${sig}`;

async function check(pathName, needle) {
  const res = await fetch(`http://localhost:3000${pathName}`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  const html = await res.text();
  console.log(pathName, res.status, needle ? html.includes(needle) : res.headers.get('location'));
}

await check('/', 'خلاصه وضعیت');
await check('/kootajs', 'کوتاژها');
await check('/reviews', 'صف بررسی');
await check('/imports', 'تاریخچه ورود');

const unauth = await fetch('http://localhost:3000/', { redirect: 'manual' });
console.log('UNAUTH', unauth.status, unauth.headers.get('location'));
