import { sipsung, unsung, elClass, CG_OH, JJG, type Pillar } from '../lib/engine';

const EL_COLORS: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500', '수': 'text-blue-600',
};
const EL_BG: Record<string, string> = {
  '목': 'bg-green-50', '화': 'bg-red-50', '토': 'bg-yellow-50',
  '금': 'bg-gray-100', '수': 'bg-blue-50',
};

function ElSpan({ oh, children }: { oh: string; children: React.ReactNode }) {
  return <span className={`font-bold ${EL_COLORS[oh] || 'text-gray-800'}`}>{children}</span>;
}

interface Props { pillars: Pillar[]; ilgan: string; }

export function SajuTable({ pillars, ilgan }: Props) {
  const headers = ['생시', '생일', '생월', '생년'];
  return (
    <div className="overflow-x-auto mt-8 mb-6">
      <table className="w-full border-collapse text-center text-[13px]">
        <thead>
          <tr>
            <th className="p-2 text-[11px] text-gray-400 font-medium w-[52px]"></th>
            {headers.map(h => <th key={h} className="p-2 text-[11px] text-gray-400 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {/* 천간 */}
          <tr>
            <td className="p-2 text-[11px] text-gray-400">천간</td>
            {pillars.map((p, i) => (
              <td key={i} className="p-2">
                {p.c ? <span className={`text-[18px] font-bold ${EL_COLORS[p.co] || ''}`}>{p.ck}{p.c}</span> : <span className="text-gray-300">—</span>}
              </td>
            ))}
          </tr>
          {/* 천간 십성 */}
          <tr>
            <td className="p-2 text-[11px] text-gray-400">십성</td>
            {pillars.map((p, i) => <td key={i} className="p-2 text-[12px] text-gray-500">{p.c ? sipsung(ilgan, p.c) : ''}</td>)}
          </tr>
          {/* 지지 */}
          <tr>
            <td className="p-2 text-[11px] text-gray-400">지지</td>
            {pillars.map((p, i) => (
              <td key={i} className="p-2">
                {p.j ? <span className={`text-[18px] font-bold ${EL_COLORS[p.jo] || ''}`}>{p.jk}{p.j}</span> : <span className="text-gray-300">—</span>}
              </td>
            ))}
          </tr>
          {/* 지지 십성 */}
          <tr>
            <td className="p-2 text-[11px] text-gray-400">십성</td>
            {pillars.map((p, i) => {
              const g = p.j && JJG[p.j];
              return <td key={i} className="p-2 text-[12px] text-gray-500">{g ? sipsung(ilgan, g[g.length - 1]) : ''}</td>;
            })}
          </tr>
          {/* 지장간 */}
          <tr>
            <td className="p-2 text-[11px] text-gray-400">지장간</td>
            {pillars.map((p, i) => {
              const g = p.j && JJG[p.j];
              return (
                <td key={i} className="p-2">
                  {g ? (
                    <div className="flex justify-center gap-1">
                      {g.map((s, si) => <span key={si} className={`text-[12px] ${EL_COLORS[CG_OH[s]] || ''}`}>{s}</span>)}
                    </div>
                  ) : null}
                </td>
              );
            })}
          </tr>
          {/* 12운성 */}
          <tr>
            <td className="p-2 text-[11px] text-gray-400">12운성</td>
            {pillars.map((p, i) => <td key={i} className="p-2 text-[12px] text-gray-600">{unsung(ilgan, p.j)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
