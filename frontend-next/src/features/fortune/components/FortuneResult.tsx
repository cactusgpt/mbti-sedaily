import { CG_OH, JJ_OH, OH_HJ, JJG, sipsung, unsung, type Pillar, type ChongunResult, type TodayFortuneResult, type DaeunEntry, type YeonunEntry, type WolunEntry } from '../lib/engine';
import { SajuTable } from './SajuTable';
import { DailyCalendar } from './DailyCalendar';

const EL_COLORS: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500', '수': 'text-blue-600',
};

interface Props {
  data: {
    pillars: Pillar[]; ilgan: string;
    year: number; month: number; day: number; gender: string;
    chongun: ChongunResult | null; todayFortune: TodayFortuneResult | null;
    daeuns: DaeunEntry[]; yeonuns: YeonunEntry[]; woluns: WolunEntry[];
    correctedTime?: { hour: number; minute: number };
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
      <h3 className="text-[14px] font-bold text-gray-900 mb-3">{title}</h3>
      <div className="text-[13px] text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}

function UnGrid({ title, cols, ilgan, activeCheck }: {
  title: string;
  cols: { c: string; j: string; ck: string; jk: string; label: string }[];
  ilgan: string;
  activeCheck?: (col: { c: string; j: string; ck: string; jk: string; label: string } & Record<string, unknown>) => boolean;
}) {
  return (
    <div className="mb-4">
      <div className="text-[12px] font-semibold text-gray-500 mb-2">{title}</div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {cols.map((col, i) => {
            const isActive = activeCheck ? activeCheck(col) : false;
            const cgOh = CG_OH[col.c] || ''; const jjOh = JJ_OH[col.j] || '';
            const cgSS = sipsung(ilgan, col.c);
            const jjMain = col.j && JJG[col.j] ? JJG[col.j][JJG[col.j].length - 1] : null;
            const jjSS = jjMain ? sipsung(ilgan, jjMain) : '';
            const us = unsung(ilgan, col.j);
            return (
              <div key={i} className={`flex flex-col items-center w-[72px] py-2 px-1 rounded-lg border text-center flex-shrink-0 ${isActive ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-gray-500 font-medium mb-1">{col.label}</div>
                <div className="text-[10px] text-gray-400">{cgSS}</div>
                <div className={`text-[16px] font-bold my-0.5 ${EL_COLORS[cgOh] || ''}`}>{col.ck}{col.c}</div>
                <div className={`text-[16px] font-bold my-0.5 ${EL_COLORS[jjOh] || ''}`}>{col.jk}{col.j}</div>
                <div className="text-[10px] text-gray-400">{jjSS}</div>
                <div className="text-[10px] text-gray-400">{us}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function FortuneResult({ data }: Props) {
  const { pillars, ilgan, year, month, day, gender, chongun, todayFortune, daeuns, yeonuns, woluns, correctedTime } = data;
  const oh = CG_OH[ilgan] || '';
  const now = new Date();
  const currentAge = now.getFullYear() - year;

  return (
    <div className="mt-8">
      <SajuTable pillars={pillars} ilgan={ilgan} />

      {/* 기본 정보 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 text-[13px]">
        <div className="flex justify-between py-1"><span className="text-gray-400">양력</span><span>{year}년 {month}월 {day}일</span></div>
        <div className="flex justify-between py-1"><span className="text-gray-400">성별</span><span>{gender}</span></div>
        {correctedTime && <div className="flex justify-between py-1"><span className="text-gray-400">보정시간</span><span>{correctedTime.hour}시 {correctedTime.minute}분</span></div>}
        {ilgan && (
          <>
            <div className="border-t border-gray-100 my-2" />
            <div className="flex justify-between py-1">
              <span className="text-gray-400">일간</span>
              <span><strong className={EL_COLORS[oh]}>{pillars[1].ck}{ilgan}</strong> {oh}({OH_HJ[oh]})</span>
            </div>
          </>
        )}
      </div>

      {/* 총운 */}
      {chongun && (
        <Section title="총운">
          <p className="mb-3">
            <strong className={EL_COLORS[chongun.element]}>{chongun.symbol}</strong>의 기운을 타고난 <strong>{chongun.yinyang}{chongun.element}</strong> 일간입니다. {chongun.nature}
          </p>
          {chongun.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {chongun.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-full">{kw}</span>
              ))}
            </div>
          )}
          {chongun.season && (
            <p className="mb-3">
              <strong>{chongun.season.name}</strong>에 태어났습니다. {chongun.season.desc} {chongun.seasonRelation}
            </p>
          )}
          {chongun.iljuReading && <p className="mb-3">{chongun.iljuReading}</p>}
        </Section>
      )}

      {/* 상세 해석 */}
      {chongun?.detail && (
        <Section title="상세 해석">
          <p className="mb-3">{chongun.detail.summary}</p>
          <div className="mb-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">표현/행동 양식</div>
            <p>{chongun.detail.behavior}</p>
          </div>
          <div className="mb-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">대인 관계</div>
            <p>{chongun.detail.social}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[12px] font-semibold text-green-600 mb-1">강점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.detail.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-red-400 mb-1">약점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.detail.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
          <div className="mb-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">개선 방안</div>
            <p>{chongun.detail.improvement}</p>
          </div>
          {chongun.detail.jobs.length > 0 && (
            <div className="mb-3">
              <div className="text-[12px] font-semibold text-gray-700 mb-1">추천 직업</div>
              <div className="space-y-1.5">
                {chongun.detail.jobs.map((j, i) => (
                  <div key={i} className="text-[12px]"><strong>{j.field}</strong> — {j.role} <span className="text-gray-400">({j.reason})</span></div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[12px] italic text-gray-500">{chongun.detail.conclusion}</p>
          </div>
        </Section>
      )}

      {/* 일지 상세 */}
      {chongun?.iljiDetail && (
        <Section title="일지(日支) 해석">
          <p className="mb-3">{chongun.iljiDetail.summary}</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[12px] font-semibold text-green-600 mb-1">강점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.iljiDetail.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-red-400 mb-1">약점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.iljiDetail.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
          <p className="text-[12px] italic text-gray-500">{chongun.iljiDetail.conclusion}</p>
        </Section>
      )}

      {/* 오늘의 운세 */}
      {todayFortune && (
        <Section title="오늘의 운세">
          <p className="mb-3">
            오늘은 <strong className={EL_COLORS[todayFortune.dayOh]}>{todayFortune.dayPillar}({todayFortune.dayPillarHanja})</strong>일입니다.
            나의 일간 기준 <strong>{todayFortune.ss}</strong>의 날이며, 12운성은 <strong>{todayFortune.us}</strong>입니다.
          </p>
          {todayFortune.ssReading && <p className="mb-3">{todayFortune.ssReading}</p>}
          <p className={todayFortune.sinsal.length ? 'mb-3' : ''}>12운성 <strong>{todayFortune.us}</strong> — {todayFortune.usReading}</p>
          {todayFortune.sinsal.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              {todayFortune.sinsal.map((s, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold mr-1.5 border ${s.good === true ? 'text-green-600 border-green-200' : s.good === false ? 'text-red-500 border-red-200' : 'text-yellow-600 border-yellow-200'}`}>
                    {s.name}
                  </span>
                  <span className="text-[12px] text-gray-500">{s.desc}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* 대운 · 연운 · 월운 */}
      {ilgan && daeuns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <UnGrid title="대운" cols={daeuns.map(x => ({ ...x, label: `${x.age}세` }))} ilgan={ilgan}
            activeCheck={(col) => currentAge >= (col as unknown as DaeunEntry).age && currentAge < (col as unknown as DaeunEntry).age + 10} />
          <div className="border-t border-gray-100 my-3" />
          <UnGrid title="연운" cols={yeonuns.map(x => ({ ...x, label: `${x.year}` }))} ilgan={ilgan}
            activeCheck={(col) => (col as unknown as YeonunEntry).year === now.getFullYear()} />
          <div className="border-t border-gray-100 my-3" />
          <UnGrid title="월운" cols={woluns.map(x => ({ ...x, label: `${x.month}월` }))} ilgan={ilgan}
            activeCheck={(col) => (col as unknown as WolunEntry).month === now.getMonth() + 1} />
        </div>
      )}

      {/* 일진 달력 */}
      {ilgan && <DailyCalendar ilgan={ilgan} />}
    </div>
  );
}
