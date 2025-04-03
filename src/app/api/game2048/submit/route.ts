import { NextResponse } from "next/server";
import { recordCheck } from "./recordCheck";
import { decryptData } from "./decryptData";
import { saveScore } from "@/lib/mongodb2048";

async function dataSave(playerName: string, score: number, size: number, gameRecordStr: string) {
  try {
    return await saveScore({ playerName, score, size, gameRecordStr })
  } catch (error) {
    console.error('保存分数失败:', error);
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
    
    // 解密数据
    const decodedData = decryptData(data);
    
    if (!decodedData || !decodedData.playerName || !decodedData.score || !decodedData.timestamp) {
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

    if (decodedData.score % 4 !== 0) {
      return NextResponse.json(
        { success: false, message: '无效的分数' },
        { status: 400 }
      );
    }

    // 解析游戏记录 - 从Base64解码为JSON对象
    let gameRecordStr, gameRecordObj;
    try {
      gameRecordStr = atob(decodedData.gameRecord);
      gameRecordObj = JSON.parse(gameRecordStr);
    } catch (error) {
      console.error('解析游戏记录失败:', error);
      return NextResponse.json(
        { success: false, message: '游戏记录解析失败' },
        { status: 400 }
      );
    }

    // 验证游戏记录
    if (!recordCheck(decodedData.score, gameRecordObj)) {
      return NextResponse.json(
        { success: false, message: '无效的分数' },
        { status: 400 }
      );
    }
    
    // 获取解密后的数据
    const { playerName, score, gameSize } = decodedData;
    
    // 保存到数据库
    const saveResult = await dataSave(playerName, score, gameSize, gameRecordStr);
    
    return NextResponse.json({
      success: true,
      message: saveResult ? '分数已成功提交' : '分数已接收，但保存到数据库时出错'
    });
    
  } catch (error) {
    console.error('处理提交分数时出错:', error);
    return NextResponse.json(
      { success: false, message: '服务器处理请求时出错' },
      { status: 500 }
    );
  }
}
