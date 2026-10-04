import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/auth/login/route';
const userId = '11111111-1111-4111-8111-111111111111';
function request(identifier: string, password = 'test-password-long') { return new Request('http://test/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({identifier,password}) }); }
test('password login uses Supabase and keeps username resolution private', async t => {
  const fetchBefore = globalThis.fetch; const envBefore = {url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,server:process.env.SUPABASE_SERVER_KEY};
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://accounts.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key'; process.env.SUPABASE_SERVER_KEY = 'private-test-key';
  let missingUser = false; let wrongPassword = false; let lookupCalls = 0; let passwordEmail = '';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/rest/v1/profiles')) { lookupCalls++; assert.ok(url.includes('username=eq.benjamin_45')); return Response.json(missingUser ? null : {user_id:userId}); }
    if (url.includes(`/auth/v1/admin/users/${userId}`)) { assert.ok(new Headers(init?.headers).get('apikey') === 'private-test-key'); return Response.json({user:{id:userId,email:'private@example.test'}}); }
    if (url.includes('/auth/v1/token?grant_type=password')) {
      assert.equal(new Headers(init?.headers).get('apikey'), 'public-test-key'); passwordEmail = JSON.parse(String(init?.body)).email;
      if (wrongPassword) return Response.json({code:'invalid_credentials',msg:'private raw message'}, {status:400});
      return Response.json({access_token:'access-test',refresh_token:'refresh-test',expires_in:3600,token_type:'bearer',user:{id:userId,email:passwordEmail}});
    }
    throw new Error('Unexpected request');
  };
  try {
    await t.test('username login resolves privately and returns only session tokens', async () => {
      const response = await POST(request(' BENJAMIN_45 ')); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
      const body=await response.json(); assert.equal(passwordEmail,'private@example.test'); assert.deepEqual(body,{session:{access_token:'access-test',refresh_token:'refresh-test'}}); assert.ok(!JSON.stringify(body).includes('private@example'));
    });
    await t.test('email sign-in works without privileged configuration', async () => {
      delete process.env.SUPABASE_SERVER_KEY; const before = lookupCalls;
      assert.equal((await POST(request('private@example.test'))).status,200); assert.equal(lookupCalls,before);
      const response=await POST(request('benjamin_45')); assert.equal(response.status,503); assert.match((await response.json()).error,/email instead/);
      process.env.SUPABASE_SERVER_KEY='private-test-key';
    });
    await t.test('unknown usernames and wrong passwords give no email or account details', async () => {
      missingUser=true; // Even an unexpected successful sentinel password grant cannot authenticate an unknown name.
      let response=await POST(request('benjamin_45')); assert.equal(response.status,401); assert.match((await response.json()).error,/incorrect/);
      missingUser=false;wrongPassword=true;response=await POST(request('benjamin_45'));assert.equal(response.status,401);assert.ok(!JSON.stringify(await response.json()).includes('private raw'));
    });
    await t.test('malformed and oversized sign-in inputs are rejected', async () => {
      assert.equal((await POST(request('benjamin_45',''))).status,400);
      assert.equal((await POST(request('a'.repeat(5000)))).status,413);
      assert.equal((await POST(new Request('http://test/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:'{'}))).status,400);
    });
  } finally {
    globalThis.fetch=fetchBefore;
    for(const [name,value] of Object.entries({NEXT_PUBLIC_SUPABASE_URL:envBefore.url,NEXT_PUBLIC_SUPABASE_ANON_KEY:envBefore.key,SUPABASE_SERVER_KEY:envBefore.server})) { if(value===undefined)delete process.env[name];else process.env[name]=value; }
  }
});
