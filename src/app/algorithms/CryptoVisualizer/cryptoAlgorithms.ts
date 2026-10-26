// 加密算法可视化：每个算法把 加密/解密 过程编译为一串步骤（CryptoStep），
// 页面只负责按步骤播放与渲染，密码学逻辑全部在此模块内完成并可独立测试。

// ---------- 通用类型 ----------

export type CryptoVisual =
  | {
      kind: 'letters';
      headers: [string, string, string];
      rows: Array<{ cells: [string, string, string]; status: 'done' | 'active' }>;
    }
  | { kind: 'zigzag'; rails: (string | null)[][]; show: 'chars' | 'indices'; indices?: number[][] }
  | { kind: 'bits'; done: Array<{ label: string; hex: string }>; current: { p: number; k: number } | null }
  | { kind: 'matrix'; cells: string[][]; changed?: Array<[number, number]>; keyHex?: string }
  | { kind: 'numbers'; items: Array<{ label: string; value: string; note?: string; color?: string; muted?: boolean }> };

export interface CryptoStep {
  title: string;
  detail: string;
  visual: CryptoVisual;
}

export interface CryptoRun {
  steps: CryptoStep[];
  result: string;
  resultLabel: string;
}

export type CryptoMode = 'encrypt' | 'decrypt';

export interface RunParams {
  input: string;
  key: string;
  seed: number;
  mode: CryptoMode;
  hexInput?: boolean;
  hexKey?: boolean;
}

export interface CryptoAlgoMeta {
  id: string;
  name: string;
  en: string;
  group: string;
  type: 'cipher' | 'exchange';
  inputLabel: string;
  inputDefault: string;
  inputMax: number;
  keyKind: 'shift' | 'keyword' | 'rails' | 'key' | 'none';
  keyLabel?: string;
  keyDefault?: string;
  hexToggle?: boolean;
  idea: string;
  security: string;
  run: (params: RunParams) => CryptoRun;
}

export class CryptoError extends Error {}

// ---------- 数学辅助 ----------

export function modpow(base: number, exp: number, mod: number): number {
  if (mod === 1) return 0;
  let r = 1;
  base %= mod;
  for (; exp > 0; exp = Math.floor(exp / 2)) {
    if (exp & 1) r = (r * base) % mod;
    base = (base * base) % mod;
  }
  return r;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function modInverse(e: number, phi: number): number {
  // 扩展欧几里得：求 e 关于 phi 的乘法逆元
  let [a, b] = [e % phi, phi];
  let [x0, x1] = [1, 0];
  while (b !== 0) {
    const q = Math.floor(a / b);
    [a, b] = [b, a - q * b];
    [x0, x1] = [x1, x0 - q * x1];
  }
  if (a !== 1) throw new CryptoError('模逆不存在');
  return ((x0 % phi) + phi) % phi;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) throw new CryptoError('HEX 字符串长度必须为偶数');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function utf8Bytes(s: string): Uint8Array {
  return encoder.encode(s);
}

function printableByte(b: number): string {
  return b >= 0x21 && b <= 0x7e ? String.fromCharCode(b) : '·';
}

function bitsOf(byte: number): number[] {
  return Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1);
}

// ---------- AES-128 ----------

// GF(2^8) 乘法（模 x^8 + x^4 + x^3 + x + 1）
function gfMul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function gfPow(a: number, b: number): number {
  let r = 1;
  while (b) {
    if (b & 1) r = gfMul(r, a);
    a = gfMul(a, a);
    b >>= 1;
  }
  return r;
}

const rotl8 = (x: number, s: number) => ((x << s) | (x >>> (8 - s))) & 0xff;

// 由 GF(2^8) 乘法逆元 + 仿射变换生成 S 盒
function buildSbox(): Uint8Array {
  const box = new Uint8Array(256);
  for (let x = 0; x < 256; x++) {
    const inv = x === 0 ? 0 : gfPow(x, 254);
    box[x] = inv ^ rotl8(inv, 1) ^ rotl8(inv, 2) ^ rotl8(inv, 3) ^ rotl8(inv, 4) ^ 0x63;
  }
  return box;
}
const SBOX = buildSbox();
const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function keyExpansion(key: Uint8Array): Uint8Array[] {
  const w = new Uint8Array(176);
  w.set(key);
  for (let i = 4; i < 44; i++) {
    const t = [w[4 * (i - 1)], w[4 * (i - 1) + 1], w[4 * (i - 1) + 2], w[4 * (i - 1) + 3]];
    if (i % 4 === 0) {
      const head = t.shift()!;
      t.push(head);
      for (let k = 0; k < 4; k++) t[k] = SBOX[t[k]];
      t[0] ^= RCON[i / 4 - 1];
    }
    for (let k = 0; k < 4; k++) w[4 * i + k] = w[4 * (i - 4) + k] ^ t[k];
  }
  return Array.from({ length: 11 }, (_, r) => w.slice(16 * r, 16 * r + 16));
}

function addRoundKey(s: Uint8Array, rk: Uint8Array): void {
  for (let i = 0; i < 16; i++) s[i] ^= rk[i];
}
function subBytes(s: Uint8Array, box: Uint8Array): void {
  for (let i = 0; i < 16; i++) s[i] = box[s[i]];
}
// 状态按 FIPS-197 列主序存放：字节 i 位于 (行 = i%4, 列 = i/4)
function shiftRows(s: Uint8Array, inv: boolean): void {
  const out = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[4 * c + r] = s[4 * ((c + (inv ? 4 - r : r)) % 4) + r];
    }
  }
  s.set(out);
}
function mixColumns(s: Uint8Array, inv: boolean): void {
  for (let c = 0; c < 4; c++) {
    const o = 4 * c;
    const a0 = s[o];
    const a1 = s[o + 1];
    const a2 = s[o + 2];
    const a3 = s[o + 3];
    if (!inv) {
      s[o] = gfMul(a0, 2) ^ gfMul(a1, 3) ^ a2 ^ a3;
      s[o + 1] = a0 ^ gfMul(a1, 2) ^ gfMul(a2, 3) ^ a3;
      s[o + 2] = a0 ^ a1 ^ gfMul(a2, 2) ^ gfMul(a3, 3);
      s[o + 3] = gfMul(a0, 3) ^ a1 ^ a2 ^ gfMul(a3, 2);
    } else {
      s[o] = gfMul(a0, 14) ^ gfMul(a1, 11) ^ gfMul(a2, 13) ^ gfMul(a3, 9);
      s[o + 1] = gfMul(a0, 9) ^ gfMul(a1, 14) ^ gfMul(a2, 11) ^ gfMul(a3, 13);
      s[o + 2] = gfMul(a0, 13) ^ gfMul(a1, 9) ^ gfMul(a2, 14) ^ gfMul(a3, 11);
      s[o + 3] = gfMul(a0, 11) ^ gfMul(a1, 13) ^ gfMul(a2, 9) ^ gfMul(a3, 14);
    }
  }
}

function matrixOf(s: Uint8Array): string[][] {
  // 显示为 4 行 4 列（行 = r，列 = c）
  return Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => s[4 * c + r].toString(16).padStart(2, '0')),
  );
}

function diffCells(prev: Uint8Array, cur: Uint8Array): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    if (prev[i] !== cur[i]) cells.push([i % 4, Math.floor(i / 4)]);
  }
  return cells;
}

function aesRun(params: RunParams): CryptoRun {
  const { mode } = params;
  const inv = mode === 'decrypt';

  let inputBytes: Uint8Array;
  if (params.hexInput) {
    inputBytes = hexToBytes(params.input);
  } else {
    inputBytes = utf8Bytes(params.input);
  }
  if (inputBytes.length === 0) throw new CryptoError('请输入内容');
  if (inputBytes.length > 16) inputBytes = inputBytes.slice(0, 16);
  const block = new Uint8Array(16);
  block.set(inputBytes);

  let keyBytes: Uint8Array;
  if (params.hexKey) {
    keyBytes = hexToBytes(params.key);
  } else {
    keyBytes = utf8Bytes(params.key);
  }
  const key16 = new Uint8Array(16);
  key16.set(keyBytes.slice(0, 16));

  const roundKeys = keyExpansion(key16);
  const steps: CryptoStep[] = [];
  const s = new Uint8Array(block);
  const keyHex = (r: number) => bytesToHex(roundKeys[r]);

  steps.push({
    title: inv ? '输入密文分组' : '输入明文分组',
    detail: '16 字节一个分组（不足补 0x00），按 FIPS-197 列主序排成 4×4 状态矩阵。',
    visual: { kind: 'matrix', cells: matrixOf(s) },
  });

  const applyOp = (op: () => void, title: string, detail: string, keyRound?: number) => {
    const prev = s.slice();
    op();
    steps.push({
      title,
      detail,
      visual: {
        kind: 'matrix',
        cells: matrixOf(s),
        changed: diffCells(prev, s),
        keyHex: keyRound !== undefined ? keyHex(keyRound) : undefined,
      },
    });
  };

  if (!inv) {
    applyOp(() => addRoundKey(s, roundKeys[0]), '初始 AddRoundKey', '状态与第 0 轮圆密钥逐字节异或。', 0);
    for (let r = 1; r <= 9; r++) {
      applyOp(() => subBytes(s, SBOX), `第 ${r} 轮 · SubBytes`, '按 S 盒逐字节替换，提供非线性（混淆）。');
      applyOp(() => shiftRows(s, false), `第 ${r} 轮 · ShiftRows`, '第 r 行循环左移 r 字节，让列间数据充分扩散。');
      applyOp(() => mixColumns(s, false), `第 ${r} 轮 · MixColumns`, '每列做 GF(2^8) 上的矩阵乘法，实现列内扩散。');
      applyOp(() => addRoundKey(s, roundKeys[r]), `第 ${r} 轮 · AddRoundKey`, '与本轮圆密钥异或，把密钥注入状态。', r);
    }
    applyOp(() => subBytes(s, SBOX), '第 10 轮 · SubBytes', '最后一轮不再做 MixColumns。');
    applyOp(() => shiftRows(s, false), '第 10 轮 · ShiftRows', '行移位与上各轮相同。');
    applyOp(() => addRoundKey(s, roundKeys[10]), '第 10 轮 · AddRoundKey', '与第 10 轮圆密钥异或后即得到密文。', 10);
  } else {
    applyOp(() => addRoundKey(s, roundKeys[10]), '初始 AddRoundKey', '解密从第 10 轮圆密钥开始逆序进行。', 10);
    for (let r = 9; r >= 1; r--) {
      applyOp(() => shiftRows(s, true), `第 ${r} 轮 · InvShiftRows`, '逆行移位：第 r 行循环右移 r 字节。');
      applyOp(() => subBytes(s, INV_SBOX), `第 ${r} 轮 · InvSubBytes`, '按逆 S 盒还原字节。');
      applyOp(() => addRoundKey(s, roundKeys[r]), `第 ${r} 轮 · AddRoundKey`, '异或同一把圆密钥（XOR 自逆）。', r);
      applyOp(() => mixColumns(s, true), `第 ${r} 轮 · InvMixColumns`, '乘以逆矩阵还原列混合。');
    }
    applyOp(() => shiftRows(s, true), '末轮 · InvShiftRows', '还原最后一次行移位。');
    applyOp(() => subBytes(s, INV_SBOX), '末轮 · InvSubBytes', '还原最后一次字节替换。');
    applyOp(() => addRoundKey(s, roundKeys[0]), '末轮 · AddRoundKey', '异或第 0 轮圆密钥，恢复明文。', 0);
  }

  const resultHex = bytesToHex(s);
  let resultText: string;
  let resultNote: string;
  if (inv) {
    try {
      resultText = new TextDecoder('utf-8', { fatal: true }).decode(s).replace(/\u0000+$/, '');
      resultNote = '按 UTF-8 解码成功（末尾 0x00 为演示填充）。';
    } catch {
      resultText = resultHex;
      resultNote = '明文不是合法的 UTF-8 文本，按 HEX 显示原始字节。';
    }
  } else {
    resultText = resultHex;
    resultNote = '状态矩阵按列拉直即为 128 位密文（HEX）。每一轮的替换/移位/列混合都依赖密钥，因此必须知道密钥才能逆推。';
  }
  steps.push({
    title: inv ? '输出明文' : '输出密文',
    detail: resultNote,
    visual: { kind: 'numbers', items: [{ label: inv ? '明文' : '密文 (HEX)', value: resultText || '(空)' }] },
  });

  return { steps, result: resultText, resultLabel: inv ? '解密结果' : '密文 (HEX)' };
}

// ---------- 古典密码：凯撒 ----------

function lettersOnly(input: string): { letters: string; skipped: number } {
  const letters = input.toUpperCase().replace(/[^A-Z]/g, '');
  return { letters, skipped: input.length - letters.length };
}

function shiftLetter(ch: string, shift: number): string {
  return String.fromCharCode(((ch.charCodeAt(0) - 65 + shift + 26 * 10) % 26) + 65);
}

function lettersSteps(input: string, rows: Array<[string, string, string]>, summary: string): CryptoStep[] {
  const steps: CryptoStep[] = [
    {
      title: '输入',
      detail: summary,
      visual: { kind: 'numbers', items: [{ label: '输入', value: input || '(空)' }] },
    },
  ];
  for (let i = 0; i < rows.length; i++) {
    steps.push({
      title: `第 ${i + 1} 个字母`,
      detail: `${rows[i][0]} → ${rows[i][2]}（${rows[i][1]}）`,
      visual: {
        kind: 'letters',
        headers: ['原文', '运算', '结果'],
        rows: rows.slice(0, i + 1).map((cells, j) => ({
          cells,
          status: j === i ? 'active' : 'done',
        })),
      },
    });
  }
  return steps;
}

function caesarRun(params: RunParams): CryptoRun {
  const shift = ((Math.round(Number(params.key)) % 26) + 26) % 26;
  if (!Number.isFinite(shift)) throw new CryptoError('移位量无效');
  const { letters, skipped } = lettersOnly(params.input);
  if (!letters) throw new CryptoError('请输入 A–Z 字母');
  const inv = params.mode === 'decrypt';
  const delta = inv ? 26 - shift : shift;
  const rows = [...letters].map((ch): [string, string, string] => [
    ch,
    `${inv ? '-' : '+'}${delta}`,
    shiftLetter(ch, delta),
  ]);
  const steps = lettersSteps(
    letters,
    rows,
    `凯撒密码：每个字母在字母表上循环${inv ? '回退' : '前移'} ${delta} 位（密钥 ${shift}）。` +
      (skipped > 0 ? ` 已忽略 ${skipped} 个非字母字符。` : ''),
  );
  const result = rows.map((r) => r[2]).join('');
  steps.push({
    title: inv ? '还原明文' : '输出密文',
    detail: '逐字母替换完成。只有 25 种有效密钥，可直接穷举破译。',
    visual: { kind: 'numbers', items: [{ label: inv ? '明文' : '密文', value: result }] },
  });
  return { steps, result, resultLabel: inv ? '明文' : '密文' };
}

// ---------- 维吉尼亚 ----------

function vigenereRun(params: RunParams): CryptoRun {
  const { letters, skipped } = lettersOnly(params.input);
  const keyLetters = lettersOnly(params.key).letters || 'KEY';
  if (!letters) throw new CryptoError('请输入 A–Z 字母');
  const inv = params.mode === 'decrypt';
  const rows = [...letters].map((ch, i): [string, string, string] => {
    const k = keyLetters[i % keyLetters.length].charCodeAt(0) - 65;
    const p = ch.charCodeAt(0) - 65;
    const c = inv ? (p - k + 26) % 26 : (p + k) % 26;
    return [ch, `${inv ? '-' : '+'}${k}·${keyLetters[i % keyLetters.length]}`, String.fromCharCode(c + 65)];
  });
  const steps = lettersSteps(
    letters,
    rows,
    `维吉尼亚：密钥 "${keyLetters}" 循环对齐明文，逐字母做 mod 26 加${inv ? '减' : ''}法。同一明文字母因密钥位不同产生不同密文，可对抗简单频度分析。` +
      (skipped > 0 ? ` 已忽略 ${skipped} 个非字母字符。` : ''),
  );
  const result = rows.map((r) => r[2]).join('');
  steps.push({
    title: inv ? '还原明文' : '输出密文',
    detail: '逐字母运算完成。密钥若与明文等长且随机（Vernam），理论上不可破。',
    visual: { kind: 'numbers', items: [{ label: inv ? '明文' : '密文', value: result }] },
  });
  return { steps, result, resultLabel: inv ? '明文' : '密文' };
}

// ---------- 栅栏密码 ----------

function railPattern(len: number, rails: number): number[] {
  const pattern: number[] = [];
  let rail = 0;
  let dir = 1;
  for (let i = 0; i < len; i++) {
    pattern.push(rail);
    rail += dir;
    if (rail === rails - 1) dir = -1;
    else if (rail === 0) dir = 1;
  }
  return pattern;
}

function emptyRails(rails: number, len: number): (string | null)[][] {
  return Array.from({ length: rails }, () => Array.from({ length: len }, () => null));
}

function railFenceRun(params: RunParams): CryptoRun {
  const { letters, skipped } = lettersOnly(params.input);
  if (!letters) throw new CryptoError('请输入 A–Z 字母');
  const rails = Math.min(6, Math.max(2, Math.round(Number(params.key) || 3)));
  const n = letters.length;
  const pattern = railPattern(n, rails);
  const inv = params.mode === 'decrypt';
  const steps: CryptoStep[] = [];
  let result = '';

  if (!inv) {
    const grid = emptyRails(rails, n);
    steps.push({
      title: '之字形下落',
      detail: `明文沿 ${rails} 条导轨之字形书写，密钥 = 导轨数 ${rails}。` + (skipped > 0 ? ` 已忽略 ${skipped} 个非字母字符。` : ''),
      visual: { kind: 'zigzag', rails: grid, show: 'chars' },
    });
    for (let i = 0; i < n; i++) {
      grid[pattern[i]][i] = letters[i];
      steps.push({
        title: `下落第 ${i + 1} 字母`,
        detail: `'${letters[i]}' 落入第 ${pattern[i]} 条导轨。`,
        visual: { kind: 'zigzag', rails: grid.map((r) => r.slice()), show: 'chars' },
      });
    }
    result = grid.map((r) => r.filter(Boolean).join('')).join('');
    steps.push({
      title: '按行读取',
      detail: `从上到下逐条导轨拼接即得密文：${result}`,
      visual: { kind: 'zigzag', rails: grid.map((r) => r.slice()), show: 'chars' },
    });
  } else {
    steps.push({
      title: '标记之字形路径',
      detail: `先重建密钥决定的落格路径（数字 = 落入顺序），共 ${n} 个位置。`,
      visual: { kind: 'zigzag', rails: emptyRails(rails, n), show: 'indices', indices: railGridIndices(n, rails) },
    });
    const grid = emptyRails(rails, n);
    const byRail: string[][] = Array.from({ length: rails }, () => []);
    let cursor = 0;
    for (let r = 0; r < rails; r++) {
      for (let i = 0; i < n; i++) if (pattern[i] === r) byRail[r].push(letters[cursor++]);
    }
    cursor = 0;
    for (let r = 0; r < rails; r++) {
      const start = cursor;
      for (let i = 0; i < n; i++) {
        if (pattern[i] === r) grid[r][i] = letters[cursor++];
      }
      const count = cursor - start;
      if (count > 0) {
        steps.push({
          title: `填充第 ${r} 条导轨`,
          detail: `密文第 ${start + 1}–${cursor} 个字符（共 ${count} 个）按行填入导轨 ${r} 的落格位置。`,
          visual: { kind: 'zigzag', rails: grid.map((row) => row.slice()), show: 'chars' },
        });
      }
    }
    result = pattern.map((_, i) => grid[pattern[i]][i]).join('');
    steps.push({
      title: '之字形读取',
      detail: `沿之字形路径读取即还原明文：${result}`,
      visual: { kind: 'zigzag', rails: grid.map((row) => row.slice()), show: 'chars' },
    });
  }

  steps.push({
    title: inv ? '输出明文' : '输出密文',
    detail: '栅栏密码只是位置重排（换位），不改变字母本身，字母频度保持不变。',
    visual: { kind: 'numbers', items: [{ label: inv ? '明文' : '密文', value: result }] },
  });
  return { steps, result, resultLabel: inv ? '明文' : '密文' };
}

function railGridIndices(n: number, rails: number): number[][] {
  const pattern = railPattern(n, rails);
  const grid = emptyRails(rails, n) as (number | null)[][];
  const counter = Array.from({ length: rails }, () => 0);
  for (let i = 0; i < n; i++) {
    grid[pattern[i]][i] = counter[pattern[i]]++;
  }
  return grid.map((row) => row.map((v) => v ?? -1));
}

// ---------- XOR 流密码 ----------

function xorRun(params: RunParams): CryptoRun {
  const inv = params.mode === 'decrypt';
  let bytes: Uint8Array;
  if (inv && params.hexInput) {
    bytes = hexToBytes(params.input);
  } else {
    bytes = utf8Bytes(params.input);
  }
  if (bytes.length === 0) throw new CryptoError('请输入内容');
  if (bytes.length > 32) bytes = bytes.slice(0, 32);
  const keyBytes = utf8Bytes(params.key || 'key');
  if (keyBytes.length === 0) throw new CryptoError('密钥不能为空');

  const steps: CryptoStep[] = [
    {
      title: inv ? '输入密文' : '输入明文',
      detail: `XOR 逐字节运算：密文位 = 明文位 ⊕ 密钥位。密钥 "${params.key || 'key'}" 循环使用，共 ${bytes.length} 字节。`,
      visual: { kind: 'bits', done: [], current: null },
    },
  ];

  const done: Array<{ label: string; hex: string }> = [];
  for (let i = 0; i < bytes.length; i++) {
    const k = keyBytes[i % keyBytes.length];
    steps.push({
      title: `第 ${i + 1}/${bytes.length} 字节`,
      detail: `${printableByte(bytes[i])} (0x${bytes[i].toString(16).padStart(2, '0')}) ⊕ ${printableByte(k)} (0x${k
        .toString(16)
        .padStart(2, '0')}) = 0x${(bytes[i] ^ k).toString(16).padStart(2, '0')}`,
      visual: { kind: 'bits', done: done.slice(), current: { p: bytes[i], k } },
    });
    const c = bytes[i] ^ k;
    done.push({ label: printableByte(bytes[i]), hex: c.toString(16).padStart(2, '0') });
  }

  const outBytes = bytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  let result: string;
  let resultLabel: string;
  if (inv) {
    result = decoder.decode(outBytes);
    resultLabel = '明文';
  } else {
    result = bytesToHex(outBytes);
    resultLabel = '密文 (HEX)';
  }

  steps.push({
    title: inv ? '输出明文' : '输出密文',
    detail:
      'XOR 的妙处：a ⊕ k = c，则 c ⊕ k = a —— 加解密是同一个运算。密钥重复使用时不再是 Vernam 一次一密，需防重放与频度分析。',
    visual: { kind: 'numbers', items: [{ label: resultLabel, value: result || '(空)' }] },
  });

  return { steps, result, resultLabel };
}

// ---------- RSA ----------

const PRIMES = [13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];

function rsaKeys(seed: number) {
  const s = Math.abs(Math.floor(seed)) || 1;
  const p = PRIMES[s % PRIMES.length];
  let q = PRIMES[(s * 7 + 3) % PRIMES.length];
  if (q === p) q = PRIMES[(PRIMES.indexOf(q) + 1) % PRIMES.length];
  const n = p * q;
  const phi = (p - 1) * (q - 1);
  let e = 0;
  for (const c of [17, 5, 7, 11, 13, 19, 23, 3]) {
    if (gcd(c, phi) === 1) {
      e = c;
      break;
    }
  }
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d };
}

function rsaRun(params: RunParams): CryptoRun {
  const { p, q, n, phi, e, d } = rsaKeys(params.seed);
  const inv = params.mode === 'decrypt';
  const steps: CryptoStep[] = [];

  steps.push({
    title: '生成密钥对',
    detail: '选两个素数 p、q → n = p·q 是模数；φ = (p-1)(q-1)；选与 φ 互素的 e，求 e 关于 φ 的模逆 d。公钥 = (n, e)，私钥 = (n, d)。',
    visual: {
      kind: 'numbers',
      items: [
        { label: '素数 p', value: String(p), color: '#fbbf24' },
        { label: '素数 q', value: String(q), color: '#fbbf24' },
        { label: '模数 n = p·q', value: String(n), color: '#3b82f6' },
        { label: 'φ(n)', value: String(phi), muted: true },
        { label: '公钥指数 e', value: String(e), color: '#22d3ee' },
        { label: '私钥指数 d', value: String(d), color: '#34d399', note: 'e·d ≡ 1 (mod φ)' },
      ],
    },
  });

  let rows: Array<[string, string, string]>;
  if (!inv) {
    const { letters, skipped } = lettersOnly(params.input);
    if (!letters) throw new CryptoError('请输入 A–Z 字母');
    rows = [...letters].map((ch): [string, string, string] => {
      const m = ch.charCodeAt(0);
      const c = modpow(m, e, n);
      return [ch, `^${e}`, String(c)];
    });
    steps.push({
      title: '输入',
      detail: `把每个字母的 ASCII 码作为消息 m（需 m < n = ${n}）逐个加密。` + (skipped > 0 ? ` 已忽略 ${skipped} 个非字母字符。` : ''),
      visual: { kind: 'numbers', items: [{ label: '输入', value: letters }] },
    });
  } else {
    const codes = params.input.trim().split(/\s+/).filter(Boolean).map(Number);
    if (!codes.length || codes.some((c) => !Number.isInteger(c) || c < 0 || c >= n)) {
      throw new CryptoError(`请输入 ${n} 以内的整数序列（空格分隔）`);
    }
    rows = codes.map((c): [string, string, string] => {
      const m = modpow(c, d, n);
      return [String(c), `^${d}`, String(m)];
    });
    steps.push({
      title: '输入',
      detail: '密文是逐字符的整数序列，只有持有私钥 d 才能还原 m = c^d mod n。',
      visual: { kind: 'numbers', items: [{ label: '输入', value: params.input.trim() }] },
    });
  }

  for (let i = 0; i < rows.length; i++) {
    const stepDetail = inv
      ? `${rows[i][0]} → ${rows[i][2]}，即 '${String.fromCharCode(Number(rows[i][2]))}'（c^${d} mod ${n}）`
      : `${rows[i][0]}(${rows[i][0].charCodeAt(0)}) → ${rows[i][2]}，即 m^${e} mod ${n}`;
    steps.push({
      title: inv ? `解密第 ${i + 1} 段` : `加密第 ${i + 1} 字符`,
      detail: stepDetail,
      visual: {
        kind: 'letters',
        headers: [inv ? '密文' : '消息 m', '运算', inv ? '明文' : '密文 c'],
        rows: rows.slice(0, i + 1).map((cells, j) => ({ cells, status: j === i ? 'active' : 'done' })),
      },
    });
  }

  const result = inv
    ? rows.map((r) => String.fromCharCode(Number(r[2]))).join('')
    : rows.map((r) => r[2]).join(' ');
  steps.push({
    title: inv ? '还原明文' : '输出密文',
    detail:
      inv
        ? '只有知道 φ(n) 才能算出 d —— 而求 φ 需要对 n 做质因数分解。真实 RSA 用 2048 位模数，分解在计算上不可行。'
        : '任何人都能用公钥 (n, e) 加密，只有私钥 d 能解。真实实现用 OAEP 填充且不会逐字符加密。',
    visual: { kind: 'numbers', items: [{ label: inv ? '明文' : '密文序列', value: result }] },
  });

  return { steps, result, resultLabel: inv ? '明文' : '密文序列' };
}

// ---------- Diffie-Hellman ----------

function colorOf(v: number): string {
  return `hsl(${(v * 47) % 360} 70% 55%)`;
}

function dhRun(params: RunParams): CryptoRun {
  const pChoices = [23, 47, 233, 941];
  const gChoices = [5, 7, 11];
  const p = pChoices[Math.abs(params.seed) % pChoices.length];
  const g = gChoices[Math.abs(Math.floor(params.seed / 10)) % gChoices.length];
  const a = 2 + (Math.abs(params.seed) * 3 + 1) % (p - 3);
  const b = 2 + (Math.abs(params.seed) * 7 + 5) % (p - 3);
  const A = modpow(g, a, p);
  const B = modpow(g, b, p);
  const sA = modpow(B, a, p);
  const sB = modpow(A, b, p);

  const steps: CryptoStep[] = [
    {
      title: '公开参数',
      detail: `双方约定公开的大素数 p = ${p} 与生成元 g = ${g}（可被窃听，无妨）。`,
      visual: {
        kind: 'numbers',
        items: [
          { label: '素数 p', value: String(p), color: '#fbbf24' },
          { label: '生成元 g', value: String(g), color: '#fbbf24' },
          { label: '类比：公开底色', value: '🟡 公共颜料', color: colorOf(g) },
        ],
      },
    },
    {
      title: '双方各自选私密钥',
      detail: `Alice 秘密选 a = ${a}，Bob 秘密选 b = ${b}（类比：各自往底色里混入自己的 secret 颜料）。`,
      visual: {
        kind: 'numbers',
        items: [
          { label: 'Alice 私钥 a', value: String(a), color: colorOf(a) },
          { label: 'Bob 私钥 b', value: String(b), color: colorOf(b) },
        ],
      },
    },
    {
      title: '计算并交换公钥',
      detail: `A = g^a mod p = ${A}，B = g^b mod p = ${B}。公钥可以公开传输 —— 窃听者拿到 A、B 也难反推 a、b（离散对数难题）。`,
      visual: {
        kind: 'numbers',
        items: [
          { label: 'Alice 公钥 A', value: String(A), color: colorOf(A), note: `g^${a} mod ${p}` },
          { label: 'Bob 公钥 B', value: String(B), color: colorOf(B), note: `g^${b} mod ${p}` },
        ],
      },
    },
    {
      title: '各自计算共享密钥',
      detail: `Alice：s = B^a mod p = ${sA}；Bob：s = A^b mod p = ${sB}。两者必然相等：g^(a·b) mod p。窃听者只有 g、p、A、B，算不出 s。`,
      visual: {
        kind: 'numbers',
        items: [
          { label: 'Alice 算出 s', value: String(sA), color: colorOf(sA), note: `B^${a} mod ${p}` },
          { label: 'Bob 算出 s', value: String(sB), color: colorOf(sB), note: `A^${b} mod ${p}` },
          { label: '共享密钥 ✓', value: String(sA), color: '#34d399', note: '颜色一致 = 数值一致' },
        ],
      },
    },
    {
      title: '完成密钥交换',
      detail: `此后双方可用共享密钥 s = ${sA} 作为对称算法（如 AES）的密钥加密通信 —— 这就是 HTTPS 握手的核心思想（真实实现用更大的 p 并防中间人）。`,
      visual: {
        kind: 'numbers',
        items: [
          { label: '共享密钥', value: String(sA), color: '#34d399' },
          { label: '下一步', value: 's → AES 密钥', muted: true },
        ],
      },
    },
  ];

  return { steps, result: String(sA), resultLabel: '共享密钥' };
}

// ---------- 元数据与导出 ----------

export const CRYPTO_ALGORITHMS: CryptoAlgoMeta[] = [
  {
    id: 'caesar',
    name: '凯撒密码',
    en: 'Caesar Cipher',
    group: '古典密码',
    type: 'cipher',
    inputLabel: '明文 / 密文 (A–Z)',
    inputDefault: 'ATTACKATDAWN',
    inputMax: 32,
    keyKind: 'shift',
    keyLabel: '移位量 (0–25)',
    keyDefault: '3',
    idea: '将每个字母沿字母表循环移动固定位数，是最早的替换密码之一。',
    security: '极弱：仅 25 种密钥，可直接穷举或频度分析破译。',
    run: caesarRun,
  },
  {
    id: 'vigenere',
    name: '维吉尼亚密码',
    en: 'Vigenère Cipher',
    group: '古典密码',
    type: 'cipher',
    inputLabel: '明文 / 密文 (A–Z)',
    inputDefault: 'CRYPTOGRAPHY',
    inputMax: 32,
    keyKind: 'keyword',
    keyLabel: '密钥字 (A–Z)',
    keyDefault: 'KEY',
    idea: '用循环密钥字对每个字母做不同的移位，相当于 26 张凯撒表轮换使用。',
    security: '弱：密钥重复导致周期性，可用 Kasiski / 重合指数分析破译。',
    run: vigenereRun,
  },
  {
    id: 'railfence',
    name: '栅栏密码',
    en: 'Rail Fence Cipher',
    group: '古典密码',
    type: 'cipher',
    inputLabel: '明文 / 密文 (A–Z)',
    inputDefault: 'WEAREDISCOVEREDFLEEATONCE',
    inputMax: 32,
    keyKind: 'rails',
    keyLabel: '导轨数 (2–6)',
    keyDefault: '3',
    idea: '把明文沿多行导轨之字形书写，再逐行读出 —— 只打乱位置不改变字母。',
    security: '极弱：位置重排保留字母频度，导轨数很少可穷举。',
    run: railFenceRun,
  },
  {
    id: 'xor',
    name: 'XOR 流密码',
    en: 'XOR / Vernam',
    group: '位级与流密码',
    type: 'cipher',
    inputLabel: '明文 / 密文',
    inputDefault: 'Hello Crypto!',
    inputMax: 48,
    keyKind: 'key',
    keyLabel: '密钥（循环使用）',
    keyDefault: 'key',
    hexToggle: true,
    idea: '逐位异或：密文 = 明文 ⊕ 密钥。加解密同一运算，是流密码与一次一密的核心。',
    security: '密钥真随机、等长且只用一次（一次一密）时理论不可破；循环密钥则较弱。',
    run: xorRun,
  },
  {
    id: 'aes',
    name: 'AES-128 分组加密',
    en: 'AES-128 (Rijndael)',
    group: '现代对称加密',
    type: 'cipher',
    inputLabel: '16 字节分组（文本或 HEX）',
    inputDefault: 'AES-128 Rocks!!',
    inputMax: 48,
    keyKind: 'key',
    keyLabel: '128 位密钥（16 字节）',
    keyDefault: 'this-is-a-key-16',
    hexToggle: true,
    idea: 'NIST 标准分组密码：SubBytes 混淆 + ShiftRows/MixColumns 扩散 + AddRoundKey 注入密钥，共 10 轮。',
    security: '目前无已知实用攻击；最佳攻击仅将有效强度降低约 2 位。真实系统用 CBC/GCM 等模式链接分组。',
    run: aesRun,
  },
  {
    id: 'rsa',
    name: 'RSA 公钥加密',
    en: 'RSA',
    group: '公钥与密钥交换',
    type: 'cipher',
    inputLabel: '明文 (A–Z) 或密文整数序列',
    inputDefault: 'HELLO',
    inputMax: 48,
    keyKind: 'none',
    idea: '安全性基于大整数分解难题：公钥 (n, e) 任何人可加密，只有掌握 φ(n) 者能算出私钥 d 解密。',
    security: '小素数仅用于演示；真实 RSA 使用 2048+ 位模数与 OAEP 填充。',
    run: rsaRun,
  },
  {
    id: 'dh',
    name: 'Diffie-Hellman 密钥交换',
    en: 'Diffie–Hellman',
    group: '公钥与密钥交换',
    type: 'exchange',
    inputLabel: '（无需输入）',
    inputDefault: '',
    inputMax: 0,
    keyKind: 'none',
    idea: '双方在公开信道上协作算出同一个秘密：g^(ab) mod p。窃听者面对离散对数难题无法还原。',
    security: '小参数仅用于演示；真实实现用 2048+ 位参数并对公钥做验证以抗中间人。',
    run: dhRun,
  },
];

export function getCryptoAlgorithm(id: string): CryptoAlgoMeta {
  return CRYPTO_ALGORITHMS.find((m) => m.id === id) ?? CRYPTO_ALGORITHMS[0];
}
