import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Amplify handles the OAuth callback automatically
    // Just redirect to home after a short delay
    const timer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-4 mx-auto" />
        <p className="text-[14px] text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
}
