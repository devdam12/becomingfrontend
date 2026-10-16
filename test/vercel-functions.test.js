const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {once} = require('node:events');

test('compiled Vercel handlers load and serve protected admin routes', async () => {
  const login = require('../dist/vercel/api/admin-login.js').default;
  const admin = require('../dist/vercel/api/admin.js').default;
  const proxy = require('../dist/vercel/api/gateway.js').default;
  assert.equal(typeof proxy, 'function');
  const backend = createServer(async (req, res) => {
    if(req.method === 'POST') {
      assert.equal(req.url, '/api/admin/login?returnTo=admin');
      assert.equal(req.headers['x-conference-proxy'], 'x'.repeat(32));
      assert.equal(req.headers.origin, 'https://frontend.example');
      let body = '';
      for await (const chunk of req) body += chunk;
      assert.deepEqual(JSON.parse(body), {email: 'admin@example.com', password: 'test-password'});
      res.writeHead(200, {'Content-Type': 'application/json', 'Set-Cookie': 'conference_session=valid; HttpOnly; Path=/'});
      res.end('{"ok":true}');
      return;
    }
    assert.equal(req.url, '/api/admin/session');
    assert.equal(req.headers['x-conference-proxy'], 'x'.repeat(32));
    res.writeHead(req.headers.cookie === 'conference_session=valid' ? 200 : 401);
    res.end('{}');
  });
  const frontend = createServer((req, res) => {
    const handler = req.url.startsWith('/api/') ? proxy : req.url === '/admin/login' ? login : admin;
    Promise.resolve(handler(req, res)).catch(error => {
      res.writeHead(500);
      res.end(String(error));
    });
  });
  const oldBackend = process.env.BACKEND_URL;
  const oldSecret = process.env.API_PROXY_SECRET;
  try {
    backend.listen(0, '127.0.0.1');
    await once(backend, 'listening');
    process.env.BACKEND_URL = `http://127.0.0.1:${backend.address().port}`;
    process.env.API_PROXY_SECRET = 'x'.repeat(32);
    frontend.listen(0, '127.0.0.1');
    await once(frontend, 'listening');
    const origin = `http://127.0.0.1:${frontend.address().port}`;
    const loginResponse = await fetch(`${origin}/admin/login`);
    assert.equal(loginResponse.status, 200);
    assert.match(await loginResponse.text(), /<html/i);
    const anonymous = await fetch(`${origin}/admin`, {redirect: 'manual'});
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('location'), '/admin/login');
    const expired = await fetch(`${origin}/admin`, {
      redirect: 'manual', headers: {cookie: 'conference_session=expired'}
    });
    assert.equal(expired.status, 302);
    const authenticated = await fetch(`${origin}/admin`, {
      headers: {cookie: 'conference_session=valid'}
    });
    assert.equal(authenticated.status, 200);
    assert.match(await authenticated.text(), /<html/i);
    assert.equal(authenticated.headers.get('cache-control'), 'no-store');
    for (const path of ['/api/admin/login?returnTo=admin', '/api/gateway?__api_path=admin/login&returnTo=admin']) {
      const response = await fetch(origin+path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Origin: 'https://frontend.example'},
        body: JSON.stringify({email: 'admin@example.com', password: 'test-password'})
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {ok: true});
      assert.match(response.headers.get('set-cookie'), /conference_session=valid/);
    }
  } finally {
    frontend.closeAllConnections();
    backend.closeAllConnections();
    await Promise.all([new Promise(resolve => frontend.close(resolve)), new Promise(resolve => backend.close(resolve))]);
    if (oldBackend === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = oldBackend;
    if (oldSecret === undefined) delete process.env.API_PROXY_SECRET;
    else process.env.API_PROXY_SECRET = oldSecret;
  }
});
