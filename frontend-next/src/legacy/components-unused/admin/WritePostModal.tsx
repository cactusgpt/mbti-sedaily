import { useState, useRef, useEffect } from "react";
import { X, Upload, Image as ImageIcon, Trash2 } from "lucide-react";
import type { CreatePostParams } from "@/shared/services/postService";

const POST_CATEGORIES = ["경제", "정치", "사회", "세계", "테크", "문화"];
const MBTI_GROUPS = ["NT", "NF", "ST", "SF"] as const;
type MbtiGroup = typeof MBTI_GROUPS[number];

interface MbtiContent {
  title: string;
  body: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: CreatePostParams) => Promise<void>;
  authorId: string;
  authorName: string;
  authorEmail: string;
  defaultCategory?: string;
}

export function WritePostModal({
  isOpen,
  onClose,
  onSubmit,
  authorId,
  authorName,
  authorEmail,
  defaultCategory
}: Props) {
  const [category, setCategory] = useState(defaultCategory && POST_CATEGORIES.includes(defaultCategory) ? defaultCategory : POST_CATEGORIES[0]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeMbti, setActiveMbti] = useState<MbtiGroup>("NT");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // MBTI별 콘텐츠 상태
  const [mbtiContents, setMbtiContents] = useState<Record<MbtiGroup, MbtiContent>>({
    NT: { title: "", body: "" },
    NF: { title: "", body: "" },
    ST: { title: "", body: "" },
    SF: { title: "", body: "" },
  });

  // Update category when modal opens with different defaultCategory
  useEffect(() => {
    if (isOpen && defaultCategory && POST_CATEGORIES.includes(defaultCategory)) {
      setCategory(defaultCategory);
    }
  }, [isOpen, defaultCategory]);

  if (!isOpen) return null;

  const handleMbtiContentChange = (field: keyof MbtiContent, value: string) => {
    setMbtiContents(prev => ({
      ...prev,
      [activeMbti]: {
        ...prev[activeMbti],
        [field]: value
      }
    }));
  };

  // 다른 MBTI에 복사
  const copyToOthers = () => {
    const current = mbtiContents[activeMbti];
    setMbtiContents({
      NT: { ...current },
      NF: { ...current },
      ST: { ...current },
      SF: { ...current },
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("이미지 크기는 5MB 이하여야 합니다.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 모든 MBTI 그룹에 제목이 있는지 확인
    const emptyGroups = MBTI_GROUPS.filter(g => !mbtiContents[g].title.trim());
    if (emptyGroups.length > 0) {
      setError(`다음 MBTI 그룹의 제목을 입력해주세요: ${emptyGroups.join(", ")}`);
      return;
    }

    const emptyBodyGroups = MBTI_GROUPS.filter(g => !mbtiContents[g].body.trim());
    if (emptyBodyGroups.length > 0) {
      setError(`다음 MBTI 그룹의 내용을 입력해주세요: ${emptyBodyGroups.join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: mbtiContents.NT.title.trim(), // 기본 제목은 NT 사용
        content: mbtiContents.NT.body.trim(), // 기본 내용은 NT 사용
        category,
        author_id: authorId,
        author_name: authorName,
        author_email: authorEmail,
        image_url: imagePreview || undefined,
        version_NT: { title: mbtiContents.NT.title.trim(), body: mbtiContents.NT.body.trim() },
        version_NF: { title: mbtiContents.NF.title.trim(), body: mbtiContents.NF.body.trim() },
        version_ST: { title: mbtiContents.ST.title.trim(), body: mbtiContents.ST.body.trim() },
        version_SF: { title: mbtiContents.SF.title.trim(), body: mbtiContents.SF.body.trim() },
      });

      // Reset form
      setMbtiContents({
        NT: { title: "", body: "" },
        NF: { title: "", body: "" },
        ST: { title: "", body: "" },
        SF: { title: "", body: "" },
      });
      setCategory(POST_CATEGORIES[0]);
      setImagePreview(null);
      setActiveMbti("NT");
      onClose();
    } catch (err: any) {
      console.error("Failed to submit post:", err);
      setError(err.message || "글 작성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentContent = mbtiContents[activeMbti];
  const allFilled = MBTI_GROUPS.every(g => mbtiContents[g].title.trim() && mbtiContents[g].body.trim());

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">새 글 작성</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {POST_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      category === cat
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* MBTI Tabs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  MBTI별 콘텐츠
                </label>
                <button
                  type="button"
                  onClick={copyToOthers}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  현재 내용을 모든 MBTI에 복사
                </button>
              </div>

              {/* MBTI Tab Buttons */}
              <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-xl">
                {MBTI_GROUPS.map((group) => {
                  const hasContent = mbtiContents[group].title.trim() && mbtiContents[group].body.trim();
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setActiveMbti(group)}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                        activeMbti === group
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {group}
                      {hasContent && (
                        <span className="ml-1.5 inline-block w-2 h-2 bg-green-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* MBTI Content Input */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
                {/* Title for this MBTI */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {activeMbti} 제목
                  </label>
                  <input
                    type="text"
                    value={currentContent.title}
                    onChange={(e) => handleMbtiContentChange("title", e.target.value)}
                    placeholder={`${activeMbti} 그룹을 위한 제목`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all text-gray-900 bg-white"
                    maxLength={100}
                  />
                </div>

                {/* Body for this MBTI */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {activeMbti} 내용
                  </label>
                  <textarea
                    value={currentContent.body}
                    onChange={(e) => handleMbtiContentChange("body", e.target.value)}
                    placeholder={`${activeMbti} 그룹을 위한 내용을 입력하세요...`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all resize-none text-gray-900 bg-white"
                    rows={6}
                    maxLength={5000}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {currentContent.body.length}/5000
                  </p>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex gap-2 mt-3">
                {MBTI_GROUPS.map((group) => {
                  const hasContent = mbtiContents[group].title.trim() && mbtiContents[group].body.trim();
                  return (
                    <div
                      key={group}
                      className={`flex-1 text-center py-1.5 text-xs rounded-lg ${
                        hasContent
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {group} {hasContent ? "✓" : "미입력"}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이미지 (선택)
              </label>
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-500">
                    클릭하여 이미지 업로드
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !allFilled}
              className="px-5 py-2.5 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  게시 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  게시하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
