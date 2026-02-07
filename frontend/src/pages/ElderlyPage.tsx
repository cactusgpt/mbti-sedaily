import { useSearchParams } from "react-router-dom";
import { ElderlyNewsFeed } from "@/components/elderly/ElderlyNewsFeed";

export default function ElderlyPage() {
  const [searchParams] = useSearchParams();

  // 자녀가 공유할 때 관심사를 미리 설정할 수 있음
  // 예: /elderly?interests=economy,health
  const interestsParam = searchParams.get("interests");
  const initialInterests = interestsParam ? interestsParam.split(",") : [];

  return <ElderlyNewsFeed initialInterests={initialInterests} />;
}
