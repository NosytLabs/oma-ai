const { SiweMessage } = require('siwe');
const { privateKeyToAccount } = require('viem/accounts');

(async () => {
  const TEST_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const domain = 'oma-ai.com';

  // 1. Fetch nonce
  const nonceResp = await fetch('http://localhost:3401/api/auth/siwe/nonce', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ walletAddress: TEST_WALLET, chainId: 8453 }),
  });
  const { nonce } = await nonceResp.json();
  console.log('Nonce:', nonce);

  // 2. Build SIWE message
  const message = new SiweMessage({
    domain,
    address: TEST_WALLET,
    statement: 'Sign in to OMA AI',
    uri: `https://${domain}`,
    version: '1',
    chainId: 8453,
    nonce,
    issuedAt: new Date().toISOString(),
  });
  const msgText = message.toMessage();
  console.log('Message:', msgText.slice(0, 100) + '...');

  // 3. Sign
  const account = privateKeyToAccount(PRIVATE_KEY);
  const signature = await account.signMessage({ message: msgText });
  console.log('Signature:', signature.slice(0, 30) + '...');

  // 4. Verify
  const verifyResp = await fetch('http://localhost:3401/api/auth/siwe/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: msgText,
      signature,
      walletAddress: TEST_WALLET,
      chainId: 8453,
    }),
  });
  const result = await verifyResp.json();
  console.log('Verify status:', verifyResp.status);
  console.log('Verify result:', JSON.stringify(result).slice(0, 250));

  if (verifyResp.status === 200) {
    // 5. Confirm session
    const cookieHeader = verifyResp.headers.get('set-cookie');
    console.log('Set-Cookie:', cookieHeader?.slice(0, 100));
    const cookie = cookieHeader?.split(';')[0];
    const sessionResp = await fetch('http://localhost:3401/api/auth/get-session', {
      headers: { cookie: cookie ?? '' },
    });
    const session = await sessionResp.json();
    console.log('Session user:', JSON.stringify(session.user).slice(0, 200));
  }
})().catch(console.error);
