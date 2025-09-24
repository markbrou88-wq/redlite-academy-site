import { Routes, Route, Link } from "react-router-dom";
import Standings from "./pages/Standings";
import Leaders from "./pages/Leaders";
import Games from "./pages/Games";
import Game from "./pages/Game"; // we'll create this next

export default function App() {
  return (
    <div>
      {/* super simple menu so you can click around */}
      <nav className="p-4 space-x-4 bg-gray-100">
        <Link to="/standings">Standings</Link>
        <Link to="/leaders">Leaders</Link>
        <Link to="/games">Games</Link>
      </nav>

      <Routes>
        <Route path="/standings" element={<Standings />} />
        <Route path="/leaders" element={<Leaders />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:slug" element={<Game />} />
      </Routes>
    </div>
  );
}
