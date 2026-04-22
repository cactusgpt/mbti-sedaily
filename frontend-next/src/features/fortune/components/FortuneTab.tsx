'use client';

import { useState, useCallback, useEffect } from 'react';
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

interface SavedEntry {
  id: number; name: string; date: string; gender: string;
  time: string; region: string; ilgan: string; createdAt: string;
}

const STORAGE_KEY = 'saju_saved';
function getSaved(): SavedEntry[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function setSaved(list: SavedEntry[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

interface FortuneTabProps {
  selectedGroup?: 'NT' | 'NF' | 'ST' | 'SF';
  onMbtiChange?: (group: 'NT' | 'NF' | 'ST' | 'SF') => void;
}

export function FortuneTab({ selectedGroup, onMbtiChange }: FortuneTabProps = {}) {
  const [birthdate, setBirthdate] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [noTime, setNoTime] = useState(false);
  const [gender, setGender] = useState<'남' | '여'>('남');
  const mbtiGroup = selectedGroup ?? 'NF';
  const setMbtiGroup = useCallback((g: 'NT' | 'NF' | 'ST' | 'SF') => {
    if (onMbtiChange) onMbtiChange(g);
  }, [onMbtiChange]);
  const [region, setRegion] = useState('');
  const [result, setResult] = useState<SajuData | null>(null);
  const [error, setError] = useState('');
  const [savedList, setSavedList] = useState<SavedEntry[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');

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
          if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
            hr = hh;
            mn = mm;
          }
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

      setResult({
        pillars: ps, ilgan: il, year: y, month: m, day: d, gender: g,
        chongun, todayFortune, daeuns, yeonuns, woluns,
        correctedTime: s.isTimeCorrected && s.correctedTime ? s.correctedTime : undefined,
      });
      setError('');
    } catch (err) {
      setError('계산 오류: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const handleCalculate = useCallback(() => {
    const parsed = parseDateStr(birthdate);
    if (!parsed) { setError('생년월일을 정확히 입력해주세요.'); return; }
    const { y, m, d } = parsed;
    if (y < 1900 || y > 2050) { setError('1900~2050년 범위만 지원합니다.'); return; }
    doCalculate(y, m, d, gender, timeInput, noTime, region);
    setShowForm(false);
  }, [birthdate, timeInput, noTime, gender, region, parseDateStr, doCalculate]);

  const today = new Date();
  const todayLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div className="max-w-[480px] mx-auto -my-6" style={{ background: '#F2F4F7', minHeight: 'calc(100vh + 48px)' }}>
      {/* 흰색 헤더 블록 (오늘의 운세 + 성향 토글) */}
      <div className="bg-white" style={{ padding: '20px 20px 18px' }}>
        {/* 날짜 + 아이콘 */}
        <div className="flex items-center justify-between mb-1">
          <div className="text-[13px] text-gray-500 font-medium tracking-tight">{todayLabel}</div>
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
        </div>
        <h2 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.04em] mb-5">오늘의 운세</h2>

        {/* MBTI 그룹 */}
        <div className="flex gap-1.5">
          {([
            { id: 'NT' as const, name: '분석가' },
            { id: 'NF' as const, name: '이야기꾼' },
            { id: 'ST' as const, name: '실용주의자' },
            { id: 'SF' as const, name: '공감러' },
          ]).map(g => (
            <button key={g.id} type="button" onClick={() => setMbtiGroup(g.id)}
              className={`flex-1 py-2.5 text-[13px] rounded-full font-semibold tracking-[-0.02em] transition-colors ${
                mbtiGroup === g.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}>
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* 회색 콘텐츠 영역 */}
      <div style={{ padding: '14px 14px 40px' }}>
      {/* 입력 폼 — 결과가 있으면 접힘 */}
      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-[16px] p-5 mb-4">
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
        </div>
      ) : result ? (() => {
        const EL_BG: Record<string, string> = {
          '목': 'bg-green-50 text-green-700',
          '화': 'bg-red-50 text-red-600',
          '토': 'bg-yellow-50 text-yellow-700',
          '금': 'bg-gray-100 text-gray-700',
          '수': 'bg-blue-50 text-blue-700',
        };
        const ilganOh = CG_OH[result.ilgan] || '';
        const parsed = parseDateStr(birthdate);
        const dateLabel = parsed ? `${parsed.y}년 ${parsed.m}월 ${parsed.d}일` : '';
        const timeLabel = noTime || !timeInput ? '시간 모름' : timeInput;
        const regionLabel = REGION_OPTIONS.find(r => r.value === region)?.label || '';

        // 경도 보정 분 차이
        let offsetLabel = '';
        if (result.correctedTime && !noTime) {
          const raw = timeInput.replace(/[^0-9]/g, '');
          if (raw.length === 4) {
            const inMin = parseInt(raw.slice(0, 2)) * 60 + parseInt(raw.slice(2, 4));
            const outMin = result.correctedTime.hour * 60 + result.correctedTime.minute;
            const diff = outMin - inMin;
            if (diff !== 0) offsetLabel = ` (경도보정 ${diff > 0 ? '+' : ''}${diff}분)`;
          }
        }

        const subtitle = [gender, regionLabel].filter(Boolean).join(' · ') + offsetLabel;

        return (
          <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center font-serif text-[16px] font-bold shrink-0 ${EL_BG[ilganOh] || 'bg-gray-50 text-gray-400'}`}>
                {result.ilgan || '—'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-gray-900 truncate">
                  {dateLabel}{!noTime && timeInput && ` ${timeLabel}`}
                </div>
                <div className="text-[11px] text-gray-400 truncate">{subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="shrink-0 border-none rounded-lg cursor-pointer px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                다시 입력
              </button>
            </div>
          </div>
        );
      })() : null}

      {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}

      {/* 결과 */}
      {result && (
        <>
          <FortuneResult data={result} mbtiGroup={mbtiGroup} />
          <button
            onClick={() => {
              const parsed = parseDateStr(birthdate);
              setSaveName(parsed ? `${parsed.y}.${parsed.m}.${parsed.d}` : '');
              setShowSaveModal(true);
            }}
            className="w-full mt-4 mb-8 py-3 text-[14px] font-semibold bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
          >
            저장하기
          </button>
        </>
      )}

      {/* 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-[320px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-gray-900 mb-1">만세력 저장</h3>
            <p className="text-[12px] text-gray-400 mb-4">저장할 이름을 입력해주세요</p>
            <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
              placeholder="예) 홍길동" maxLength={20} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { handleSave(); } if (e.key === 'Escape') setShowSaveModal(false); }}
              className="w-full px-3 py-2.5 text-[14px] border border-gray-200 rounded-lg outline-none focus:border-gray-400 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2.5 text-[13px] font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all">취소</button>
              <button onClick={handleSave} className="flex-1 py-2.5 text-[13px] font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 목록 */}
      {savedList.length > 0 && (
        <div className="mt-8">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-3">저장된 만세력</h3>
          <div className="space-y-2">
            {savedList.map(item => (
              <div key={item.id} onClick={() => handleLoad(item)}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all">
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-gray-900 mr-2">{item.name}</span>
                  <span className="text-[11px] text-gray-400">
                    {item.date.replace(/-/g, '.')} {item.time && `${item.time}`} · {item.gender}
                  </span>
                </div>
                {item.ilgan && (() => {
                  const hanja = item.ilgan.length >= 2 ? item.ilgan[1] : '';
                  const oh = CG_OH[hanja] || '';
                  const colorMap: Record<string, string> = { '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600', '금': 'text-gray-500', '수': 'text-blue-600' };
                  return <span className={`text-[13px] font-bold ml-2 ${colorMap[oh] || 'text-gray-600'}`}>{item.ilgan}</span>;
                })()}
                <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                  className="ml-2 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors text-[16px]">&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );

  function handleSave() {
    if (!result) return;
    const parsed = parseDateStr(birthdate);
    if (!parsed) return;
    const name = saveName.trim() || `${parsed.y}.${parsed.m}.${parsed.d}`;
    const entry: SavedEntry = {
      id: Date.now(), name,
      date: `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`,
      gender, time: timeInput, region,
      ilgan: result.pillars[1].ck && result.ilgan ? result.pillars[1].ck + result.ilgan : '',
      createdAt: new Date().toISOString(),
    };
    const list = [entry, ...getSaved()];
    setSaved(list); setSavedList(list);
    setShowSaveModal(false);
  }

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
    setShowForm(false);
  }

  function handleDelete(id: number) {
    const list = getSaved().filter(x => x.id !== id);
    setSaved(list); setSavedList(list);
  }
}
