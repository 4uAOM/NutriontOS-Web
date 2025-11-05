// encryption.js - Web Crypto helpers for E2E
const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function fromBase64(str){ const bin = atob(str); const arr = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i); return arr.buffer; }
function randBytes(len){ const b = new Uint8Array(len); crypto.getRandomValues(b); return b; }

async function deriveKey(password, magicPhrase, salt, iterations=200000){
  const combined = password + '::' + magicPhrase;
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(combined), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt","decrypt"]
  );
  return key;
}

async function encryptObject(obj, password, magicPhrase){
  const salt = randBytes(16);
  const iv = randBytes(12);
  const key = await deriveKey(password, magicPhrase, salt);
  const plaintext = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
  return {
    ciphertext: toBase64(ct),
    iv: toBase64(iv),
    salt: toBase64(salt),
    kdf: { algo: "PBKDF2", iterations: 200000, hash: "SHA-256" }
  };
}

async function decryptObject(encPayload, password, magicPhrase){
  const salt = fromBase64(encPayload.salt);
  const iv = fromBase64(encPayload.iv);
  const ct = fromBase64(encPayload.ciphertext);
  const key = await deriveKey(password, magicPhrase, salt);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv: iv }, key, ct);
  } catch(e) {
    throw new Error('Decrypt failed: wrong password/magic or corrupted data');
  }
  const json = dec.decode(pt);
  return JSON.parse(json);
}

function buf2hex(buffer){ return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function sha256_hex_str(s){
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return buf2hex(hash);
}
