import { sha256 } from 'js-sha256';

// 安全的Base64编码函数（处理二进制数据）
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const encrypt = async (key: string, str: string) => {
  // 使用TextEncoder处理UTF-8
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(str);

  // 准备加密密钥
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(key.slice(0, 32)),
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  // 生成IV
  const iv = window.crypto.getRandomValues(new Uint8Array(16));

  // 加密
  const encryptedBytes = await window.crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    keyMaterial,
    dataBytes
  );

  // 组合IV和加密数据
  const combined = new Uint8Array(iv.length + encryptedBytes.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBytes), iv.length);

  // 转为Base64
  return arrayBufferToBase64(combined.buffer);
}

export const encryptData = async (data: {
  playerName: string;
  score: number;
  timestamp: number;
  gameSize: number;
}) => {

  
  const submitkey = process.env.NEXT_PUBLIC_GAME_2048_SUBMIT_KEY || '';
  const salt1 = sha256(String(Math.floor(new Date().getTime() / 300000)));
  const salt2 = (await fetch('/api/game2048/sk').then(res => res.json())).message;
  const secretKey = sha256(submitkey + salt1 + salt2);
  
  // 将数据转为JSON字符串
  const jsonStr = JSON.stringify(data);

  return encrypt(secretKey, jsonStr);
};


