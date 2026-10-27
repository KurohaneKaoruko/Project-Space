'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '../../components/Navigation';

type Sample = {
  name: string;
  code: string;
  input?: string;
};

const SAMPLES: Sample[] = [
  {
    name: 'Hello World',
    code:
      '++++++++++[>+++++++>++++++++++>+++>+<<<<-]>++.>+.+++++++..+++.>++.<<+++++++++++++++.>.+++.------.--------.>+.>.',
  },
  {
    name: 'Echo (input -> output)',
    code: ',[.,]',
    input: 'Hello Brainfuck!',
  },
  {
    name: 'Cell Demo',
    code: '+++++[>+++++<-]>.<+++[>++++<-]>+.',
  },
];

const TAPE_SIZE = 30000;

const SPEEDS = [
  { id: 'slow', label: 'SLOW', stepsPerFrame: 1, delayMs: 80 },
  { id: 'normal', label: 'NORMAL', stepsPerFrame: 80, delayMs: 0 },
  { id: 'fast', label: 'FAST', stepsPerFrame: 1200, delayMs: 0 },
  { id: 'turbo', label: 'TURBO', stepsPerFrame: 20000, delayMs: 0 },
] as const;

export default function BrainfuckToolPage() {
  const [sampleName, setSampleName] = useState(SAMPLES[0].name);
  const [code, setCode] = useState(SAMPLES[0].code);
  const [input, setInput] = useState(SAMPLES[0].input ?? '');
  const [output, setOutput] = useState('');
  const [ip, setIp] = useState(0);
  const [ptr, setPtr] = useState(0);
  const [steps, setSteps] = useState(0);
  const [maxSteps, setMaxSteps] = useState(200000);
  const [running, setRunning] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [speedId, setSpeedId] = useState<typeof SPEEDS[number]['id']>('normal');
  const [breakpointsText, setBreakpointsText] = useState('');
  const [breakpointHit, setBreakpointHit] = useState(false);
  const [jumpTarget, setJumpTarget] = useState('0');

  const tapeRef = useRef<Uint8Array>(new Uint8Array(TAPE_SIZE));
  const inputIndexRef = useRef(0);
  const ipRef = useRef(0);
  const ptrRef = useRef(0);
  const stepsRef = useRef(0);
  const outputRef = useRef('');
  const runningRef = useRef(false);
  const breakpointsRef = useRef<Set<number>>(new Set());
  const speedRef = useRef<(typeof SPEEDS)[number]>(SPEEDS[1]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const program = useMemo(() => code.replace(/[^\[\]\+\-\<\>\.\,]/g, ''), [code]);

  const { bracketMap, syntaxError } = useMemo(() => {
    const map = new Int32Array(program.length);
    map.fill(-1);
    const stack: number[] = [];
    for (let i = 0; i < program.length; i++) {
      const c = program[i];
      if (c === '[') stack.push(i);
      else if (c === ']') {
        if (!stack.length) {
          return { bracketMap: map, syntaxError: `括号不匹配：在第 ${i + 1} 个字符遇到 ]` };
        }
        const j = stack.pop() as number;
        map[i] = j;
        map[j] = i;
      }
    }
    if (stack.length) {
      return { bracketMap: map, syntaxError: `括号不匹配：有 ${stack.length} 个 [ 未闭合` };
    }
    return { bracketMap: map, syntaxError: null };
  }, [program]);

  const error = syntaxError ?? runtimeError;
  const speedConfig = useMemo(() => SPEEDS.find((s) => s.id === speedId) ?? SPEEDS[1], [speedId]);

  const resetMachine = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setRuntimeError(null);
    setBreakpointHit(false);
    tapeRef.current.fill(0);
    inputIndexRef.current = 0;
    ipRef.current = 0;
    ptrRef.current = 0;
    stepsRef.current = 0;
    outputRef.current = '';
    setOutput('');
    setIp(0);
    setPtr(0);
    setSteps(0);
  }, []);

  useEffect(() => {
    if (syntaxError) {
      runningRef.current = false;
      setRunning(false);
    }
  }, [syntaxError]);

  useEffect(() => {
    speedRef.current = speedConfig;
  }, [speedConfig]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
    };
  }, []);

  useEffect(() => {
    const next = SAMPLES.find((s) => s.name === sampleName);
    if (!next) return;
    setCode(next.code);
    setInput(next.input ?? '');
    resetMachine();
  }, [sampleName, resetMachine]);


  const stepOnce = useCallback(() => {
    if (syntaxError) return;
    if (ipRef.current >= program.length) return;
    setBreakpointHit(false);

    let ipLocal = ipRef.current;
    let ptrLocal = ptrRef.current;
    let outLocal = outputRef.current;
    let inputIndex = inputIndexRef.current;
    const tape = tapeRef.current;

    const cmd = program[ipLocal];
    switch (cmd) {
      case '>':
        ptrLocal = (ptrLocal + 1) % TAPE_SIZE;
        ipLocal += 1;
        break;
      case '<':
        ptrLocal = (ptrLocal - 1 + TAPE_SIZE) % TAPE_SIZE;
        ipLocal += 1;
        break;
      case '+':
        tape[ptrLocal] = (tape[ptrLocal] + 1) & 255;
        ipLocal += 1;
        break;
      case '-':
        tape[ptrLocal] = (tape[ptrLocal] - 1 + 256) & 255;
        ipLocal += 1;
        break;
      case '.':
        outLocal += String.fromCharCode(tape[ptrLocal]);
        ipLocal += 1;
        break;
      case ',':
        if (inputIndex < input.length) {
          tape[ptrLocal] = input.charCodeAt(inputIndex) & 255;
          inputIndex += 1;
        } else {
          tape[ptrLocal] = 0;
        }
        ipLocal += 1;
        break;
      case '[':
        if (tape[ptrLocal] === 0) {
          ipLocal = bracketMap[ipLocal] + 1;
        } else {
          ipLocal += 1;
        }
        break;
      case ']':
        if (tape[ptrLocal] !== 0) {
          ipLocal = bracketMap[ipLocal] + 1;
        } else {
          ipLocal += 1;
        }
        break;
      default:
        ipLocal += 1;
        break;
    }

    ipRef.current = ipLocal;
    ptrRef.current = ptrLocal;
    inputIndexRef.current = inputIndex;
    outputRef.current = outLocal;
    stepsRef.current += 1;

    setIp(ipLocal);
    setPtr(ptrLocal);
    setOutput(outLocal);
    setSteps(stepsRef.current);
  }, [syntaxError, program, bracketMap, input]);

  const stopRun = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const runChunk = useCallback(() => {
    if (!runningRef.current) return;
    if (syntaxError) {
      stopRun();
      return;
    }
    let ipLocal = ipRef.current;
    let ptrLocal = ptrRef.current;
    let stepsLocal = stepsRef.current;
    let outLocal = outputRef.current;
    let inputIndex = inputIndexRef.current;
    const tape = tapeRef.current;

    let executed = 0;
    let hitBreakpoint = false;
    const { stepsPerFrame } = speedRef.current;
    while (ipLocal < program.length && executed < stepsPerFrame && stepsLocal < maxSteps) {
      if (breakpointsRef.current.has(ipLocal)) {
        hitBreakpoint = true;
        break;
      }
      const cmd = program[ipLocal];
      switch (cmd) {
        case '>':
          ptrLocal = (ptrLocal + 1) % TAPE_SIZE;
          ipLocal += 1;
          break;
        case '<':
          ptrLocal = (ptrLocal - 1 + TAPE_SIZE) % TAPE_SIZE;
          ipLocal += 1;
          break;
        case '+':
          tape[ptrLocal] = (tape[ptrLocal] + 1) & 255;
          ipLocal += 1;
          break;
        case '-':
          tape[ptrLocal] = (tape[ptrLocal] - 1 + 256) & 255;
          ipLocal += 1;
          break;
        case '.':
          outLocal += String.fromCharCode(tape[ptrLocal]);
          ipLocal += 1;
          break;
        case ',':
          if (inputIndex < input.length) {
            tape[ptrLocal] = input.charCodeAt(inputIndex) & 255;
            inputIndex += 1;
          } else {
            tape[ptrLocal] = 0;
          }
          ipLocal += 1;
          break;
        case '[':
          if (tape[ptrLocal] === 0) {
            ipLocal = bracketMap[ipLocal] + 1;
          } else {
            ipLocal += 1;
          }
          break;
        case ']':
          if (tape[ptrLocal] !== 0) {
            ipLocal = bracketMap[ipLocal] + 1;
          } else {
            ipLocal += 1;
          }
          break;
        default:
          ipLocal += 1;
          break;
      }
      stepsLocal += 1;
      executed += 1;
    }

    ipRef.current = ipLocal;
    ptrRef.current = ptrLocal;
    stepsRef.current = stepsLocal;
    outputRef.current = outLocal;
    inputIndexRef.current = inputIndex;

    setIp(ipLocal);
    setPtr(ptrLocal);
    setSteps(stepsLocal);
    setOutput(outLocal);

    if (ipLocal >= program.length) {
      stopRun();
      return;
    }
    if (hitBreakpoint) {
      setBreakpointHit(true);
      stopRun();
      return;
    }
    if (stepsLocal >= maxSteps) {
      setRuntimeError('达到步数上限，已停止运行');
      stopRun();
      return;
    }
    const delay = speedRef.current.delayMs;
    if (delay > 0) {
      window.setTimeout(runChunk, delay);
    } else {
      requestAnimationFrame(runChunk);
    }
  }, [syntaxError, program, bracketMap, input, maxSteps, stopRun]);

  const startRun = useCallback(() => {
    if (syntaxError) return;
    if (runningRef.current) return;
    setRuntimeError(null);
    setBreakpointHit(false);
    runningRef.current = true;
    setRunning(true);
    runChunk();
  }, [syntaxError, runChunk]);

  const memoryWindow = useMemo(() => {
    const windowSize = 24;
    const half = Math.floor(windowSize / 2);
    let start = ptr - half;
    if (start < 0) start = 0;
    if (start + windowSize > TAPE_SIZE) start = TAPE_SIZE - windowSize;
    const list = [];
    for (let i = 0; i < windowSize; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= TAPE_SIZE) continue;
      list.push({ idx, value: tapeRef.current[idx], active: idx === ptr });
    }
    return list;
  }, [ptr, steps]);

  const statusLabel = running ? 'RUNNING' : breakpointHit ? 'BREAKPOINT' : error ? 'ERROR' : 'IDLE';

  const updateBreakpoints = useCallback(
    (value: string, silent?: boolean) => {
      if (!silent) setBreakpointsText(value);
      const tokens = value.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      const next = new Set<number>();
      for (const token of tokens) {
        const num = parseInt(token, 10);
        if (!Number.isFinite(num)) continue;
        if (num < 0 || num >= program.length) continue;
        next.add(num);
      }
      breakpointsRef.current = next;
    },
    [program.length]
  );

  useEffect(() => {
    if (!breakpointsText) return;
    updateBreakpoints(breakpointsText, true);
  }, [program.length, breakpointsText, updateBreakpoints]);

  const jumpToIp = useCallback(() => {
    const num = parseInt(jumpTarget, 10);
    if (!Number.isFinite(num)) return;
    const next = Math.max(0, Math.min(program.length, num));
    runningRef.current = false;
    setRunning(false);
    setBreakpointHit(false);
    ipRef.current = next;
    setIp(next);
  }, [jumpTarget, program.length]);

  const exportProgram = useCallback(() => {
    const payload = {
      code,
      input,
      maxSteps,
      breakpoints: breakpointsText,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brainfuck.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [code, input, maxSteps, breakpointsText]);

  const importProgram = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        try {
          const json = JSON.parse(text) as { code?: string; input?: string; maxSteps?: number; breakpoints?: string };
          if (typeof json.code === 'string') setCode(json.code);
          if (typeof json.input === 'string') setInput(json.input);
          if (typeof json.maxSteps === 'number') setMaxSteps(json.maxSteps);
          if (typeof json.breakpoints === 'string') updateBreakpoints(json.breakpoints);
        } catch {
          setCode(text);
        } finally {
          resetMachine();
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [resetMachine, updateBreakpoints]
  );

  return (
    <main className="min-h-screen bg-zinc-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      <Navigation title="BRAINFUCK" />

      <div className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mx-auto w-full max-w-[1400px] space-y-8">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-blue-600" />
              <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Brainfuck 解释器</h1>
              <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 rounded">TOOL</span>
            </div>
            <p className="text-sm text-zinc-500 font-mono max-w-3xl">
              {'/// 输入 Brainfuck 程序，支持运行 / 单步 / 输入输出 / 步数限制。'}
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
            <section className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-xl p-6 shadow-xl shadow-zinc-200/40 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Program</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">示例</span>
                  <select
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value)}
                    className="text-xs font-mono px-2 py-1 bg-zinc-50 border border-zinc-200 rounded"
                  >
                    {SAMPLES.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full min-h-[260px] p-4 bg-zinc-950 text-zinc-100 font-mono text-sm rounded-lg border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                spellCheck={false}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Input</div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full min-h-[90px] p-3 bg-zinc-50 text-zinc-700 font-mono text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Output</div>
                  <div className="w-full min-h-[90px] p-3 bg-zinc-900 text-emerald-200 font-mono text-sm rounded-lg border border-zinc-800 whitespace-pre-wrap break-words">
                    {output || <span className="text-zinc-500">等待输出…</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Memory Window</div>
                <div className="grid grid-cols-6 gap-2">
                  {memoryWindow.map((cell) => (
                    <div
                      key={cell.idx}
                      className={`rounded-md border px-2 py-2 text-[11px] font-mono text-center ${
                        cell.active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-200 bg-white text-zinc-600'
                      }`}
                    >
                      <div>{cell.value}</div>
                      <div className="text-[9px] text-zinc-400">{cell.idx}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-zinc-400">Tape size: {TAPE_SIZE} cells (8-bit wrap)</div>
              </div>
            </section>

            <section className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-xl p-6 shadow-xl shadow-zinc-200/40 space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Controls</div>
                <div className="text-[10px] font-mono text-zinc-500">program length: {program.length}</div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Status</div>
                <div className={`text-[11px] font-mono font-bold ${
                  statusLabel === 'RUNNING'
                    ? 'text-emerald-600'
                    : statusLabel === 'BREAKPOINT'
                      ? 'text-amber-600'
                      : statusLabel === 'ERROR'
                        ? 'text-red-600'
                        : 'text-zinc-600'
                }`}>
                  {statusLabel}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={startRun}
                  disabled={running || !!syntaxError}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running ? '运行中…' : '运行'}
                </button>
                <button
                  onClick={stopRun}
                  disabled={!running}
                  className="px-3 py-2 bg-zinc-100 text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-200 disabled:opacity-50"
                >
                  停止
                </button>
                <button
                  onClick={stepOnce}
                  disabled={running || !!syntaxError}
                  className="px-3 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs font-bold rounded-lg hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                >
                  单步
                </button>
                <button
                  onClick={resetMachine}
                  className="px-3 py-2 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800"
                >
                  重置
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Speed</div>
                <div className="grid grid-cols-4 gap-2">
                  {SPEEDS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSpeedId(s.id)}
                      className={`px-2 py-2 rounded-md text-[10px] font-bold tracking-widest ${
                        speedId === s.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-zinc-400">
                  steps/frame: {speedConfig.stepsPerFrame} {speedConfig.delayMs > 0 ? ` · delay ${speedConfig.delayMs}ms` : ''}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">IP</div>
                  <div className="text-lg font-mono text-zinc-900">{ip}</div>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase">PTR</div>
                  <div className="text-lg font-mono text-zinc-900">{ptr}</div>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 col-span-2">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>Steps</span>
                    <span>{steps}</span>
                  </div>
                  <input
                    type="range"
                    min={10000}
                    max={1000000}
                    step={10000}
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(parseInt(e.target.value, 10))}
                    className="w-full mt-2 accent-blue-600"
                  />
                  <div className="text-[10px] font-mono text-zinc-500 mt-1">步数上限: {maxSteps}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Breakpoints & Jump</div>
                <textarea
                  value={breakpointsText}
                  onChange={(e) => updateBreakpoints(e.target.value)}
                  className="w-full min-h-[64px] p-2 bg-zinc-50 text-zinc-600 font-mono text-xs rounded-md border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="断点位置（0-based，逗号/空格分隔）"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={jumpTarget}
                    onChange={(e) => setJumpTarget(e.target.value)}
                    className="flex-1 px-2 py-2 text-xs font-mono bg-white border border-zinc-200 rounded-md"
                    placeholder="跳转 IP"
                  />
                  <button
                    onClick={jumpToIp}
                    className="px-3 py-2 text-xs font-bold bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
                  >
                    跳转
                  </button>
                </div>
                <div className="text-[10px] font-mono text-zinc-400">断点数量: {breakpointsRef.current.size}</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Import / Export</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={exportProgram}
                    className="px-3 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs font-bold rounded-md hover:border-blue-300 hover:text-blue-600"
                  >
                    导出
                  </button>
                  <button
                    onClick={importProgram}
                    className="px-3 py-2 bg-zinc-100 text-zinc-700 text-xs font-bold rounded-md hover:bg-zinc-200"
                  >
                    导入
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept=".json,.bf,.txt" className="hidden" onChange={onImportFile} />
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-mono p-3">{error}</div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
