import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Feed from './pages/Feed';
import SkillDetail from './pages/SkillDetail';

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/skill/:id" element={<SkillDetail />} />
        </Routes>
      </main>
    </div>
  );
}
