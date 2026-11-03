import { Link } from 'react-router-dom';
import { LOGO, TAGLINE } from '@/config.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <Link to="/" aria-label="Time Machine — home"><img src={LOGO} alt="Time Machine" width="132" height="36" loading="lazy" /></Link>
          <p>A free, community-driven archive documenting Doraemon's episodes, movies, characters, and history, so none of it is forgotten.</p>
          <p className="site-footer__tagline">{TAGLINE}</p>
        </div>

        <nav className="site-footer__col" aria-label="Archive">
          <h2>Archive</h2>
          <ul>
            <li><Link to="/anime/1979">Anime (1979)</Link></li>
            <li><Link to="/anime/2005">Anime (2005)</Link></li>
            <li><Link to="/movies">Movies</Link></li>
            <li><Link to="/historical/1973">Anime (1973)</Link></li>
            <li><Link to="/characters">Characters</Link></li>
            <li><Link to="/gadgets">Gadgets</Link></li>
          </ul>
        </nav>

        <nav className="site-footer__col" aria-label="Project">
          <h2>Project</h2>
          <ul>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contribute">Contribute</Link></li>
            <li><Link to="/search">Search</Link></li>
            <li><Link to="/stats">Statistics</Link></li>
            <li><Link to="/log">Contribution log</Link></li>
          </ul>
        </nav>
      </div>
      <div className="container site-footer__legal">
        <p>
          © 2026 Time Machine contributors. Site code is released under the MIT licence. Doraemon, its characters, artwork, and
          media belong to their respective rights holders. Time Machine is an unofficial fan project, is not affiliated with or
          endorsed by them, and does not host copyrighted video.
        </p>
      </div>
    </footer>
  );
}
