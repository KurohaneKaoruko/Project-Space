import { NextResponse } from "next/server";
import { getTimesalt } from "../utils";


// 获取时间戳盐值
export async function GET() {
    return NextResponse.json({ message: getTimesalt() });
}
