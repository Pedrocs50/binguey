import { Layout } from "./components/Layout";
import { Link } from "./components/Link";
import { matchPath, usePath } from "./lib/router";
import { Home } from "./pages/Home";
import { Overlay } from "./pages/Overlay";
import { Join } from "./pages/Join";
import { RoomPage } from "./pages/Room";

export function App() {
  const path = usePath();
  if (path === "/overlay") return <Overlay />;
  const join = matchPath(path, "j");
  const room = matchPath(path, "r");

  return (
    <Layout>
      {path === "/" ? (
        <Home />
      ) : join ? (
        <Join key={join} code={join} />
      ) : room ? (
        <RoomPage key={room} code={room.toUpperCase()} />
      ) : (
        <>
          <div className="aviso">Página não encontrada.</div>
          <Link href="/">voltar ao início</Link>
        </>
      )}
    </Layout>
  );
}
