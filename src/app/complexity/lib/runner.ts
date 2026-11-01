'use client';

/**
 * 用户代码执行器。
 *
 * 在 Web Worker 里跑用户提交的 `solve(input)`，与主线程隔离：
 * - 死循环不会卡死页面，随时可以手动中止
 * - 拿不到 DOM，误操作不会污染当前页面
 *
 * **不设执行时限**：这里是用来做研究、试算法的，不是判题竞赛。
 * 跑到一半发现不对，点「停止」即可（内部 terminate worker）。
 *
 * 注意：这是浏览器内的隔离，仅用于运行**用户自己写的代码**，
 * 不能当作执行不可信第三方代码的安全边界。
 */

export interface RunOutcome<T = unknown> {
  ok: boolean;
  value?: T;
  error?: string;
  ms: number;
  /** 被用户手动中止 */
  aborted?: boolean;
}

const WORKER_SRC = `
self.onmessage = function (e) {
  var code = e.data.code;
  var input = e.data.input;
  var reply = function (o) { self.postMessage(o); };
  try {
    var factory = new Function(code + "\\n;return typeof solve === 'function' ? solve : undefined;");
    var solve = factory();
    if (typeof solve !== 'function') {
      reply({ ok: false, error: '未找到 solve 函数，请定义 function solve(input) { ... }' });
      return;
    }
    var out = solve(input);
    if (out && typeof out.then === 'function') {
      out.then(
        function (v) { reply({ ok: true, value: v }); },
        function (err) { reply({ ok: false, error: String((err && err.stack) || err) }); }
      );
    } else {
      reply({ ok: true, value: out });
    }
  } catch (err) {
    reply({ ok: false, error: String((err && err.stack) || err) });
  }
};
`;

export function runUserCode<T = unknown>(
  code: string,
  input: unknown,
  signal?: AbortSignal,
): Promise<RunOutcome<T>> {
  return new Promise<RunOutcome<T>>((resolve) => {
    const started = performance.now();
    let settled = false;
    let url = '';
    let worker: Worker | null = null;

    const elapsed = () => Math.round(performance.now() - started);

    const finish = (outcome: RunOutcome<T>) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', handleAbort);
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
      resolve(outcome);
    };

    const handleAbort = () => finish({ ok: false, aborted: true, error: '已手动中止', ms: elapsed() });

    if (signal?.aborted) {
      resolve({ ok: false, aborted: true, error: '已手动中止', ms: 0 });
      return;
    }
    signal?.addEventListener('abort', handleAbort);

    try {
      url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = (e: MessageEvent<{ ok: boolean; value?: T; error?: string }>) => {
        finish({ ...e.data, ms: elapsed() });
      };
      worker.onerror = (e) => {
        finish({ ok: false, error: e.message || '运行时错误', ms: elapsed() });
      };
      worker.postMessage({ code, input });
    } catch (err) {
      finish({ ok: false, error: String(err), ms: 0 });
    }
  });
}
