import { Routes, Route } from 'react-router-dom'
import { ScrollToTop } from './components/common/ScrollToTop'
import HomePage from './pages/HomePage'
import TimelinePage from './pages/TimelinePage'
import ElderlyPage from './pages/ElderlyPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import SajuPage from './pages/SajuPage'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        본문 바로가기
      </a>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/elderly" element={<ElderlyPage />} />
        <Route path="/listen" element={<ElderlyPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/saju" element={<SajuPage />} />
      </Routes>
    </div>
  )
}

export default App
