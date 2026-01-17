'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { bnFormat, bnGte } from './function/bigNumber';
import { applyMultiplier, multiplierFromLevel } from './function/balance';
import { useFunctionIdle } from './function/useFunctionIdle';
import { GrowthChart } from './components/GrowthChart';
import { SettingsModal } from './components/SettingsModal';

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}天${h}小时`;
  if (h > 0) return `${h}小时${m}分`;
  return `${m}分`;
}

function formatScalar(n: number, fixedDigits: number, expDigits: number): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs >= 1e6 || abs < 1e-3) return n.toExponential(expDigits).replace('e+', 'e');
  return n.toFixed(fixedDigits);
}

export default function Page() {
  const { state, offline, dismissOffline, pointsText, baseText, rText, costs, buyBase, buyR, buyMultiplier, buyBCurve, buyRCurve, prestige, prestigeInfo, history, now, autoBuy, toggleAutoBuy, reset, exportSave, importSave } = useFunctionIdle();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const windowMs = 5 * 60 * 1000;

  useEffect(() => {
    document.documentElement.classList.add('hide-scrollbar');
    document.body.classList.add('hide-scrollbar');
    return () => {
      document.documentElement.classList.remove('hide-scrollbar');
      document.body.classList.remove('hide-scrollbar');
    };
  }, []);

  const affordableBase = state ? bnGte(state.points, costs.base) : false;
  const affordableR = state ? bnGte(state.points, costs.r) : false;
  const affordableMultiplier = state ? bnGte(state.points, costs.multiplier) : false;
  const affordableBCurve = state ? bnGte(state.points, costs.bCurve) : false;
  const affordableRCurve = state ? bnGte(state.points, costs.rCurve) : false;

  const effectiveBase = state ? applyMultiplier(state.base, state.multiplierLevel, state.phi) : null;
  const chartPoints = useMemo(() => history.map(p => ({ t: p.t, y: p.logP })), [history]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-2 px-3 flex flex-col">
      <div className="w-full max-w-screen-2xl mx-auto">
        <div className="flex justify-between items-center mb-3 py-2">
          <div className="w-20" />
          <h1 className="font-bold text-gray-800 text-2xl">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              函数 · 指数挂机
            </Link>
          </h1>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.5A3.5 3.5 0 1012 8.5a3.5 3.5 0 000 7zm8.94-2.01l-1.66-.96a7.63 7.63 0 000-1.06l1.66-.96a.9.9 0 00.33-1.23l-1.7-2.95a.9.9 0 00-1.16-.4l-1.66.96c-.28-.23-.58-.43-.9-.6V3.3a.9.9 0 00-.9-.9H9.7a.9.9 0 00-.9.9v1.92c-.32.17-.62.37-.9.6l-1.66-.96a.9.9 0 00-1.16.4L3.38 8.2a.9.9 0 00.33 1.23l1.66.96a7.63 7.63 0 000 1.06l-1.66.96a.9.9 0 00-.33 1.23l1.7 2.95a.9.9 0 001.16.4l1.66-.96c.28.23.58.43.9.6v1.92c0 .5.4.9.9.9h3.4c.5 0 .9-.4.9-.9v-1.92c.32-.17.62-.37.9-.6l1.66.96a.9.9 0 001.16-.4l1.7-2.95a.9.9 0 00-.33-1.23z" />
            </svg>
            设置
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-5">
          <div className="lg:flex-1 space-y-3">
            <div className="bg-white rounded-xl shadow-md overflow-hidden p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  当前积分 <span className="font-mono font-semibold text-gray-900">{pointsText}</span>
                </div>
                <div className="text-sm text-gray-600">
                  φ <span className="font-mono font-semibold text-gray-900">{state?.phi ?? 0}</span>
                </div>
              </div>
              <GrowthChart points={chartPoints} now={now} windowMs={windowMs} height={480} />
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden p-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ScoreBox title="指数偏置源 b" value={baseText} tone="blue" sub={`Lv.${state?.bLevel ?? 0} · 影响 b`} />
                <ScoreBox title="指数率 r" value={rText} tone="purple" sub={`Lv.${state?.rLevel ?? 0} · 影响 rate`} />
                <ScoreBox title="倍率 m" value={`${formatScalar(multiplierFromLevel(state?.multiplierLevel ?? 0), 2, 3)}×`} tone="gray" sub={`Lv.${state?.multiplierLevel ?? 0}`} />
                <ScoreBox title="有效 b_eff" value={effectiveBase ? bnFormat(effectiveBase, 4) : '...'} tone="gray" sub="用于计算 b 与 rate" />
              </div>
            </div>
          </div>

          <aside className="lg:w-72 xl:w-80 bg-white rounded-xl shadow-md overflow-hidden p-3 mt-3 lg:mt-0">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">升级</h2>
            </div>

            <div className="mt-3 space-y-3">
              <UpgradeCard title="提升 b" formula="b_eff ↑ ⇒ b ↑（指数偏置）" cost={bnFormat(costs.base, 4)} disabled={!affordableBase} onBuy={buyBase} />
              <UpgradeCard title="提升 r" formula="r ↑ ⇒ rate ↑（指数率）" cost={bnFormat(costs.r, 4)} disabled={!affordableR} onBuy={buyR} />
              <UpgradeCard title="提升 m" formula="m ↑ ⇒ b_eff ↑ ⇒ b ↑" cost={bnFormat(costs.multiplier, 4)} disabled={!affordableMultiplier} onBuy={buyMultiplier} />
              <UpgradeCard title="曲率：b" formula="b 的增长斜率 ↑（影响 b_eff）" cost={bnFormat(costs.bCurve, 4)} disabled={!affordableBCurve} onBuy={buyBCurve} />
              <UpgradeCard title="曲率：r" formula="r 的增长斜率 ↑（影响 rate）" cost={bnFormat(costs.rCurve, 4)} disabled={!affordableRCurve} onBuy={buyRCurve} />
            </div>

            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">尺度变换</div>
                  <div className="mt-1 text-xs text-gray-500 font-mono">P → 0，获得 φ</div>
                  <div className="mt-2 text-sm text-gray-700">
                    需要 <span className="font-mono">{bnFormat(prestigeInfo.requirement, 4)}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    收益 <span className="font-mono">+{prestigeInfo.gainPhi}</span> φ
                  </div>
                </div>
                <button
                  onClick={prestige}
                  disabled={!prestigeInfo.available}
                  className={`
                    py-2 px-4 rounded-lg font-medium text-sm transition-colors 
                    justify-center flex items-center
                    ${prestigeInfo.available ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                  `}
                >
                  变换
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              离线时将按上次保存时间自动结算（最多结算 30 天）。
            </div>
          </aside>
        </div>
      </div>

      {offline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <div className="text-lg font-bold text-gray-900">离线结算</div>
            <div className="mt-2 text-sm text-gray-600">离线时长：{formatDuration(offline.offlineSeconds)}</div>
            <div className="mt-4 bg-gray-100 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">获得积分</p>
              <p className="text-xl font-bold text-blue-600 font-mono">{bnFormat(offline.gainedPoints, 4)}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={dismissOffline}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                继续
              </button>
            </div>
          </div>
        </div>
      )}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        autoBuy={autoBuy}
        onToggleAutoBuy={toggleAutoBuy}
        onReset={reset}
        onExport={exportSave}
        onImport={importSave}
      />
    </div>
  );
}

function ScoreBox(props: { title: string; value: string; sub: string; tone: 'blue' | 'purple' | 'gray' }) {
  const valueClass = props.tone === 'blue' ? 'text-blue-600' : props.tone === 'purple' ? 'text-purple-600' : 'text-gray-900';
  return (
    <div className="bg-gray-100 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{props.title}</p>
      <p className={`text-lg font-bold font-mono ${valueClass}`}>{props.value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{props.sub}</p>
    </div>
  );
}

function UpgradeCard(props: { title: string; formula: string; cost: string; disabled: boolean; onBuy: () => void }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{props.title}</div>
          <div className="mt-1 text-xs text-gray-500 font-mono truncate">{props.formula}</div>
          <div className="mt-2 text-sm text-gray-700">
            代价 <span className="font-mono">{props.cost}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onBuy}
          disabled={props.disabled}
          className={`
            py-2 px-4 rounded-lg font-medium text-sm transition-colors 
            justify-center flex items-center whitespace-nowrap
            ${props.disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-800 text-white'}
          `}
        >
          购买
        </button>
      </div>
    </div>
  );
}
