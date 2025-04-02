import { NextResponse } from "next/server";
import { insertScore } from "@/lib/mongodb2048";

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
    return false;
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, checksum } = body;
    
    if (!data || !checksum) {
      return NextResponse.json(
        { success: false, message: '无效的请求数据' },
        { status: 400 }
      );
    }
    
    // 解密函数
    const decryptData = (encryptedData: string) => {
      try {
        // Base64解码
        const decodedString = atob(encryptedData);
        // 分离数据和密钥标记
        const separatorIndex = decodedString.lastIndexOf('|');
        if (separatorIndex === -1) throw new Error('数据格式错误');
        
        const dataStr = decodedString.substring(0, separatorIndex);
        const keySignature = decodedString.substring(separatorIndex + 1);
        
        // 验证密钥特征码
        const secretKey = process.env.NEXT_PUBLIC_GAME_2048_SUBMIT_KEY;
        if (keySignature !== secretKey) {
          throw new Error('密钥验证失败');
        }
        
        // 解析JSON数据
        return JSON.parse(dataStr);
      } catch (error) {
        return null;
      }
    };
    
    // 解密数据
    const decodedData = decryptData(data);
    
    if (!decodedData) {
      return NextResponse.json(
        { success: false, message: '数据解密失败' },
        { status: 400 }
      );
    }
    
    // 验证校验和
    const expectedChecksum = btoa(String(decodedData.score) + decodedData.timestamp);
    if (checksum !== expectedChecksum) {
      return NextResponse.json(
        { success: false, message: '数据校验失败' },
        { status: 400 }
      );
    }
    
    // 获取解密后的数据
    const { playerName, score, timestamp, gameSize } = decodedData;
    
    await dbSave(playerName, score, timestamp, gameSize);
    
    return NextResponse.json({
        success: true,
        message: '分数已成功提交'
      }, { status: 200 }
    );
    
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '服务器处理请求时出错' },
      { status: 500 }
    );
  }
}
