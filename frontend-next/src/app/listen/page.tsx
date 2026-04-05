'use client';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ElderlyNewsFeed } from "@/components/elderly/ElderlyNewsFeed";

function ListenContent() {
  const searchParams = useSearchParams();
  const interestsParam = searchParams.get("interests");
  const initialInterests = interestsParam ? interestsParam.split(",") : [];

  return <ElderlyNewsFeed initialInterests={initialInterests} />;
}

export default function ListenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
      <ListenContent />
    </Suspense>
  );
}
