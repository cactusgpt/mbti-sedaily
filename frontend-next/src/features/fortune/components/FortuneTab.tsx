'use client';

import { useState, useCallback } from 'react';
import {
  calculateSaju, parsePillar, sipsung, unsung, elClass,
  CG_OH, JJ_OH, OH_HJ, JJG,
  buildChongun, buildTodayFortune, calcDaeun, calcYeonun, calcWolun,
  matchSijin, REGION_OPTIONS,
  type Pillar, type ChongunResult, type TodayFortuneResult, type DaeunEntry, type YeonunEntry, type WolunEntry,
} from '../lib/engine';
import { SajuTable } from './SajuTable';
import { FortuneResult } from './FortuneResult';

interface SajuData {
  pillars: Pillar[];
  ilgan: string;
  year: number; month: number; day: number;
  gender: string;
  chongun: ChongunResult | null;
  todayFortune: TodayFortuneResult | null;
  daeuns: DaeunEntry[];
  yeonuns: YeonunEntry[];
  woluns: WolunEntry[];
  correctedTime?: { hour: number; minute: number };
}

export function FortuneTab() {
  const [birthdate, setBirthdate] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [noTime, setNoTime] = useState(false);
  const [gender, setGender] = useState<'남' | '여'>('남');
  const [region, setRegion] = useState('');
  const [result, setResult] = useState<SajuData | null>(null);
  const [error, setError] = useState('');

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

  const getTimeSijin = useCallback(() => {
    const raw = timeInput.replace(/[^0-9]/g, '');
    if (raw.length !== 4) return undefined;
    const hh = parseInt(raw.slice(0, 2));
    const mm = parseInt(raw.slice(2, 4));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
    const m = matchSijin(hh, mm);
    return m ? m.value : undefined;
  }, [timeInput]);

  const timeSijin = getTimeSijin();
  const timeBadgeLabel = timeSijin !== undefined ? matchSijin(
    parseInt(timeInput.replace(/[^0-9]/g, '').slice(0, 2)),
    parseInt(timeInput.replace(/[^0-9]/g, '').slice(2, 4))
  )?.label : undefined;

  const isDateValid = parseDateStr(birthdate) !== null;

  const handleCalculate = useCallback(() => {
    const parsed = parseDateStr(birthdate);
    if (!parsed) { setError('생년월일을 정확히 입력해주세요.'); return; }
    const { y, m, d } = parsed;
    if (y < 1900 || y > 2050) { setError('1900~2050년 범위만 지원합니다.'); return; }
    setError('');

    try {
      const opts: { longitude?: number; applyTimeCorrection?: boolean } = {};
      if (region) { opts.longitude = parseFloat(region); opts.applyTimeCorrection = true; }
      const hr = noTime ? undefined : timeSijin;
      const s = calculateSaju(y, m, d, hr, 0, opts);
      const ps = [
        parsePillar(s.hourPillar ?? '', s.hourPillarHanja ?? ''),
        parsePillar(s.dayPillar ?? '', s.dayPillarHanja ?? ''),
        parsePillar(s.monthPillar ?? '', s.monthPillarHanja ?? ''),
        parsePillar(s.yearPillar ?? '', s.yearPillarHanja ?? ''),
      ];
      const il = ps[1].c;
      const chongun = buildChongun(ps);
      const todayFortune = buildTodayFortune(ps);
      const now = new Date();
      const { daeuns } = il ? calcDaeun(s, gender, y, m, d) : { daeuns: [] };
      const yeonuns = il ? calcYeonun() : [];
      const woluns = il ? calcWolun() : [];

      setResult({
        pillars: ps, ilgan: il, year: y, month: m, day: d, gender,
        chongun, todayFortune, daeuns, yeonuns, woluns,
        correctedTime: s.isTimeCorrected && s.correctedTime ? s.correctedTime : undefined,
      });
    } catch (err) {
      setError('계산 오류: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [birthdate, timeInput, noTime, gender, region, timeSijin, parseDateStr]);

  return (
    <div className="max-w-[480px] mx-auto">
      <h2 className="text-[22px] font-bold text-gray-900 mb-6">오늘의 운세</h2>
      {/* 성별 */}
      <div className="mb-6">
        <label className="block text-[13px] font-semibold text-gray-800 mb-2">성별</label>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
          {(['남', '여'] as const).map(g => (
            <button key={g} onClick={() => setGender(g)}
              className={`flex-1 py-3 text-[15px] transition-all relative ${gender === g ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              {g}
              {gender === g && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-gray-900 rounded" />}
            </button>
          ))}
        </div>
      </div>

      {/* 생년월일시 */}
      <div className="mb-6">
        <label className="block text-[13px] font-semibold text-gray-800 mb-2">생년월일시</label>
        <div className="flex gap-2">
          <input type="text" inputMode="numeric" maxLength={14} placeholder="YYYY / MM / DD"
            value={birthdate} onChange={e => handleDateInput(e.target.value)}
            className="flex-1 px-3.5 py-3 text-[15px] bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 placeholder:text-gray-300 transition-all" />
          <div className="relative flex-1">
            <input type="text" inputMode="numeric" maxLength={5} placeholder="HH:MM"
              value={timeInput} onChange={e => handleTimeInput(e.target.value)}
              disabled={noTime}
              className={`w-full px-3.5 py-3 text-[15px] text-center tracking-widest tabular-nums bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 placeholder:text-gray-300 transition-all ${noTime ? 'opacity-35' : ''}`} />
            {timeBadgeLabel && (
              <div className="absolute -bottom-5 left-0 right-0 text-center text-[11px] text-gray-400">{timeBadgeLabel}</div>
            )}
          </div>
        </div>
        <label className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-gray-400 cursor-pointer hover:text-gray-600 transition-colors">
          <input type="checkbox" checked={noTime} onChange={e => { setNoTime(e.target.checked); if (e.target.checked) setTimeInput(''); }}
            className="w-[15px] h-[15px] accent-gray-900 cursor-pointer" />
          시간 모름
        </label>
      </div>

      {/* 도시 */}
      <div className="mb-8">
        <label className="block text-[13px] font-semibold text-gray-800 mb-2">도시</label>
        <select value={region} onChange={e => setRegion(e.target.value)}
          className="w-full px-3.5 py-3 text-[15px] bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 appearance-none cursor-pointer transition-all"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' stroke='%23aaa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
          {REGION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* 버튼 */}
      <button onClick={handleCalculate}
        className={`w-full py-3.5 text-[15px] font-semibold rounded-xl transition-all ${isDateValid ? 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        disabled={!isDateValid}>
        운세 보러가기
      </button>

      {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}

      {/* 결과 */}
      {result && (
        <FortuneResult data={result} />
      )}
    </div>
  );
}
