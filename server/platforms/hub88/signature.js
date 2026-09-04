import { createSign, createVerify, generateKeyPairSync } from 'crypto';

// RSA-SHA256 over the exact request body bytes, BASE64-encoded, carried in the
// X-Hub88-Signature header — see HUB88_INTEGRATION.md § Échange de clés RSA.
//   - Wallet API (outgoing, us → Hub88): we sign with our private key, Hub88
//     verifies with our public key.
//   - Games API (incoming, Hub88 → us): Hub88 signs with their private key, we
//     verify with their public key.
// Sign/verify always take the *exact bytes* that go over the wire (a Buffer or
// UTF-8 string) — never a re-stringified object, since key order/whitespace in
// a second JSON.stringify pass isn't guaranteed to match the first.

export function signBody(bodyBytes, privateKeyPem) {
  const signer = createSign('RSA-SHA256');
  signer.update(bodyBytes);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

export function verifyBody(bodyBytes, signatureBase64, publicKeyPem) {
  if (typeof signatureBase64 !== 'string' || !signatureBase64) return false;
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(bodyBytes);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    // Malformed base64, wrong key format, etc. — never throw on attacker input.
    return false;
  }
}

// Local-dev convenience only: generates an ephemeral 2048-bit RSA keypair in
// memory, exactly like TOKEN_SECRET in server/index.js. Never used for real
// Hub88 traffic — the real keypair is generated once with `openssl genrsa` (see
// HUB88_INTEGRATION.md) and its PEM contents loaded from HUB88_PRIVATE_KEY /
// HUB88_PUBLIC_KEY at boot. This exists so gamesApi.js/hub88Ledger.js can be
// exercised (and their own test scripts written) before real keys exist.
export function generateDevKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}
