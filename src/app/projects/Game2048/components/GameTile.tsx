"use client";

interface TileProps {
  value: number;
}

export default function Tile({ value }: TileProps) {
  // 获取格子背景色
  const getTileColor = (value: number) => {
    switch (value) {
      case 0:
        return "bg-gray-200 animate-pulse";
      // 基础色系
      case 2:
        return "bg-blue-100";
      case 4:
        return "bg-blue-200";
      case 8:
        return "bg-blue-400";
      case 16:
        return "bg-blue-800";
      // 中级数值 (新增过渡色)
      case 32:
        return "bg-purple-400";
      case 64:
        return "bg-purple-500";
      case 128:
        return "bg-orange-400";
      case 256:
        return "bg-red-400";
      case 512:
        return "bg-pink-500";
      // 高级数值 (高饱和色)
      case 1024:
        return "bg-[#00C853] text-white"; // 荧光绿
      case 2048:
        return "bg-[#FF6D00] text-white"; // 橙红色
      case 4096:
        return "bg-[#6200EA] text-white"; // 深紫色
      case 8192:
        return "bg-[#FFD600] text-white"; // 亮黄色
      // 超大数值 (金属渐变)
      case 16384:
        return "bg-gradient-to-br from-[#FFEB3B] to-[#FF9800] text-white"; // 黄金
      case 32768:
        return "bg-gradient-to-br from-[#E0E0E0] to-[#9E9E9E] text-white"; // 白银
      case 65536:
        return "bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] text-white animate-pulse"; // 熔岩橙
      // 百万级数值 (霓虹特效)
      case 131072:
        return "bg-gradient-to-br from-[#00F2FE] to-[#4FACFE] text-white animate-pulse"; // 霓虹蓝
      case 262144:
        return "bg-gradient-to-br from-[#FF61D2] to-[#FE9090] text-white animate-pulse"; // 霓虹粉
      case 524288:
        return "bg-gradient-to-br from-[#76FF03] to-[#C6FF00] text-white animate-pulse shadow-glow"; // 霓虹绿
      // 终极特效 (动态渐变)
      default:
        return value >= 1048576
          ? "bg-gradient-to-br from-[#FF1744] via-[#D500F9] to-[#3D5AFE] animate-gradient-x text-white animate-pulse shadow-glow" // 流动三色
          : "bg-[#212121] text-white";
    }
  };

  // 获取文本颜色
  const getTextColor = (value: number) => {
    if (value === 0) return "text-transparent";
    if (value <= 4) return "text-blue-900";
    if (value <= 512) return "text-white";
    return "";
  };

  // 获取文本大小，根据数字长度和屏幕尺寸调整大小
  const getTextSize = (value: number) => {
    if (value === 0) return "text-base sm:text-lg md:text-xl";
    if (value < 100) return "text-base sm:text-lg md:text-xl";
    if (value < 1000) return "text-sm sm:text-base md:text-lg";
    return "text-xs sm:text-sm md:text-base";
  };

  // 添加阴影和凸起效果
  const getShadow = (value: number) => {
    if (value === 0) return "shadow-none";
    if (value <= 4) return "shadow-sm";
    if (value <= 16) return "shadow";
    if (value <= 64) return "shadow-md";
    if (value <= 256) return "shadow-lg";
    return "shadow-xl";
  };

  // 添加动画效果
  const getAnimation = (value: number) => {
    if (value === 0) return "";
    return "animate-tile-appear";
  };

  return (
    <div
      className={`
        aspect-square rounded-md flex items-center justify-center font-bold
        ${getTileColor(value)}
        ${getTextColor(value)}
        ${getTextSize(value)}
        ${getShadow(value)}
        ${getAnimation(value)}
        transition-all duration-200
        hover:shadow-lg active:shadow-md
        border border-gray-300
      `}
    >
      {value !== 0 && (
        <p className="absolute">
          {value > 131072 && !Number.isNaN(value) && Number.isFinite(value)
            ? `2^${Math.log2(value)}`
            : value ?? "NaN"}
        </p>
      )}
    </div>
  );
}
