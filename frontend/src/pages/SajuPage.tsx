import { useState, type FormEvent } from "react";
import { API_URL } from "@/config/api";

type Step = "input" | "loading" | "result";

interface SajuForm {
  year: string;
  month: string;
  day: string;
  hour: string;
  gender: "male" | "female" | "";
}

interface Pillar {
  stem: string | null;
  branch: string | null;
  stem_kr: string | null;
  branch_kr: string | null;
  stem_element: string | null;
  branch_element: string | null;
  yin_yang: string | null;
  stem_color: string | null;
  branch_color: string | null;
  ten_god_stem: string | null;
  ten_god_branch: string | null;
  ten_god_stem_color: string | null;
  ten_god_branch_color: string | null;
  family_stem: string | null;
  family_branch: string | null;
  fortune_period: string;
  fortune_desc: string;
}

interface SajuResult {
  saju_pillar: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar };
  five_elements_balance: Record<string, { count: number; percent: number; label: string }>;
  ten_gods_analysis: Record<string, string>;
  useful_god: {
    useful_god: string;
    support_element: string;
    avoid_element: string;
    description: string;
    description_tips: string[];
    support_description: string;
    avoid_description: string;
    element_status: Array<{ element: string; state: string; state_label: string; keywords: string }>;
  };
  major_fortune_cycle: Array<{ age: number; year: number; stem: string; branch: string; stem_kr: string; branch_kr: string; element: string }>;
  current_fortune: {
    current_age: number;
    major_fortune: { age: number; stem_kr: string; branch_kr: string; element: string; desc: string; tone: string };
    annual_fortune: { year: number; stem_kr: string; branch_kr: string; element: string; desc: string; tone: string };
    monthly_fortune: { month: number; stem_kr: string; branch_kr: string; element: string; desc: string; tone: string };
    daily_fortune: { date: string; stem_kr: string; branch_kr: string; element: string; desc: string; tone: string };
  };
  personality_profile: { dominant_element: string; personality: string; strength: string; career: string };
}

const ELEMENT_KR_SHORT: Record<string, string> = {
  Wood: '목', Fire: '화', Earth: '토', Metal: '금', Water: '수',
};

const TONE_STYLE: Record<string, { bg: string; label: string; title: string; desc: string; sub: string }> = {
  blue:   { bg: "bg-blue-50",   label: "text-blue-500",   title: "text-blue-800",  desc: "text-blue-700",  sub: "text-blue-400" },
  green:  { bg: "bg-green-50",  label: "text-green-500",  title: "text-green-800", desc: "text-green-700", sub: "text-green-400" },
  yellow: { bg: "bg-yellow-50", label: "text-yellow-600", title: "text-yellow-800",desc: "text-yellow-700",sub: "text-yellow-500" },
  red:    { bg: "bg-red-50",    label: "text-red-500",    title: "text-red-800",   desc: "text-red-700",   sub: "text-red-400" },
};

const ELEMENT_COLOR: Record<string, string> = {
  "목(木)": "bg-green-100 text-green-700",
  "화(火)": "bg-red-100 text-red-700",
  "토(土)": "bg-yellow-100 text-yellow-700",
  "금(金)": "bg-gray-100 text-gray-700",
  "수(水)": "bg-blue-100 text-blue-700",
};

function PillarCard({ label, pillar }: { label: string; pillar: Pillar }) {
  if (!pillar.stem) return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-xs text-gray-300 mb-1">{pillar.fortune_period}</div>
      <div className="text-[10px] text-gray-200 mb-2">{pillar.fortune_desc}</div>
      <div className="w-16 h-32 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">미입력</div>
    </div>
  );
  return (
    <div className="flex flex-col items-center min-w-[72px]">
      <div className="text-xs text-gray-500 font-medium mb-0.5">{label}</div>
      <div className="text-xs text-gray-400 mb-0.5">{pillar.fortune_period}</div>
      <div className="text-[10px] text-gray-400 mb-2">{pillar.fortune_desc}</div>
      <div className="w-16 rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* 천간 십성 */}
        <div className="py-1 text-center border-b border-gray-100 bg-gray-50">
          <div className="text-[10px] font-medium"
               style={{ color: pillar.ten_god_stem_color ?? '#999' }}>
            {pillar.ten_god_stem?.replace(/\(.*\)/, '') ?? '—'}
          </div>
        </div>
        {/* 천간 */}
        <div className="py-2 px-1 text-center border-b border-gray-100">
          <div className="text-2xl font-bold leading-none"
               style={{ color: pillar.stem_color ?? '#333' }}>
            {pillar.stem}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: pillar.stem_color ?? '#999' }}>
            {pillar.stem_element ? ELEMENT_KR_SHORT[pillar.stem_element] : ''}
          </div>
        </div>
        {/* 지지 */}
        <div className="py-2 px-1 text-center border-b border-gray-100">
          <div className="text-2xl font-bold leading-none"
               style={{ color: pillar.branch_color ?? '#333' }}>
            {pillar.branch}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: pillar.branch_color ?? '#999' }}>
            {pillar.branch_element ? ELEMENT_KR_SHORT[pillar.branch_element] : ''}
          </div>
        </div>
        {/* 지지 십성 */}
        <div className="py-1 text-center bg-gray-50">
          <div className="text-[10px] font-medium"
               style={{ color: pillar.ten_god_branch_color ?? '#999' }}>
            {pillar.ten_god_branch?.replace(/\(.*\)/, '') ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SajuPage() {
  const [step, setStep] = useState<Step>("input");
  const [form, setForm] = useState<SajuForm>({ year: "", month: "", day: "", hour: "", gender: "" });
  const [result, setResult] = useState<SajuResult | null>(null);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.year || !form.month || !form.day || !form.gender) {
      setError("생년월일과 성별을 모두 입력해주세요.");
      return;
    }
    setError("");
    setStep("loading");
    try {
      const res = await fetch(`${API_URL}/saju`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth_year: Number(form.year),
          birth_month: Number(form.month),
          birth_day: Number(form.day),
          birth_hour: form.hour !== "" ? Number(form.hour) : null,  // 12시진 인덱스 (0=子~11=亥)
          gender: form.gender,
        }),
      });
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const data: SajuResult = await res.json();
      console.log("saju result:", JSON.stringify(data.current_fortune, null, 2));
      setResult(data);
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setStep("input");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔮</div>
          <h1 className="text-2xl font-bold text-gray-900">사주 운세</h1>
          <p className="text-sm text-gray-500 mt-1">생년월일시와 성별을 입력하면 사주를 분석해드립니다</p>
        </div>

        {step === "input" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">생년월일</label>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" placeholder="년 (1995)" min={1900} max={2025} value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center" />
                <input type="number" placeholder="월 (1-12)" min={1} max={12} value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center" />
                <input type="number" placeholder="일 (1-31)" min={1} max={31} value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                태어난 시 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <select value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="">모름 / 선택 안 함</option>
                <option value="0">23~01시 (자시 子)</option>
                <option value="1">01~03시 (축시 丑)</option>
                <option value="2">03~05시 (인시 寅)</option>
                <option value="3">05~07시 (묘시 卯)</option>
                <option value="4">07~09시 (진시 辰)</option>
                <option value="5">09~11시 (사시 巳)</option>
                <option value="6">11~13시 (오시 午)</option>
                <option value="7">13~15시 (미시 未)</option>
                <option value="8">15~17시 (신시 申)</option>
                <option value="9">17~19시 (유시 酉)</option>
                <option value="10">19~21시 (술시 戌)</option>
                <option value="11">21~23시 (해시 亥)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">성별</label>
              <div className="grid grid-cols-2 gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setForm({ ...form, gender: g })}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      form.gender === g ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                    }`}>
                    {g === "male" ? "남성" : "여성"}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              운세 보기
            </button>
          </form>
        )}

        {step === "loading" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">사주를 분석하고 있습니다...</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            {/* 사주 팔자 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4">사주 팔자 (四柱八字)</h2>
              <div className="flex justify-around gap-1">
                <PillarCard label="생시(時)" pillar={result.saju_pillar.hour} />
                <PillarCard label="생일(日)" pillar={result.saju_pillar.day} />
                <PillarCard label="생월(月)" pillar={result.saju_pillar.month} />
                <PillarCard label="생년(年)" pillar={result.saju_pillar.year} />
              </div>
              {/* 범례 */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 justify-center">
                {[
                  { label: '천간', desc: '위 한자' },
                  { label: '지지', desc: '아래 한자' },
                  { label: '십성', desc: '일간 기준 관계' },
                  { label: '육친', desc: '가족 관계' },
                ].map(({ label, desc }) => (
                  <span key={label} className="text-[10px] text-gray-400">{label} <span className="text-gray-300">({desc})</span></span>
                ))}
              </div>
            </div>

            {/* 오행 분포 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3">오행 분포 (五行)</h2>
              <div className="space-y-2">
                {Object.entries(result.five_elements_balance).map(([, v]) => (
                  <div key={v.label} className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-16 text-center ${ELEMENT_COLOR[v.label] ?? "bg-gray-100 text-gray-600"}`}>{v.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-400 h-2 rounded-full transition-all" style={{ width: `${v.percent}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{v.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 용신 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3">용신 (用神)</h2>
              <div className="space-y-2">
                <div className="bg-indigo-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">용신 · 나에게 힘이 되는 기운</span>
                    <span className="text-sm font-bold text-indigo-800">{result.useful_god.useful_god}</span>
                  </div>
                  <p className="text-sm text-indigo-700 leading-relaxed mb-2">{result.useful_god.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.useful_god.description_tips.map((tip) => (
                      <span key={tip} className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">{tip}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">희신 · 용신을 도와주는 기운</span>
                    <span className="text-sm font-bold text-green-800">{result.useful_god.support_element}</span>
                  </div>
                  <p className="text-sm text-green-700 leading-relaxed">{result.useful_god.support_description}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">기신 · 나를 힘들게 하는 기운</span>
                    <span className="text-sm font-bold text-red-800">{result.useful_god.avoid_element}</span>
                  </div>
                  <p className="text-sm text-red-700 leading-relaxed">{result.useful_god.avoid_description}</p>
                </div>
              </div>

              {/* 오행 키워드 테이블 */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-500 mb-2">내 오행 기운 분석</div>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {result.useful_god.element_status.map((s) => (
                    <div key={s.element} className="flex items-center px-3 py-2.5 bg-white">
                      <span className={`text-xs font-medium w-14 ${ELEMENT_COLOR[s.element] ?? "bg-gray-100 text-gray-600"} px-2 py-0.5 rounded-full text-center`}>{s.element}</span>
                      <span className={`text-xs ml-2 w-10 font-medium ${
                        s.state === 'excess' ? 'text-red-500' : s.state === 'lack' ? 'text-blue-500' : 'text-green-600'
                      }`}>{s.state_label}</span>
                      <span className="text-xs text-gray-500 ml-2">{s.keywords}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 현재 운세 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3">현재 운세</h2>
              <div className="space-y-2">
                {([
                  { label: "현재 대운", data: result.current_fortune.major_fortune, sub: result.current_fortune.major_fortune.element },
                  { label: "오늘 일운", data: result.current_fortune.daily_fortune, sub: result.current_fortune.daily_fortune.date },
                  { label: `${result.current_fortune.monthly_fortune.month}월 월운`, data: result.current_fortune.monthly_fortune, sub: result.current_fortune.monthly_fortune.element },
                  { label: `${result.current_fortune.annual_fortune.year}년 세운`, data: result.current_fortune.annual_fortune, sub: result.current_fortune.annual_fortune.element },
                ] as const).map(({ label, data, sub }) => {
                  const s = TONE_STYLE[data.tone] ?? TONE_STYLE.green;
                  return (
                    <div key={label} className={`${s.bg} rounded-xl p-4 flex items-start gap-3`}>
                      <div className="min-w-[80px]">
                        <div className={`text-xs ${s.label} mb-0.5`}>{label}</div>
                        <div className={`font-bold text-lg ${s.title}`}>{data.stem_kr}{data.branch_kr}</div>
                        <div className={`text-xs ${s.sub}`}>{sub}</div>
                      </div>
                      <div className={`text-sm ${s.desc} leading-relaxed pt-0.5`}>{data.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 성격 프로필 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-2">성격 · 적성</h2>
              <div className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${ELEMENT_COLOR[result.personality_profile.dominant_element] ?? "bg-gray-100 text-gray-600"}`}>
                {result.personality_profile.dominant_element} 기질
              </div>
              <p className="text-sm text-gray-600 mb-2">{result.personality_profile.personality}</p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>강점: {result.personality_profile.strength}</div>
                <div>적합 직업: {result.personality_profile.career}</div>
              </div>
            </div>

            {/* 대운 타임라인 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3">대운 타임라인</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {result.major_fortune_cycle.map((f) => (
                  <div key={f.age} className={`flex-shrink-0 rounded-xl p-3 text-center min-w-[60px] ${f.age === result.current_fortune.major_fortune.age ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-700"}`}>
                    <div className="text-xs opacity-70">{f.age}세</div>
                    <div className="font-bold text-sm">{f.stem_kr}{f.branch_kr}</div>
                    <div className="text-[10px] opacity-60">{f.year}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => { setStep("input"); setResult(null); }}
              className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-xl transition-colors text-sm">
              다시 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
