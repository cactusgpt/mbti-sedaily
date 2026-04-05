import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";

type AuthMode = "login" | "signup" | "confirm" | "forgot" | "reset";

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    confirmSignUpCode,
    resendConfirmationCode,
    forgotPassword,
    confirmForgotPassword,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await signInWithEmail(email, password);
    setIsLoading(false);

    if (result.success) {
      navigate("/", { replace: true });
    } else if (result.needsConfirmation) {
      setMode("confirm");
      setError("");
    } else {
      setError(result.error || "로그인에 실패했습니다.");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);
    const result = await signUpWithEmail(email, password, name);
    setIsLoading(false);

    if (result.success) {
      if (result.needsConfirmation) {
        setMode("confirm");
        setSuccessMessage("이메일로 인증 코드가 전송되었습니다.");
      } else {
        navigate("/", { replace: true });
      }
    } else {
      setError(result.error || "회원가입에 실패했습니다.");
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await confirmSignUpCode(email, verificationCode);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage("이메일 인증이 완료되었습니다. 로그인해주세요.");
      setMode("login");
      setVerificationCode("");
    } else {
      setError(result.error || "인증에 실패했습니다.");
    }
  };

  const handleResendCode = async () => {
    setError("");
    setIsLoading(true);
    const result = await resendConfirmationCode(email);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage("인증 코드가 재전송되었습니다.");
    } else {
      setError(result.error || "코드 재전송에 실패했습니다.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await forgotPassword(email);
    setIsLoading(false);

    if (result.success) {
      setMode("reset");
      setSuccessMessage("이메일로 인증 코드가 전송되었습니다.");
    } else {
      setError(result.error || "비밀번호 재설정 요청에 실패했습니다.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    const result = await confirmForgotPassword(email, verificationCode, password);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage("비밀번호가 재설정되었습니다. 로그인해주세요.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setVerificationCode("");
    } else {
      setError(result.error || "비밀번호 재설정에 실패했습니다.");
    }
  };

  const renderForm = () => {
    switch (mode) {
      case "login":
        return (
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-14 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setSuccessMessage("");
                }}
                className="text-sm text-gray-500 hover:text-amber-600 transition-colors"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-2xl hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50 hover:shadow-orange-300/50 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              로그인
            </button>
          </form>
        );

      case "signup":
        return (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이름
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="w-full pl-12 pr-14 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호 확인
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-2xl hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50 hover:shadow-orange-300/50 active:scale-[0.98] mt-6"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              회원가입
            </button>
          </form>
        );

      case "confirm":
        return (
          <form onSubmit={handleConfirmSignUp} className="space-y-5">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-2xl mb-4">
                <Mail className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900 block mb-1">{email}</span>
                으로 전송된 인증 코드를 입력해주세요
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                인증 코드
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-center text-2xl tracking-[0.5em] font-mono transition-all duration-200"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-2xl hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              인증하기
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading}
              className="w-full py-3 text-sm text-gray-500 hover:text-amber-600 transition-colors"
            >
              인증 코드 재전송
            </button>
          </form>
        );

      case "forgot":
        return (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-2xl mb-4">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-sm text-gray-600">
                가입한 이메일 주소를 입력하시면<br />
                비밀번호 재설정 코드를 보내드립니다
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-2xl hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              인증 코드 받기
            </button>
          </form>
        );

      case "reset":
        return (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl mb-4">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">
                이메일로 전송된 인증 코드와<br />
                새 비밀번호를 입력해주세요
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                인증 코드
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-center text-2xl tracking-[0.5em] font-mono transition-all duration-200"
                maxLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                새 비밀번호
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="w-full pl-12 pr-14 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호 확인
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-2xl hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-green-200/50 active:scale-[0.98] mt-2"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              비밀번호 재설정
            </button>
          </form>
        );
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login":
        return "로그인";
      case "signup":
        return "회원가입";
      case "confirm":
        return "이메일 인증";
      case "forgot":
        return "비밀번호 찾기";
      case "reset":
        return "비밀번호 재설정";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 flex flex-col relative overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{getTitle()}</h1>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-start justify-center pt-8 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-white/60 p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 rounded-2xl mb-4 shadow-lg shadow-orange-200/50">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                AI LENS
              </h2>
              <p className="text-sm text-gray-500 mt-1">나만의 MBTI 뉴스 렌즈</p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-5 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-sm flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {successMessage}
              </div>
            )}

            {/* Form */}
            {renderForm()}

            {/* Divider (only for login/signup) */}
            {(mode === "login" || mode === "signup") && (
              <>
                <div className="relative my-7">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-400 text-xs uppercase tracking-wider">또는</span>
                  </div>
                </div>

                {/* Social Login */}
                <button
                  onClick={signInWithGoogle}
                  className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-2xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-gray-700 font-medium">Google로 계속하기</span>
                </button>

                {/* Toggle Mode */}
                <div className="mt-7 text-center text-sm">
                  {mode === "login" ? (
                    <p className="text-gray-500">
                      계정이 없으신가요?{" "}
                      <button
                        onClick={() => {
                          setMode("signup");
                          setError("");
                          setSuccessMessage("");
                        }}
                        className="text-amber-600 font-semibold hover:text-amber-700 transition-colors"
                      >
                        회원가입
                      </button>
                    </p>
                  ) : (
                    <p className="text-gray-500">
                      이미 계정이 있으신가요?{" "}
                      <button
                        onClick={() => {
                          setMode("login");
                          setError("");
                          setSuccessMessage("");
                        }}
                        className="text-amber-600 font-semibold hover:text-amber-700 transition-colors"
                      >
                        로그인
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Back button for other modes */}
            {(mode === "confirm" || mode === "forgot" || mode === "reset") && (
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccessMessage("");
                }}
                className="w-full mt-5 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← 로그인으로 돌아가기
              </button>
            )}
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-xs text-gray-400 mt-6">
            로그인 시{" "}
            <a href="#" className="underline hover:text-gray-600">이용약관</a> 및{" "}
            <a href="#" className="underline hover:text-gray-600">개인정보처리방침</a>에 동의합니다
          </p>
        </div>
      </main>
    </div>
  );
}
