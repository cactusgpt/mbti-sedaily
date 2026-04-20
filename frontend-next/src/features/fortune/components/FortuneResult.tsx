import { useState, useEffect } from 'react';
import { isBeforeLichun, getSajuMonth } from '@fullstackfamily/manseryeok';
import { CG_OH, JJ_OH, OH_HJ, JJG, sipsung, unsung, type Pillar, type ChongunResult, type TodayFortuneResult, type DaeunEntry, type YeonunEntry, type WolunEntry } from '../lib/engine';
import { SajuTable } from './SajuTable';
import { DailyCalendar } from './DailyCalendar';

type MbtiGroup = 'NT' | 'NF' | 'ST' | 'SF';

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
  mbtiGroup?: MbtiGroup;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
      <h3 className="text-[14px] font-bold text-gray-900 mb-3">{title}</h3>
      <div className="text-[13px] text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}

const SS_DETAIL: Record<string, string> = {
  '비견': '나와 같은 기운이 작용합니다. 동료, 형제와의 관계가 부각되고 자립심이 강해집니다. 경쟁 속에서 성장하되 독선을 경계하세요.',
  '겁재': '경쟁과 도전의 기운입니다. 재물 지출에 주의하고 승부욕을 긍정적으로 활용하세요. 공동 사업보다 단독 판단이 유리합니다.',
  '식신': '여유와 창의력의 시기입니다. 먹을 복이 있고 취미가 잘 풀리며 표현력이 좋아집니다. 안정적인 수입과 건강이 따릅니다.',
  '상관': '표현욕과 재능이 폭발하는 시기입니다. 예술, 글쓰기에 좋으나 날카로운 말로 갈등이 생길 수 있으니 언행에 주의하세요.',
  '편재': '활동적 재물운과 사교의 시기입니다. 사업 기회가 오고 인맥이 넓어지지만 과욕을 부리면 손실이 생깁니다.',
  '정재': '안정적인 재물 축적의 시기입니다. 성실한 노력이 결실을 맺고, 가정 경제가 안정됩니다. 저축과 재테크에 유리합니다.',
  '편관': '변화와 도전의 시기입니다. 갑작스러운 업무나 책임이 주어지지만, 잘 넘기면 큰 성장으로 이어집니다. 건강 관리 필요.',
  '정관': '질서와 인정의 시기입니다. 사회적 지위가 올라가고 공식적인 성과가 나타납니다. 규칙을 지키면 좋은 결과가 옵니다.',
  '편인': '직관과 영감의 시기입니다. 학문이나 연구에 몰입하기 좋고 새로운 시각이 열립니다. 다만 고독감이나 건강 이상에 주의.',
  '정인': '학습과 성장의 시기입니다. 자격증, 학위 등 배움의 결실이 맺어지고 윗사람의 도움이 있습니다. 내적 성숙의 시간.',
};

const US_DETAIL: Record<string, string> = {
  '장생': '새로운 출발의 에너지입니다. 시작한 일이 순조롭게 성장하며 희망적인 기운이 감돕니다.',
  '목욕': '변화와 불안정의 시기입니다. 감정 기복이 심하고 유혹이 많으니 신중하게 행동하세요.',
  '관대': '자신감과 사회 활동이 최고조입니다. 적극적으로 나서면 인정받고 기회를 잡을 수 있습니다.',
  '건록': '실력이 완전히 발휘되는 시기입니다. 독립적으로 일을 추진하면 큰 성과를 거둡니다.',
  '제왕': '모든 기운이 정점에 달합니다. 리더십을 발휘하기 좋으나 정점 이후 하락에 대비하세요.',
  '쇠': '기운이 서서히 빠지는 시기입니다. 새로운 일보다 기존 일을 정리하고 체력을 관리하세요.',
  '병': '쇠약함의 시기입니다. 건강 관리에 집중하고 무리한 계획은 피하세요. 휴식이 최선입니다.',
  '사': '정체와 막힘의 시기입니다. 억지로 밀어붙이면 손해가 커지니 때를 기다리세요.',
  '묘': '내면을 돌아보는 시기입니다. 과거를 정리하고 다음을 준비하는 잠복기로 활용하세요.',
  '절': '단절과 전환의 시기입니다. 낡은 것을 과감히 버리고 새 방향을 모색하세요.',
  '태': '새로운 가능성이 잉태되는 시기입니다. 눈에 보이지 않지만 씨앗이 뿌려지고 있습니다.',
  '양': '성장을 준비하는 시기입니다. 조용하지만 확실한 발전이 이루어지고 있습니다.',
};

/** 마크다운 텍스트를 간단한 HTML로 변환 */
function parseBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 빈 줄은 건너뜀 (단락 간격은 CSS mb로 처리)
    if (!trimmed) continue;
    // ### 소제목
    if (trimmed.startsWith('### ')) {
      elements.push(<h5 key={i} className="text-[13px] font-bold text-gray-700 mt-3 mb-1.5">{parseBold(trimmed.slice(4).trim())}</h5>);
    }
    // ## 제목
    else if (trimmed.startsWith('## ')) {
      elements.push(<h4 key={i} className="text-[14px] font-bold text-gray-800 mt-4 mb-2">{parseBold(trimmed.slice(3).trim())}</h4>);
    }
    // - 리스트
    else if (trimmed.startsWith('- ')) {
      elements.push(<li key={i} className="ml-4 list-disc text-[13px] mb-0.5">{parseBold(trimmed.slice(2))}</li>);
    }
    // 일반 문단
    else {
      elements.push(<p key={i} className="mb-2">{parseBold(trimmed)}</p>);
    }
  }

  return elements;
}

type CacheData = Record<MbtiGroup, string>;

interface TodayPartsCache {
  ss: Record<MbtiGroup, Record<string, string>>;
  us: Record<MbtiGroup, Record<string, string>>;
  category: Record<string, Record<MbtiGroup, Record<string, string>>>;
}

function UnGrid({ title, cols, ilgan, activeCheck }: {
  title: string;
  cols: { c: string; j: string; ck: string; jk: string; label: string }[];
  ilgan: string;
  activeCheck?: (col: { c: string; j: string; ck: string; jk: string; label: string } & Record<string, unknown>) => boolean;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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
              <div key={i}
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className={`flex flex-col items-center w-[72px] py-2 px-1 rounded-lg border text-center flex-shrink-0 cursor-pointer transition-all ${isActive ? 'border-gray-900 bg-gray-50' : expandedIdx === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
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
      {expandedIdx !== null && (() => {
        const col = cols[expandedIdx];
        const cgSS = sipsung(ilgan, col.c);
        const us = unsung(ilgan, col.j);
        return (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-[12px] text-gray-600 leading-relaxed animate-in fade-in">
            <div className="font-semibold text-gray-800 mb-2">{col.label} — {col.ck}{col.c} {col.jk}{col.j}</div>
            {cgSS && <p className="mb-2"><span className="font-medium text-gray-700">십성 [{cgSS}]</span> {SS_DETAIL[cgSS] || ''}</p>}
            {us && <p><span className="font-medium text-gray-700">12운성 [{us}]</span> {US_DETAIL[us] || ''}</p>}
          </div>
        );
      })()}
    </div>
  );
}

export function FortuneResult({ data, mbtiGroup }: Props) {
  const { pillars, ilgan, year, month, day, gender, chongun, todayFortune, daeuns, yeonuns, woluns, correctedTime } = data;
  const oh = CG_OH[ilgan] || '';
  const now = new Date();
  const currentAge = now.getFullYear() - year;
  // 사주 연도/월은 절기 기준: 입춘 전이면 전년도, 월주는 절기 기반 사주월
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const sajuYear = isBeforeLichun(currentMonth, currentDay) ? now.getFullYear() - 1 : now.getFullYear();
  // calcWolun은 각 달력 월 15일 기준이라 사주월 N(인월=1)이 label "N+1월"과 매칭됨
  // (예: 입춘 후~경칩 전 = 사주월 1 = 인월 = 캘린더 2월 15일 월주)
  const wolunActiveMonth = (getSajuMonth(currentMonth, currentDay) % 12) + 1;

  // 캐시 JSON fetch
  const [chongunCache, setChongunCache] = useState<CacheData | null>(null);
  const [todayParts, setTodayParts] = useState<TodayPartsCache | null>(null);

  useEffect(() => {
    if (!ilgan) return;
    const ilji = pillars[1].j;
    const wolji = pillars[2].j;
    if (!ilji || !wolji) return;
    const key = `${ilgan}_${ilji}_${wolji}`;
    fetch('/saju-cache/chongun.json')
      .then(r => r.ok ? r.json() : null)
      .then(all => { if (all && all[key]) setChongunCache(all[key]); })
      .catch(() => setChongunCache(null));
  }, [ilgan, pillars]);

  // 오늘의 운세 파트별 리라이팅 JSON (한번만 로드)
  useEffect(() => {
    fetch('/saju-cache/today-parts.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => setTodayParts(d))
      .catch(() => setTodayParts(null));
  }, []);

  const chongunText = mbtiGroup && chongunCache?.[mbtiGroup] ? chongunCache[mbtiGroup] : null;
  const ssReadingText = mbtiGroup && todayParts?.ss?.[mbtiGroup]?.[todayFortune?.ss || ''] || todayFortune?.ssReading || '';
  const usReadingText = mbtiGroup && todayParts?.us?.[mbtiGroup]?.[todayFortune?.us || ''] || todayFortune?.usReading || '';
  const getCategoryDesc = (catLabel: string, ss: string, fallback: string) =>
    mbtiGroup && todayParts?.category?.[catLabel]?.[mbtiGroup]?.[ss] || fallback;

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

      {/* 총운 — 캐시가 있으면 MBTI별 리라이팅 텍스트, 없으면 기존 */}
      {chongun && (
        <Section title="총운">
          {chongunText ? (
            <div>{renderMarkdown(chongunText)}</div>
          ) : (
            <>
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
            </>
          )}
        </Section>
      )}

      {/* 오늘의 운세 — 파트별 리라이팅 캐시 적용 */}
      {todayFortune && (
        <Section title="오늘의 운세">
          <p className="mb-3">
            오늘은 <strong className={EL_COLORS[todayFortune.dayOh]}>{todayFortune.dayPillar}({todayFortune.dayPillarHanja})</strong>일입니다.
            나의 일간 기준 <strong>{todayFortune.ss}</strong>의 날이며, 12운성은 <strong>{todayFortune.us}</strong>입니다.
          </p>
          {ssReadingText && <p className="mb-3">{ssReadingText}</p>}
          <p className={todayFortune.sinsal.length ? 'mb-3' : ''}>12운성 <strong>{todayFortune.us}</strong> — {usReadingText}</p>
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

          {/* 카테고리별 운세 */}
          {todayFortune.categories && todayFortune.categories.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
              {todayFortune.categories.map((cat) => (
                <div key={cat.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-gray-800">{cat.label}</span>
                    <span className={`text-[12px] font-bold ${cat.score >= 70 ? 'text-blue-600' : cat.score >= 50 ? 'text-gray-600' : 'text-red-400'}`}>
                      {cat.score}점
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${cat.score >= 70 ? 'bg-blue-500' : cat.score >= 50 ? 'bg-gray-400' : 'bg-red-400'}`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed">
                    {getCategoryDesc(cat.label, todayFortune.ss, cat.desc)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* 상세 해석 — 총운 캐시가 있으면 숨김 (캐시에 포함됨) */}
      {!chongunText && chongun?.detail && (
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

      {/* 일지 상세 — 총운 캐시가 있으면 숨김 */}
      {!chongunText && chongun?.iljiDetail && (
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

      {/* 대운 · 연운 · 월운 */}
      {ilgan && daeuns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <UnGrid title="대운" cols={daeuns.map(x => ({ ...x, label: `${x.age}세` }))} ilgan={ilgan}
            activeCheck={(col) => currentAge >= (col as unknown as DaeunEntry).age && currentAge < (col as unknown as DaeunEntry).age + 10} />
          <div className="border-t border-gray-100 my-3" />
          <UnGrid title="연운" cols={yeonuns.map(x => ({ ...x, label: `${x.year}` }))} ilgan={ilgan}
            activeCheck={(col) => (col as unknown as YeonunEntry).year === sajuYear} />
          <div className="border-t border-gray-100 my-3" />
          <UnGrid title="월운" cols={woluns.map(x => ({ ...x, label: `${x.month}월` }))} ilgan={ilgan}
            activeCheck={(col) => (col as unknown as WolunEntry).month === wolunActiveMonth} />
        </div>
      )}

      {/* 일진 달력 */}
      {ilgan && <DailyCalendar ilgan={ilgan} />}
    </div>
  );
}
