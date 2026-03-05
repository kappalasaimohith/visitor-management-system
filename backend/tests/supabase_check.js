import 'dotenv/config';
import axios from 'axios';
import dns from 'node:dns/promises';
import tls from 'node:tls';
import { URL } from 'node:url';

function arg(name, def = null) {
  const pfx = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(pfx));
  return hit ? hit.slice(pfx.length) : def;
}

function normUrl(u) {
  return (u || '').trim().replace(/\/+$/, '');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function tlsProbe(hostname, timeoutMs) {
  const start = Date.now();
  return await new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, timeout: timeoutMs },
      () => {
        const ms = Date.now() - start;
        socket.end();
        resolve({ ok: true, ms, authorized: socket.authorized, alpnProtocol: socket.alpnProtocol || null });
      }
    );

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, ms: Date.now() - start, error: 'TLS_TIMEOUT' });
    });
    socket.on('error', (e) => {
      resolve({ ok: false, ms: Date.now() - start, error: e.code || e.message });
    });
  });
}

async function httpGet(url, timeoutMs, headers = {}) {
  const start = Date.now();
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      validateStatus: () => true,
      headers,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, error: e.code || e.message, ms: Date.now() - start };
  }
}

async function retry(fn, attempts, backoffMs) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    last = await fn();
    if (last?.ok || last?.status) return last;
    if (i < attempts - 1) await sleep(backoffMs * (i + 1));
  }
  return last;
}

async function main() {
  const SUPABASE_URL = normUrl(process.env.SUPABASE_API_URL);
  const ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

  const timeoutMs = Number(arg('timeout', process.env.SUPABASE_CHECK_TIMEOUT || '15000'));
  const attempts = Number(arg('attempts', process.env.SUPABASE_CHECK_ATTEMPTS || '2'));

  if (!SUPABASE_URL) {
    console.error('[supabase_check] Missing SUPABASE_API_URL');
    process.exitCode = 2;
    return;
  }

  let hostname;
  try {
    hostname = new URL(SUPABASE_URL).hostname;
  } catch {
    console.error('[supabase_check] Invalid SUPABASE_API_URL:', SUPABASE_URL);
    process.exitCode = 2;
    return;
  }

  // 1) DNS
  let dnsOut;
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    dnsOut = { ok: true, addrs: addrs.map(a => ({ address: a.address, family: a.family })) };
  } catch (e) {
    dnsOut = { ok: false, error: e.code || e.message };
  }

  // 2) TLS handshake to :443 (distinguish “DNS ok but blocked”)
  const tlsOut = dnsOut.ok
    ? await retry(() => tlsProbe(hostname, timeoutMs), attempts, 300)
    : { ok: false, skipped: true, reason: 'DNS failed' };

  // 3) HTTP health checks
  const authHealthUrl = `${SUPABASE_URL}/auth/v1/health`;
  const restUrl = `${SUPABASE_URL}/rest/v1/`;

  const auth = await retry(() => httpGet(authHealthUrl, timeoutMs), attempts, 300);

  const rest = ANON_KEY
    ? await retry(
        () =>
          httpGet(restUrl, timeoutMs, {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          }),
        attempts,
        300
      )
    : { skipped: true, reason: 'SUPABASE_ANON_KEY not set' };

  // Determine reachability: any HTTP response (status) means “not down”, just maybe auth/config
  const reachable = Boolean(auth?.status) || Boolean(rest?.status);
  const result = reachable ? 'UP_REACHABLE' : 'DOWN_OR_UNREACHABLE';

  // Classification hint
  let hint = null;
  if (!dnsOut.ok) hint = 'DNS_FAIL (check DNS/VPN/proxy/firewall)';
  else if (!tlsOut.ok) hint = 'TLS_FAIL (likely network block to :443, VPN/proxy/firewall)';
  else if (!reachable) hint = 'HTTP_FAIL (routing/proxy issue or upstream outage)';

  console.log('[supabase_check]', {
    supabaseUrl: SUPABASE_URL,
    hostname,
    timeoutMs,
    attempts,
    dns: dnsOut.ok ? { ok: true, addrs: dnsOut.addrs } : { ok: false, error: dnsOut.error },
    tls: tlsOut?.ok ? { ok: true, ms: tlsOut.ms } : tlsOut,
    auth: auth?.status ? { status: auth.status, ms: auth.ms } : { ok: false, error: auth.error, ms: auth.ms },
    rest: rest?.status ? { status: rest.status, ms: rest.ms } : rest,
    result,
    hint,
  });

  if (!reachable) process.exitCode = 1;
}

main();
