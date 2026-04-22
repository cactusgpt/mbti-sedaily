'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  calculateSaju, parsePillar, CG_OH,
  buildChongun, buildTodayFortune, calcDaeun, calcYeonun, calcWolun,
  matchSijin, REGION_OPTIONS,
  type Pillar, type ChongunResult, type TodayFortuneResult,
  type DaeunEntry, type YeonunEntry, type WolunEntry,
} from '../lib/engine';

export interface SajuCalcResult {
  pillars: Pillar[];
  ilgan: string;
  year: number; month: number; day: number;
  gender: string;
  timeInput: string;
  region: string;
  chongun: ChongunResult | null;
  todayFortune: TodayFortuneResult | null;
  daeuns: DaeunEntry[];
  yeonuns: YeonunEntry[];
  woluns: WolunEntry[];
  correctedTime?: { hour: number; minute: number };
}

interface SavedEntry {
  id: number; name: string; date: string; gender: string;
  time: string; region: string; ilgan: string; createdAt: string;
}

const STORAGE_KEY_SAVED = 'saju_saved';
const STORAGE_KEY_CURRENT = 'saju_current';

function getSaved(): SavedEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED) || '[]'); } catch { return []; }
}

function setSaved(list: SavedEntry[]) {
  localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(list));
}

interface Props {
  /** 이전에 계산된 결과(상위에서 주입) — 프리필 + '현재' 배지 매칭용 */
  initial?: {
    birthdate?: string;
    timeInput?: string;
    noTime?: boolean;
    gender?: '남' | '여';
    region?: string;
  };
  /** 계산 성공 시 호출 — 상위 페이지가 state 업데이트/렌더 트리거 */
  onCalculated?: (saju: SajuCalcResult) => void;
  /** 제출 버튼 라벨 (기본 '운세 보러가기') */
  submitLabel?: string;
}

export function SajuInputPanel({ initial, onCalculated, submitLabel = '운세 보러가기' }: Props) {
  const [birthdate, setBirthdate] = useState(initial?.birthdate ?? '');
  const [timeInput, setTimeInput] = useState(initial?.timeInput ?? '');
  const [noTime, setNoTime] = useState(initial?.noTime ?? false);
  const [gender, setGender] = useState<'남' | '여'>(initial?.gender ?? '남');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [error, setError] = useState('');
  const [savedList, setSavedList] = useState<SavedEntry[]>([]);
  const [savedExpanded, setSavedExpanded] = useState(false);

  useEffect(() => { setSavedList(getSaved()); }, []);

  const parseDateStr = useCallback((val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    if (raw.length !== 8) return null;
    const y = parseInt(raw.slice(0, 4));
    const m = parseInt(raw.slice(4, 6));
    const d = parseInt(raw.slice(6, 8));
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const test = new Date(y, m - 1, d);
    if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) return null;
    return { y, m, d };
  }, []);

  const handleDateInput = useCallback((val: string) => {
    let raw = val.replace(/[^0-9]/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);
    if (raw.length >= 7) setBirthdate(raw.slice(0, 4) + ' / ' + raw.slice(4, 6) + ' / ' + raw.slice(6));
    else if (raw.length >= 5) setBirthdate(raw.slice(0, 4) + ' / ' + raw.slice(4));
    else setBirthdate(raw);
  }, []);

  const handleTimeInput = useCallback((val: string) => {
    let raw = val.replace(/[^0-9]/g, '');
    if (raw.length > 4) raw = raw.slice(0, 4);
    setTimeInput(raw.length >= 3 ? raw.slice(0, 2) + ':' + raw.slice(2) : raw);
    if (raw.length === 4) setNoTime(false);
  }, []);

  const timeSijin = (() => {
    const raw = timeInput.replace(/[^0-9]/g, '');
    if (raw.length !== 4) return undefined;
    const hh = parseInt(raw.slice(0, 2));
    const mm = parseInt(raw.slice(2, 4));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
    return matchSijin(hh, mm);
  })();

  const isDateValid = parseDateStr(birthdate) !== null;

  const doCalculate = useCallback((y: number, m: number, d: number, g: string, timeStr: string, isNoTime: boolean, reg: string) => {
    try {
      const opts: { longitude?: number; applyTimeCorrection?: boolean } = {};
      if (reg) { opts.longitude = parseFloat(reg); opts.applyTimeCorrection = true; }
      let hr: number | undefined;
      let mn = 0;
      if (!isNoTime) {
        const raw = timeStr.replace(/[^0-9]/g, '');
        if (raw.length === 4) {
          const hh = parseInt(raw.slice(0, 2));
          const mm = parseInt(raw.slice(2, 4));
          if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) { hr = hh; mn = mm; }
        }
      }
      const s = calculateSaju(y, m, d, hr, mn, opts);
      const ps = [
        parsePillar(s.hourPillar ?? '', s.hourPillarHanja ?? ''),
        parsePillar(s.dayPillar ?? '', s.dayPillarHanja ?? ''),
        parsePillar(s.monthPillar ?? '', s.monthPillarHanja ?? ''),
        parsePillar(s.yearPillar ?? '', s.yearPillarHanja ?? ''),
      ];
      const il = ps[1].c;
      const chongun = buildChongun(ps);
      const todayFortune = buildTodayFortune(ps);
      const { daeuns } = il ? calcDaeun(s, g, y, m, d) : { daeuns: [] };
      const yeonuns = il ? calcYeonun() : [];
      const woluns = il ? calcWolun() : [];

      const result: SajuCalcResult = {
        pillars: ps, ilgan: il, year: y, month: m, day: d, gender: g,
        timeInput: isNoTime ? '' : timeStr,
        region: reg,
        chongun, todayFortune, daeuns, yeonuns, woluns,
        correctedTime: s.isTimeCorrected && s.correctedTime ? s.correctedTime : undefined,
      };

      try {
        localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({
          year: y, month: m, day: d, gender: g,
          timeInput: isNoTime ? '' : timeStr,
          region: reg,
          pillars: ps, ilgan: il,
          correctedTime: result.correctedTime,
          daeuns,
        }));
      } catch {}

      setError('');
      onCalculated?.(result);
    } catch (err) {
      setError('계산 오류: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [onCalculated]);

  const handleCalculate = useCallback(() => {
    const parsed = parseDateStr(birthdate);
    if (!parsed) { setError('생년월일을 정확히 입력해주세요.'); return; }
    const { y, m, d } = parsed;
    if (y < 1900 || y > 2050) { setError('1900~2050년 범위만 지원합니다.'); return; }
    doCalculate(y, m, d, gender, timeInput, noTime, region);
  }, [birthdate, timeInput, noTime, gender, region, parseDateStr, doCalculate]);

  function handleLoad(entry: SavedEntry) {
    const dp = entry.date.replace(/-/g, '');
    setBirthdate(dp.slice(0, 4) + ' / ' + dp.slice(4, 6) + ' / ' + dp.slice(6, 8));
    setGender(entry.gender as '남' | '여');
    if (entry.time) { setTimeInput(entry.time); setNoTime(false); }
    else { setTimeInput(''); setNoTime(true); }
    setRegion(entry.region || '');
    const y = parseInt(dp.slice(0, 4));
    const m = parseInt(dp.slice(4, 6));
    const d = parseInt(dp.slice(6, 8));
    doCalculate(y, m, d, entry.gender, entry.time || '', !entry.time, entry.region || '');
  }

  function handleDelete(id: number) {
    const list = getSaved().filter(x => x.id !== id);
    setSaved(list); setSavedList(list);
  }

  // 현재 매칭
  const parsedNow = parseDateStr(birthdate);
  const currentSavedId = parsedNow ? savedList.find(it => {
    const parts = it.date.split('-').map(Number);
    return parts[0] === parsedNow.y && parts[1] === parsedNow.m && parts[2] === parsedNow.d
      && it.gender === gender
      && (it.time || '') === (noTime ? '' : timeInput)
      && (it.region || '') === (region || '');
  })?.id ?? null : null;

  return (
    <div>
      {/* 입력 폼 */}
      <div className="bg-white border border-gray-200 rounded-[16px] p-5 mb-4">
        <div className="mb-6">
          <label className="block text-[13px] font-semibold text-gray-800 mb-2">성별</label>
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
            {(['남', '여'] as const).map(g => (
              <button key={g} type="button" onClick={() => setGender(g)}
                className={`flex-1 py-3 text-[15px] transition-all relative ${gender === g ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                {g}
                {gender === g && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-gray-900 rounded" />}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-[13px] font-semibold text-gray-800 mb-2">생년월일시</label>
          <div className="flex gap-2">
            <input type="text" inputMode="numeric" maxLength={14} placeholder="YYYY / MM / DD"
              value={birthdate} onChange={e => handleDateInput(e.target.value)}
              className="flex-1 px-3.5 py-3 text-[15px] bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 placeholder:text-gray-300" />
            <div className="relative flex-1">
              <input type="text" inputMode="numeric" maxLength={5} placeholder="HH:MM"
                value={timeInput} onChange={e => handleTimeInput(e.target.value)}
                disabled={noTime}
                className={`w-full px-3.5 py-3 text-[15px] text-center tracking-widest tabular-nums bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 placeholder:text-gray-300 ${noTime ? 'opacity-35' : ''}`} />
              {timeSijin && (
                <div className="absolute -bottom-5 left-0 right-0 text-center text-[11px] text-gray-400">{timeSijin.label}</div>
              )}
            </div>
          </div>
          <label className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-gray-400 cursor-pointer">
            <input type="checkbox" checked={noTime} onChange={e => { setNoTime(e.target.checked); if (e.target.checked) setTimeInput(''); }}
              className="w-[15px] h-[15px] accent-gray-900" />
            시간 모름
          </label>
        </div>

        <div className="mb-8">
          <label className="block text-[13px] font-semibold text-gray-800 mb-2">도시</label>
          <select value={region} onChange={e => setRegion(e.target.value)}
            className="w-full px-3.5 py-3 text-[15px] bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' stroke='%23aaa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
            {REGION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <button type="button" onClick={handleCalculate}
          className={`w-full py-3.5 text-[15px] font-semibold rounded-xl transition-all ${isDateValid ? 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          disabled={!isDateValid}>
          {submitLabel}
        </button>
        {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
      </div>

      {/* 저장된 만세력 */}
      {savedList.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-3">저장된 만세력</h3>
          <div className="space-y-2">
            {(savedExpanded ? savedList : savedList.slice(0, 3)).map(item => {
              const isCurrent = item.id === currentSavedId;
              return (
                <div key={item.id} onClick={() => handleLoad(item)}
                  className={`flex items-center justify-between px-4 py-3 bg-white rounded-xl cursor-pointer transition-all ${
                    isCurrent ? 'border-2 border-green-500 bg-green-50/50' : 'border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  {isCurrent && (
                    <span className="shrink-0 mr-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-600 text-white">현재</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      <span className="text-[13px] font-semibold text-gray-900 mr-2">{item.name}</span>
                      <span className="text-[11px] text-gray-400">
                        {item.date.replace(/-/g, '.')} {item.time && `${item.time}`} · {item.gender}
                      </span>
                    </div>
                  </div>
                  {item.ilgan && (() => {
                    const hanja = item.ilgan.length >= 2 ? item.ilgan[1] : '';
                    const oh = CG_OH[hanja] || '';
                    const colorMap: Record<string, string> = { '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600', '금': 'text-gray-500', '수': 'text-blue-600' };
                    return <span className={`shrink-0 text-[13px] font-bold ml-2 ${colorMap[oh] || 'text-gray-600'}`}>{item.ilgan}</span>;
                  })()}
                  <button type="button" onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    className="shrink-0 ml-2 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 text-[16px]">&times;</button>
                </div>
              );
            })}
          </div>
          {savedList.length > 3 && (
            <button type="button" onClick={() => setSavedExpanded(v => !v)}
              className="w-full mt-2 flex items-center justify-center gap-1 py-2 text-[12px] font-semibold text-gray-500 hover:text-gray-700">
              {savedExpanded ? '접기' : `${savedList.length - 3}개 더 보기`}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: savedExpanded ? 'rotate(180deg)' : 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Public API: also export for FortuneTab's legacy usage (not used there yet)
export type { SavedEntry };
