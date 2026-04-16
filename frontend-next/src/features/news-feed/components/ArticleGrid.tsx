'use client';

import type { MbtiGroupId } from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { HeroCard } from './HeroCard';
import { ArticleCard } from './ArticleCard';

interface Props {
  articles: MbtiArticle[];
  selectedGroup: MbtiGroupId;
  onArticleClick: (article: MbtiArticle) => void;
  personaName: string;
  personaNames: string[];
  personaAvatar: string;
}

function hashStr(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
}

function generatePickMessage(group: MbtiGroupId, article: MbtiArticle): string {
  const cat = article.category || '뉴스';
  const title = (article.versions?.[group]?.title || article.title).slice(0, 25);
  const t = title.length >= 25 ? title + '...' : title;
  const idx = hashStr(article.news_id);

  // NT — 냉철한 전략가. 감정 일절 없음. 한 발 물러서 관찰하는 시선. "~인데" "구조적으로" "논리적으로 봤을 때" 체.
  // 기사를 추천하는 게 아니라 '분석 결과를 공유'하는 느낌. 자기가 읽고 결론 내린 걸 알려주는 톤.
  const ntMessages = [
    `구조적으로 흥미로운 기사인데. "${t}" — ${cat} 분야 기사 여러 개 비교해봤는데 이게 유일하게 원인-결과-파급효과를 빠짐없이 다루고 있음. 다른 매체들은 현상만 짚는데, 이건 왜 지금 이 타이밍에 터졌는지까지 설명하고 있어서 읽어볼 가치 있음.`,
    `오늘 ${cat} 기사 중에 논리적 정합성이 가장 높은 걸 골랐는데. 대부분 감정적 프레이밍이 들어가 있어서 걸렀고, 이 기사만 변수 세 개를 정확히 짚고 있더라. 2문단부터 읽으면 전체 구조가 보일 거임.`,
    `"${t}" — 팩트 체크 다 해봤는데 논리적으로 문제 없음. ${cat} 이슈가 왜 복잡해 보이는지, 실제로는 어떤 변수가 핵심인지 이 기사가 가장 깔끔하게 정리해놨더라. 시간 대비 정보 밀도 높은 편이니까 한번 봐.`,
  ];

  // NF — 조심스럽고 진심 어린 감성러. "..." 많이 씀. 혼잣말하듯 중얼거리는 톤. 기사에서 '숫자'가 아니라 '사람'을 봄.
  // 추천이 아니라 '나누고 싶은 마음'에서 말하는 느낌. 조심스럽게, 상대의 감정을 배려하면서.
  const nfMessages = [
    `저... 이 기사 읽다가 한참 멍하니 있었어요... ${cat} 기사라서 그냥 넘기려 했는데... 읽다 보니까 숫자 뒤에 진짜 사람들 이야기가 있더라고요. 뭔가... 마음이 묵직해지는 느낌? 여러분도 읽으시면... 아마 저처럼 한참 생각에 잠기실 것 같아요.`,
    `음... 이건 그냥 지나칠 수 없어서요. "${t}" 읽으면서 요즘 제가 혼자 계속 생각하던 것들이랑... 어딘가 닿아있다는 느낌이 들었거든요. ${cat} 이야기지만 결국은... 우리가 어떤 세상에서 살고 싶은지에 대한 이야기인 것 같아요. 같이... 천천히 읽어봐요.`,
    `있잖아요... 오늘 이 기사 보면서 좀 울컥했어요. 뉴스니까 딱딱할 줄 알았는데... 그 안에 누군가의 진심이 담겨 있더라고요. 저만 이렇게 느끼는 걸까요...? ${cat} 쪽에 관심 있으신 분이라면... 꼭 한번 읽어보셨으면 해요. 마음이 따뜻해질 거예요...`,
  ];

  // ST — 감정 빼고 팩트. 문장 짧음. "~임" "~됨" "~하면 됨". 결론 먼저, 이유 나중.
  // 시간 낭비 극혐. 쓸데없는 수식어 쓰면 오히려 신뢰 잃음. 읽는 사람의 시간을 존중하는 톤.
  const stMessages = [
    `${cat}. "${t}". 결론부터 말하면 오늘 이것만 읽으면 됨. 30개 기사 다 봤는데 실질적으로 도움 되는 건 이거 하나임. 3분이면 끝남.`,
    `오늘 ${cat} 핵심 기사 하나 챙겨옴. "${t}" — 내일 회의에서 이거 언급하면 "오 그거 봤어?" 수준의 기사임. 쓸데없는 감상 없이 팩트만 정리돼 있어서 출근길에 읽기 딱 좋음.`,
    `"${t}" — ${cat} 분야. 다른 건 다 걸러도 이건 봐야 됨. 왜냐면 당장 실무에 영향 있는 내용이라서. 시간 없으면 첫 세 문단만 읽어도 핵심은 파악 가능함.`,
  ];

  // SF — 친구한테 카톡하는 그 톤. 이모지, 느낌표 풍부. "ㅋㅋ" "ㄹㅇ" "헐" 자연스럽게 섞임.
  // '정보 공유'가 아니라 '같이 신나고 싶어서' 알려주는 느낌. 혼자 보기 아까운 마음이 핵심.
  const sfMessages = [
    `여러분 잠깐만요 이거 꼭 봐야 해요!!! 😆 오늘 ${cat} 기사 보다가 혼자 "헐 대박" 했어요 ㄹㅇ "${t}" 이거 안 보면 진심 손해... 단톡방에 바로 공유하고 싶은 그런 기사예요!! 같이 읽어봐요!! ✨`,
    `안녕하세요오~!! ☀️ 아니 오늘 ${cat} 쪽에서 완전 재밌는 거 발견해버렸어요 ㅋㅋㅋ "${t}" 이거 읽고 친구한테 바로 카톡 보냈거든요?? "야 이거 봤어??" 하면 대화 2시간은 갈 주제!! 점심시간에 꼭 읽어보세요 강추!! 💬`,
    `오늘의 Pick 가져왔어요~!! 🎉 ${cat} 기사인데요 주변에서 다들 이 얘기하고 있더라고요!! "${t}" 모르면 나만 뒤처지는 느낌ㅠㅠ 근데 진짜 재밌어서 2분이면 읽을 수 있어요!! 가볍게 확인해봐요 여러분!! 💕`,
  ];

  switch (group) {
    case 'NT': return ntMessages[idx % ntMessages.length];
    case 'NF': return nfMessages[idx % nfMessages.length];
    case 'ST': return stMessages[idx % stMessages.length];
    case 'SF': return sfMessages[idx % sfMessages.length];
    default: return '';
  }
}

export function ArticleGrid({ articles, selectedGroup, onArticleClick, personaName, personaNames, personaAvatar }: Props) {
  if (articles.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-base font-medium text-gray-400 mb-1">아직 기사가 없어요</p>
        <p className="text-sm text-gray-300">다른 날짜를 선택해보세요</p>
      </div>
    );
  }

  const [heroArticle, ...restArticles] = articles.slice(0, 12);

  return (
    <div className="flex flex-col">
      {/* ── Pick 섹션 ── */}
      <div className="pb-4 pt-5 md:px-0 md:pb-6 md:pt-0">
        <div className="text-lg font-bold text-gray-900 md:text-2xl flex items-center gap-2 mb-2">
          <img
            src={personaAvatar}
            alt={personaName}
            className="w-7 h-7 rounded-full object-cover"
          />
          <span>{personaName} Pick 아티클</span>
        </div>
        <p className="text-sm text-gray-500 pl-9">
          {generatePickMessage(selectedGroup, heroArticle)}
        </p>
      </div>

      <HeroCard
        article={heroArticle}
        selectedGroup={selectedGroup}
        onClick={() => onArticleClick(heroArticle)}
        personaName={personaName}
      />

      {/* ── 최신 아티클 섹션 ── */}
      {restArticles.length > 0 && (
        <>
          <div className="mt-5 w-full border-t border-gray-200 pb-4 pt-5 text-lg font-bold text-gray-900 md:mt-8 md:px-0 md:pb-5 md:pt-8 md:text-2xl">
            최신 아티클
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {restArticles.map((article) => (
              <ArticleCard
                key={article.news_id}
                article={article}
                selectedGroup={selectedGroup}
                onClick={() => onArticleClick(article)}
                personaNames={personaNames}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
