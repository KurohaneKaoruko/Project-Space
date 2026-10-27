'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';
import { buildHuffman, layoutTree, encodeText, type HuffmanResult } from './huffman';

const PANEL = 'bg-white/85 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl shadow-zinc-900/5';

const SAMPLES: Record<string, string> = {
  '经典示例': 'this is an example of a huffman tree',
  '中文示例': 'abracadabra alakazam 魔法与数据压缩的艺术',
  'DNA 序列': 'GATTACAGGCATTATAGGCTAAGGCATTAGATTACA',
  '重复字符': 'aaaaaaaaaabbbbbbbccccddddd!!!',
};

function NodeBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
      <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export default function HuffmanPage() {
  const [text, setText] = useState(SAMPLES['经典示例']);
  const [inputDraft, setInputDraft] = useState(SAMPLES['经典示例']);
  const [highlightCh, setHighlightCh] = useState<string | null>(null);

  const result: HuffmanResult = useMemo(() => buildHuffman(text), [text]);
  const layout = useMemo(() => layoutTree(result.root), [result]);
  const encoded = useMemo(() => encodeText(text, result.table), [text, result]);

  // 边终点坐标 → 节点 code 映射（用于边高亮判断）
  const edgeCodeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of layout.nodes) m.set(`${Math.round(n.x)}:${Math.round(n.y)}`, n.node.code);
    return m;
  }, [layout]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // 切换文本时重置高亮
  useEffect(() => setHighlightCh(null), [text]);

  const ratio = result.bitsFixed > 0 ? (result.bitsFixed - result.bitsHuffman) / result.bitsFixed : 0;
  const leafNodes = layout.nodes.filter((n) => n.node.ch !== null);
  const bitChars = encoded.slice(0, 800);

  return (
    <main className="min-h-screen bg-zinc-50">
      <Navigation title="HUFFMAN_TREE" />

      <div className="flex min-h-screen flex-col px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1500px] space-y-5">
          {/* 标题 */}
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-blue-600" />
              <h1 className="text-3xl font-black text-zinc-900 tracking-tight">哈夫曼编码树</h1>
              <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 rounded">ALGORITHM</span>
            </div>
            <p className="text-sm text-zinc-500 font-mono">
              {'/// 贪心构建最优前缀码：频率越高 → 编码越短。输入任意文本，实时建树。'}
            </p>
          </header>

          {/* 输入区 */}
          <div className={`${PANEL} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(SAMPLES).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setInputDraft(SAMPLES[k]);
                    setText(SAMPLES[k]);
                  }}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={inputDraft}
                onChange={(e) => setInputDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setText(inputDraft);
                }}
                placeholder="输入要编码的文本…"
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-800 outline-none transition-colors focus:border-blue-500"
              />
              <button
                onClick={() => setText(inputDraft)}
                className="rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
              >
                构建编码树
              </button>
            </div>
          </div>

          {/* 统计卡片行 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {[
              { label: '总字符', value: result.totalChars, sub: `${result.uniqueChars} 种` },
              { label: '哈夫曼位数', value: result.bitsHuffman, sub: '前缀码总长' },
              { label: '定长位数', value: result.bitsFixed, sub: `${result.fixedBitsPerChar} 位/字符` },
              { label: '压缩率', value: `${Math.max(0, Math.round(ratio * 100))}%`, sub: '相对定长' },
              { label: '平均码长', value: result.totalChars ? (result.bitsHuffman / result.totalChars).toFixed(2) : '0', sub: '位/字符' },
              { label: '树深度', value: layout.nodes.length ? Math.round(layout.height / 74) : 0, sub: '最大编码长度' },
            ].map((c) => (
              <div key={c.label} className={`${PANEL} p-3.5`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{c.label}</div>
                <div className="mt-1 text-xl font-black text-zinc-900">{c.value}</div>
                <div className="text-[10px] font-mono text-zinc-400">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* 树可视化 */}
          <div className={`${PANEL} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">编码树（左 0 右 1）</span>
              <div className="flex gap-4">
                <NodeBadge label="叶子·字符" color="#2563eb" />
                <NodeBadge label="内部·频率" color="#a1a1aa" />
                <NodeBadge label="路径高亮" color="#f59e0b" />
              </div>
            </div>
            <div ref={scrollRef} className="max-h-[420px] overflow-auto p-4">
              {layout.nodes.length === 0 ? (
                <div className="flex h-32 items-center justify-center font-mono text-sm text-zinc-300">
                  输入文本后点击「构建编码树」
                </div>
              ) : (
                <svg
                  width={Math.max(layout.width + 80, 400)}
                  height={layout.height + 90}
                  className="mx-auto block"
                  style={{ minWidth: '100%' }}
                >
                  {layout.edges.map((e, i) => {
                    // 高亮：边终点节点的 code 是该字符叶子 code 的前缀
                    const targetCode = edgeCodeMap.get(`${Math.round(e.x2)}:${Math.round(e.y2)}`);
                    const hl = highlightCh !== null && targetCode !== undefined && nodeOnPath(targetCode, highlightCh, result.table);
                    return (
                      <g key={i}>
                        <line
                          x1={e.x1 + 40}
                          y1={e.y1 + 36}
                          x2={e.x2 + 40}
                          y2={e.y2 + 36}
                          stroke={hl ? '#f59e0b' : '#d4d4d8'}
                          strokeWidth={hl ? 2.5 : 1.5}
                        />
                        <text
                          x={(e.x1 + e.x2) / 2 + 44}
                          y={(e.y1 + e.y2) / 2 + 34}
                          fill={hl ? '#b45309' : '#a1a1aa'}
                          fontSize={11}
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {e.bit}
                        </text>
                      </g>
                    );
                  })}
                  {layout.nodes.map((n) => {
                    const isLeaf = n.node.ch !== null;
                    const hl = highlightCh !== null && nodeOnPath(n.node.code, highlightCh, result.table);
                    const r = isLeaf ? 17 : 13;
                    return (
                      <g
                        key={n.node.id}
                        transform={`translate(${n.x + 40}, ${n.y + 36})`}
                        onClick={() => isLeaf && setHighlightCh(highlightCh === n.node.ch ? null : n.node.ch)}
                        style={{ cursor: isLeaf ? 'pointer' : 'default' }}
                      >
                        <circle
                          r={r}
                          fill={isLeaf ? (hl ? '#f59e0b' : '#2563eb') : hl ? '#fde68a' : '#f4f4f5'}
                          stroke={isLeaf ? (hl ? '#b45309' : '#1d4ed8') : hl ? '#b45309' : '#a1a1aa'}
                          strokeWidth={1.5}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={isLeaf ? 12 : 10}
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill={isLeaf ? '#fff' : hl ? '#b45309' : '#71717a'}
                        >
                          {isLeaf ? (n.node.ch === ' ' ? '␣' : n.node.ch!.length > 2 ? '…' : n.node.ch) : n.node.freq}
                        </text>
                        {isLeaf && (
                          <text textAnchor="middle" y={r + 13} fontSize={10} fontFamily="monospace" fill={hl ? '#b45309' : '#3f3f46'}>
                            {n.node.code || '0'}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          {/* 编码表 + 编码结果 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className={`${PANEL} overflow-hidden`}>
              <div className="border-b border-zinc-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                编码表（按频率降序）
              </div>
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full font-mono text-xs">
                  <thead className="sticky top-0 bg-white/95">
                    <tr className="text-left text-[10px] text-zinc-400">
                      <th className="px-4 py-2 font-normal">字符</th>
                      <th className="px-4 py-2 font-normal text-right">频率</th>
                      <th className="px-4 py-2 font-normal">编码</th>
                      <th className="px-4 py-2 font-normal text-right">位数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.map((e) => (
                      <tr
                        key={e.ch}
                        onClick={() => setHighlightCh(highlightCh === e.ch ? null : e.ch)}
                        className={`cursor-pointer border-t border-zinc-100 transition-colors ${
                          highlightCh === e.ch ? 'bg-amber-50' : 'hover:bg-zinc-50'
                        }`}
                      >
                        <td className="px-4 py-1.5 font-bold text-zinc-800">{e.ch === ' ' ? '␣ 空格' : e.ch}</td>
                        <td className="px-4 py-1.5 text-right text-zinc-500">{e.freq}</td>
                        <td className="px-4 py-1.5">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-bold tracking-widest text-blue-700">{e.code}</span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-zinc-500">{e.bits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${PANEL} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">编码结果（前 800 bit）</span>
                <span className="font-mono text-[10px] text-zinc-400">{encoded.length} bits</span>
              </div>
              <div className="max-h-[300px] overflow-auto p-4">
                <p className="break-all font-mono text-xs leading-6 tracking-widest text-zinc-700 select-all">
                  {bitChars || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className={`${PANEL} p-4 text-[11px] leading-relaxed text-zinc-500`}>
            <span className="font-bold text-zinc-700">算法说明：</span>
            反复从频率集合中取出两个最小节点合并为新内部节点（频率 = 之和），直至只剩根——即哈夫曼贪心。
            得到的前缀码保证总编码长度最优（无任何码字是另一码字的前缀）。点击树叶或表格行可高亮对应编码路径。
          </div>
        </div>
      </div>
    </main>
  );
}

/** 节点是否在某字符叶子的编码路径上：node.code 是叶子 code 的前缀（根 code='' 恒为前缀） */
function nodeOnPath(
  nodeCode: string,
  ch: string,
  table: { ch: string; code: string }[],
): boolean {
  const leaf = table.find((e) => e.ch === ch);
  if (!leaf) return false;
  const leafCode = leaf.code || '0';
  return leafCode.startsWith(nodeCode);
}
