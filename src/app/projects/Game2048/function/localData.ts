const STORAGE_KEYS = {
    SIZE: 'game2048_size',
    HIGH_SCORE: (size: number) => `game2048_high_score_${size}`
};

// 确保大小是有效的数字
export const getValidSize = (size: number): number => {
    return !isNaN(size) && size >= 4 && size <= 7 ? size : 4;
};

// 获取本地存储的游戏网格大小
export function getGameSize(): number {
    const savedSize = localStorage.getItem(STORAGE_KEYS.SIZE);
    const size = getValidSize(savedSize ? parseInt(savedSize) : 4);
    return size;
}

export function saveGameSize(size: number) {
    localStorage.setItem(STORAGE_KEYS.SIZE, size.toString());
}

// 获取本地存储的历史最高分
export function getHighScore(size: number): number {
    const savedHighScore = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE(size)) ?? 0;
    const highScore = savedHighScore === 'Infinity' ? Infinity : savedHighScore ? parseInt(savedHighScore) : 0;
    return highScore;
}

export function saveHighScore(size: number, score: number) {
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORE(size), score.toString());
}