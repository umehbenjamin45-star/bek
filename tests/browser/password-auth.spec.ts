import { test, expect, type Page } from '@playwright/test';
const user = { id:'11111111-1111-4111-8111-111111111111', aud:'authenticated', role:'authenticated', email:'benjamin@example.test', user_metadata:{username:'benjamin_45'} };
function session() { const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`; return {access_token:token,refresh_token:'refresh-fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}; }
async function backend(page: Page) {
  await page.route('https://browser-fixture.supabase.co/**', async route => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({json:user});
    if (url.includes('/rest/v1/rpc/password_accounts_ready')) return route.fulfill({json:true});
    if (url.includes('/rest/v1/profiles')) return route.fulfill({json:{username:'benjamin_45'}});
    if (url.includes('/rest/v1/transcripts')) return route.fulfill({json:[]});
    if (url.includes('/auth/v1/token')) return route.fulfill({json:session()});
    if (url.includes('/auth/v1/recover')) return route.fulfill({json:{}});
    if (url.includes('/auth/v1/signup')) {
      const data=route.request().postDataJSON();expect(data.data.username).toBe('benjamin_45');expect(data.email).toBe(user.email);
      return route.fulfill({json:{user,session:null}});
    }
    return route.fulfill({json:{}});
  });
}
test('registration validates confirmation, normalizes username and explains email verification', async ({page}) => {
  await backend(page);await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await page.getByLabel('Username',{exact:true}).fill('Benjamin_45');await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('a-long-test-password');await page.getByLabel('Confirm password',{exact:true}).fill('another-test-password');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'do not match'})).toBeVisible();
  await page.getByLabel('Confirm password',{exact:true}).fill('a-long-test-password');await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Check your email'})).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
  expect(await page.getByLabel('Password',{exact:true}).getAttribute('autocomplete')).toBe('new-password');
});
test('username password login handles errors, restores a session and shows the stored username', async ({page}) => {
  await backend(page);let first=true;
  await page.route('**/api/auth/login', async route => {
    const body=route.request().postDataJSON();expect(body.identifier).toBe('benjamin_45');expect(body.password).toBe('a-long-test-password');
    if(first){first=false;return route.fulfill({status:401,json:{error:'The username/email or password is incorrect. Please try again.'}});}
    const value=session();return route.fulfill({json:{session:{access_token:value.access_token,refresh_token:value.refresh_token}}});
  });
  await page.goto('/');await page.getByLabel('Username or email').fill('benjamin_45');await page.getByLabel('Password',{exact:true}).fill('a-long-test-password');
  expect(await page.getByLabel('Password',{exact:true}).getAttribute('autocomplete')).toBe('current-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'incorrect'})).toBeVisible();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Make room for your words.'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Make room for your words.'})).toBeVisible();
  await page.getByRole('link',{name:'Settings',exact:true}).click();await expect(page.getByText('benjamin_45',{exact:true})).toBeVisible();
});
test('email recovery follows the PKCE callback and saves a new password', async ({page}) => {
  await backend(page);let resetEmail='';let newPassword='';
  await page.route('https://browser-fixture.supabase.co/auth/v1/recover**', async route => {resetEmail=route.request().postDataJSON().email;expect(route.request().url()).toContain('next%3Dreset');return route.fulfill({json:{}});});
  await page.route('https://browser-fixture.supabase.co/auth/v1/user', async route => {if(route.request().method()==='PUT')newPassword=route.request().postDataJSON().password;return route.fulfill({json:user});});
  await page.goto('/');await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByRole('status').filter({hasText:'If an account exists'})).toBeVisible();expect(resetEmail).toBe(user.email);
  await page.goto('/auth/callback?code=test-code&next=reset');await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();
  await page.getByLabel('New password',{exact:true}).fill('new-long-test-password');await page.getByLabel('Confirm password',{exact:true}).fill('new-long-test-password');
  await page.getByRole('button',{name:'Save new password'}).click();await expect(page.getByRole('heading',{name:'Password updated'})).toBeVisible();expect(newPassword).toBe('new-long-test-password');
});
test('expired account links show a useful error instead of signing in',async({page})=>{
  await backend(page);await page.route('https://browser-fixture.supabase.co/auth/v1/token**',route=>route.fulfill({status:400,json:{error:'invalid_grant',error_description:'Invalid code'}}));
  await page.goto('/auth/callback?code=expired');await expect(page.getByRole('alert').filter({hasText:'expired'})).toBeVisible();
});

test('registration waits for the username migration before creating a Supabase account',async({page})=>{
  await backend(page);let signupCalled=false;
  await page.route('https://browser-fixture.supabase.co/rest/v1/rpc/password_accounts_ready',route=>route.fulfill({status:404,json:{code:'PGRST202'}}));
  await page.route('https://browser-fixture.supabase.co/auth/v1/signup**',route=>{signupCalled=true;return route.fulfill({json:{user}});});
  await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await page.getByLabel('Username',{exact:true}).fill('benjamin_45');await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('a-long-test-password');await page.getByLabel('Confirm password',{exact:true}).fill('a-long-test-password');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'not ready yet'})).toBeVisible();expect(signupCalled).toBe(false);
});
