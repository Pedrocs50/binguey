import type { ReactNode } from "react";
import { Link } from "./Link";
import { UpdateBanner } from "./UpdateBanner";

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem("tema", next);
  } catch {
    /* ignora */
  }
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header>
        <div className="container cab-int">
          <Link className="marca" href="/">
            binguey
          </Link>
          <nav className="nav" aria-label="Principal">
            <button type="button" className="tema" onClick={toggleTheme} aria-label="Alternar tema claro e escuro">
              ◐
            </button>
          </nav>
        </div>
      </header>
      <main className="container pagina">
        <UpdateBanner />
        {children}
      </main>
      <footer className="rodape">
        <div className="container rodape-int">
          <span>© {new Date().getFullYear()} binguey</span>
          <span>bingo cooperativo</span>
        </div>
      </footer>
    </>
  );
}
