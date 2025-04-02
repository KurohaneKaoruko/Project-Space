import { NextResponse } from "next/server";
import { insertScore } from "@/lib/mongodb2048";
import crypto from 'crypto';

async function dbSave(playerName: string, score: number, timestamp: number, size: number) {
  const date = new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  try {
    return await insertScore({ playerName, score, date, size })
  } catch (error) {
    console.error('保存分数失败:', error);
    return false;
  }
}

function decryptData(encryptedData: string) {
  try {
    // 获取密钥
    const secretKey = process.env.NEXT_PUBLIC_GAME_2048_SUBMIT_KEY;
    if (!secretKey || secretKey.length < 32) {
      throw new Error('Decryption key must be at least 32 characters long');
    }

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, checksum } = body;
    console.log('Received request with body size:', JSON.stringify(body).length);
    
    if (!data || !checksum) {
      return NextResponse.json(
        { success: false, message: '无效的请求数据' },
        { status: 400 }
      );
    }
    
    // 解密数据
    const decodedData = decryptData(data);
    
    if (!decodedData) {
      return NextResponse.json(
        { success: false, message: '数据解密失败' },
        { status: 400 }
      );
    }
    
    // 验证校验和
    const expectedChecksum = Buffer.from(String(decodedData.score) + decodedData.timestamp).toString('base64');
    if (checksum !== expectedChecksum) {
      console.warn('Checksum mismatch:', { received: checksum, expected: expectedChecksum });
      return NextResponse.json(
        { success: false, message: '数据校验失败' },
        { status: 400 }
      );
    }
    
    // 获取解密后的数据
    const { playerName, score, timestamp, gameSize } = decodedData;
    
    // 保存到数据库
    const saveResult = await dbSave(playerName, score, timestamp, gameSize);
    
    return NextResponse.json({
      success: true,
      message: saveResult ? '分数已成功提交' : '分数已接收，但保存时出错'
    });
    
  } catch (error) {
    console.error('处理提交分数时出错:', error);
    return NextResponse.json(
      { success: false, message: '服务器处理请求时出错' },
      { status: 500 }
    );
  }
}
