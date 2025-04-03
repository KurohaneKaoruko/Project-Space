import crypto from 'crypto';
import { getSecretKey } from "../utils";

export function decryptData(encryptedData: string) {
    try {
      // 获取密钥
      const secretKey = getSecretKey();
  
      // 解码Base64，创建缓冲区
      const binaryStr = Buffer.from(encryptedData, 'base64');
      
      // 处理Buffer转换为Uint8Array
      const combined = new Uint8Array(binaryStr);
  
      // 提取IV (前16字节)和加密数据
      const iv = combined.slice(0, 16);
      const encryptedBytes = combined.slice(16);
  
      // 确保密钥长度为32字节
      const key = Buffer.from(secretKey.slice(0, 32).padEnd(32, '0'));
  
      // 创建解密器
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        key,
        Buffer.from(iv)
      );
  
      try {
        // 解密数据 - 使用Buffer包装Uint8Array
        let decrypted = decipher.update(Buffer.from(encryptedBytes));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
  
        // 解析JSON并返回
        const decryptedText = decrypted.toString('utf8');
        return JSON.parse(decryptedText);
      } catch (cryptoError) {
        console.error('Decryption operation failed:', cryptoError);
        return null;
      }
    } catch (error) {
      console.error('Decryption process failed:', error);
      return null;
    }
  };