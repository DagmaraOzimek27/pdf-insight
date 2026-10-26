import { UI_COPY } from '../lib/uiCopy';

export function Header() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__brand">
          <img
            src={logoSrc}
            alt={UI_COPY.header.logoAlt}
            width={250}
            height={64}
            className="site-header__logo"
          />
        </div>
        <p className="site-header__subtitle">{UI_COPY.header.subtitle}</p>
      </div>
    </header>
  );
}
