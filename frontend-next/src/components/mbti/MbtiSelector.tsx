

import { mbtiGroupList, mbtiGroups, mbtiTypeToGroup } from "@/shared/data/mbtiGroups";
import type { MbtiGroupId, MbtiType } from "@/shared/data/mbtiGroups";

interface Props {
  selectedGroup: MbtiGroupId | null;
  selectedType: MbtiType | null;
  selectionMode: "group" | "type";
  onSelectGroup: (group: MbtiGroupId) => void;
  onSelectType: (type: MbtiType) => void;
  onChangeMode: (mode: "group" | "type") => void;
}

export function MbtiSelector({
  selectedGroup,
  selectedType,
  selectionMode,
  onSelectGroup,
  onSelectType,
  onChangeMode,
}: Props) {
  return (
    <section id="mbti-select" className="py-16 md:py-20 bg-[var(--color-bg-subtle)]">
      <div className="max-w-4xl mx-auto px-gutter">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-2" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
            나의 뉴스 스타일은?
          </h2>
          <p className="text-[var(--color-text-light)] text-sm">
            MBTI를 선택하면 맞춤 기사를 볼 수 있어요
          </p>
        </div>

        {/* 탭 전환 */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white rounded-full p-1 border border-[var(--color-border)]">
            {(["group", "type"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onChangeMode(mode)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  selectionMode === mode
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-light)] hover:text-[var(--color-text)]"
                }`}
              >
                {mode === "group" ? "4그룹으로 선택" : "16유형으로 선택"}
              </button>
            ))}
          </div>
        </div>

        {/* 그룹 선택 모드 */}
        {selectionMode === "group" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mbtiGroupList.map((group) => {
              const isSelected = selectedGroup === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className={`w-full p-6 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? `${group.borderClass} ${group.bgLightClass} shadow-md`
                      : "border-[var(--color-border)] bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{group.icon}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isSelected ? `${group.bgClass} text-white` : "bg-gray-100 text-[var(--color-text-muted)]"
                      }`}
                    >
                      {group.axis}
                    </span>
                  </div>
                  <h3
                    className={`text-xl font-bold mb-1 ${
                      isSelected ? group.textClass : "text-[var(--color-text)]"
                    }`}
                  >
                    {group.label}
                  </h3>
                  <p className="text-sm text-[var(--color-text-light)] mb-3">{group.description}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    스타일: <span className="font-medium">{group.style}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {group.types.map((type) => (
                      <span
                        key={type}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isSelected
                            ? `${group.bgLightClass} ${group.textClass}`
                            : "bg-gray-50 text-[var(--color-text-muted)]"
                        }`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 유형 선택 모드 */}
        {selectionMode === "type" && (
          <div className="space-y-6">
            {mbtiGroupList.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{group.icon}</span>
                  <span className={`text-sm font-bold ${group.textClass}`}>{group.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{group.style}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.types.map((type) => {
                    const isSelected = selectedType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => onSelectType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                          isSelected
                            ? `${group.bgClass} text-white border-transparent shadow-md`
                            : `bg-white ${group.textClass} ${group.borderClass} hover:shadow-sm`
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 선택 결과 */}
        {selectedGroup && (
          <div className="mt-8 text-center">
            <p className="text-[var(--color-text-light)] text-sm">
              선택:{" "}
              <span className={`font-bold ${mbtiGroups[selectedGroup].textClass}`}>
                {selectedType ?? mbtiGroups[selectedGroup].label}
              </span>{" "}
              <a href="#article-demo" className={`underline ${mbtiGroups[selectedGroup].textClass}`}>
                아래에서 기사를 확인하세요 ↓
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
