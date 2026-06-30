"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDarkMode } from '../context/DarkModeContext';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const navLinks = [
    { name: 'Início', path: '/' },
    { name: 'Quem Somos', path: '/about' },
    { name: 'Serviços', path: '/services' },
    { name: 'Imóveis', path: '/property' },
    { name: 'A Nossa Equipa', path: '/agents' },
    { name: 'Contactos', path: '/contact' },
  ];

  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = navLinks.findIndex(
    (item) => item.path === pathname
  );

  const updatePill = useCallback(() => {
    if (activeIndex === -1 || !navRef.current || !linkRefs.current[activeIndex]) return;
    const navRect = navRef.current.getBoundingClientRect();
    const linkRect = linkRefs.current[activeIndex]!.getBoundingClientRect();
    setPillStyle({
      left: linkRect.left - navRect.left,
      width: linkRect.width,
    });
  }, [activeIndex]);

  useEffect(() => {
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  return (
    <div className="sticky top-2 z-50 mx-3 sm:mx-6 lg:mx-8 h-16 md:h-20">
      <header className="absolute inset-x-0 top-0 bg-white/90 backdrop-blur-md border border-gray-200/60 rounded-2xl shadow-sm transition-colors duration-300 dark:bg-gray-900/90 dark:border-gray-700/60">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <img
                src={isDarkMode
                  ? "https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/848532cc-bf9e-4add-bf26-85b95062c2fd.png"
                  : "https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/logoinfitiy.png"
                }
                alt="Infinity Group"
                className="h-10 md:h-9 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation - Centered */}
            <nav ref={navRef} className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {/* Animated pill background */}
              {pillStyle && (
                <div
                  className="absolute bg-gray-100 rounded-full shadow-sm"
                  style={{
                    left: pillStyle.left,
                    width: pillStyle.width,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: 'calc(100% - 4px)',
                    transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              )}
              {navLinks.map((item, i) => (
                <Link
                  key={item.name}
                  href={item.path}
                  ref={(el) => { linkRefs.current[i] = el; }}
                  className={`relative z-10 text-[13.5px] tracking-wide font-light transition-colors duration-200 px-5 py-2 rounded-full ${
                    pathname === item.path
                      ? 'text-black'
                      : 'text-gray-500 hover:text-black'
                  }`}
                  style={{ fontFamily: "'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? (
                  <Sun size={18} className="text-amber-500" />
                ) : (
                  <Moon size={18} className="text-gray-600" />
                )}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              {/* Dark Mode Toggle - Mobile */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? (
                  <Sun size={20} className="text-amber-500" />
                ) : (
                  <Moon size={20} className="text-gray-600" />
                )}
              </button>
              <button
                className="p-2 z-50 relative"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            isMobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="flex flex-col gap-1 px-2 pb-4 pt-2 border-t border-gray-100/60">
            {navLinks.map((item) => (
              <Link
                key={item.name}
                href={item.path}
                className={`px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  pathname === item.path
                    ? 'text-black bg-gray-100/80 font-medium'
                    : 'text-gray-500 active:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </div>
  );
}
