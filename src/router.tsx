// src/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";
import Standings from "./pages/Standings";
import Leaders from "./pages/Leaders";
import Games from "./pages/Games";
import GameSummary from "./pages/GameSummary";
import Scorer from "./pages/Scorer";
import SignIn from "./pages/SignIn"; // whatever your sign-in page is

function RequireAuth({ children }: { children: JSX.Element }) {
  // simple client-side guard
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthed(!!user);
      setReady(true);
    })();
  }, []);
  if (!ready) return null;
  return authed ? children : <Navigate to="/signin" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/league/standings" replace /> },
      { path: "/signin", element: <SignIn /> },
      { path: "/league/standings", element: <Standings /> },
      { path: "/league/leaders", element: <Leaders /> },
      { path: "/league/games", element: <Games /> },
      { path: "/league/games/:slug", element: <GameSummary /> },
      { path: "/admin/scorer", element: (
          <RequireAuth><Scorer /></RequireAuth>
        ) },
      { path: "*", element: <Navigate to="/league/standings" replace /> },
    ],
  },
]);
