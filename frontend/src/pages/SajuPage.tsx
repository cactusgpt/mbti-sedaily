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
}

interface SajuResult {
  saju_pillar: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar };
  five_elements_balance: Record<string, { count: number; percent: number; label: string }>;
  ten_gods_analysis: Record<string, string>;
  useful_god: { useful_god: string; support_element: string; avoid_element: string; description: string };
  major_fortune_cycle: Array<{ age: number; year: number; stem: string; branch: string; stem_kr: string; branch_kr: string; element: string }>;
  current_fortune: {
    current_age: number;
    major_fortune: { age: number; stem_kr: string; branch_kr: string; element: string };
    annual_fortune: { year: number; stem_kr: string; branch_kr: string };
  };
  personality_profile: { dominant_element: string; personality: string; strength: string; career: string };
}

const ELEMENT_COLOR: Record<string, string> = {
  "목(木)": "bg-green-100 text-green-700",
  "화(火)": "bg-red-100 text-red-700",
  "토(土)": "bg-yellow-100 text-yellow-700",
  "금(金)": "bg-gray-100 text-gray-700",
  "수(水)": "bg-blue-100 text-blue-700",
};

function PillarCard({ label, pillar }: { label: string; pillar: Pillar }) {
  if (!pillar.stem) return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="w-14 h-20 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">미입력</div>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <div className="w-14 rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="bg-indigo-50 py-2 text-center">
          <span className="text-xl font-bold text-indigo-700">{pillar.stem}</span>
          <div className="text-[10px] text-indigo-400">{pillar.stem_kr} · {pillar.yin_yang}</div>
        </div>
        <div className="bg-gray-50 py-2 text-center">
          <span className="text-xl font-bold text-gray-700">{pillar.branch}</span>
          <div className="text-[10px] text-gray-400">{pillar.branch_kr}</div>
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
              <div className="flex justify-around">
                <PillarCard label="연주(年柱)" pillar={result.saju_pillar.year} />
                <PillarCard label="월주(月柱)" pillar={result.saju_pillar.month} />
                <PillarCard label="일주(日柱)" pillar={result.saju_pillar.day} />
                <PillarCard label="시주(時柱)" pillar={result.saju_pillar.hour} />
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
              <h2 className="text-sm font-bold text-gray-700 mb-2">용신 (用神)</h2>
              <p className="text-sm text-gray-600">{result.useful_god.description}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">용신 {result.useful_god.useful_god}</span>
                <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full">희신 {result.useful_god.support_element}</span>
                <span className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full">기신 {result.useful_god.avoid_element}</span>
              </div>
            </div>

            {/* 현재 운세 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-2">현재 운세</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3">
                  <div className="text-xs text-indigo-500 mb-1">현재 대운</div>
                  <div className="font-bold text-indigo-800">{result.current_fortune.major_fortune.stem_kr}{result.current_fortune.major_fortune.branch_kr}</div>
                  <div className="text-xs text-indigo-400">{result.current_fortune.major_fortune.element}</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-xs text-amber-500 mb-1">{result.current_fortune.annual_fortune.year}년 세운</div>
                  <div className="font-bold text-amber-800">{result.current_fortune.annual_fortune.stem_kr}{result.current_fortune.annual_fortune.branch_kr}</div>
                  <div className="text-xs text-amber-400">{result.current_fortune.annual_fortune.year}년</div>
                </div>
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
