import { sha256 } from "js-sha256";
import { saveScore } from "@/lib/mongodb2048";

export async function dataSave(playerName: string, score: number, size: number, gameRecordStr: string) {
  try {
    return await saveScore({ playerName, score, size, gameRecordStr })
  } catch (error) {
    console.error('保存分数失败:', error);
    return false;
  }
}

export function getTimesalt() {
  const timesaltkey = process.env.GAME_2048_TIMESALT_KEY || "";
  const timesalt = Math.floor(new Date().getTime() / 300000);
  return sha256(timesaltkey + sha256(String(timesalt)));
}

export function getSecretKey() {
  const submitkey = getSubmitKey();
  const salt1 = sha256(String(Math.floor(new Date().getTime() / 300000)));
  const salt2 = getTimesalt();
  const secretKey = sha256(submitkey + salt1 + salt2);

  return secretKey;
}

export function getSubmitKey() {
    const submitkey =
    process.env.GAME_2048_SUBMIT_KEY ||
    process.env.NEXT_PUBLIC_GAME_2048_SUBMIT_KEY ||
    "";
    return submitkey;
}