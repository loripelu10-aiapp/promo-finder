/**
 * Language Switcher Component
 * Dropdown to switch between supported languages
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { LANGUAGE_METADATA, Language } from '../i18n/config';

export const LanguageSwitcher: React.FC = () => {
  const { language, changeLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = async (lang: Language) => {
    await changeLanguage(lang);
    setIsOpen(false);
  };

  const currentLang = LANGUAGE_METADATA[language] || LANGUAGE_METADATA.en;

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button
        className="language-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span className="language-flag">{currentLang.flag}</span>
        <span className="language-code">{language.toUpperCase()}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`chevron ${isOpen ? 'open' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="language-menu">
          {Object.entries(LANGUAGE_METADATA).map(([lang, meta]) => (
            <button
              key={lang}
              className={`language-option ${lang === language ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang as Language)}
            >
              <span className="language-flag">{meta.flag}</span>
              <span className="language-name">{meta.name}</span>
              {lang === language && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="check-icon"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .language-selector {
          position: relative;
          z-index: 20;
        }

        .language-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.75rem 1rem;
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .language-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .language-flag {
          font-size: 1.2rem;
          line-height: 1;
        }

        .language-code {
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .chevron {
          transition: transform 0.2s;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .language-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          overflow: hidden;
          min-width: 180px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .language-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          width: 100%;
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 0.9rem;
          font-family: inherit;
        }

        .language-option:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .language-option.active {
          background: rgba(255, 107, 0, 0.2);
        }

        .language-name {
          flex: 1;
          text-align: left;
        }

        .check-icon {
          color: #ff6b00;
          margin-left: auto;
        }

        @media (max-width: 768px) {
          .language-menu {
            right: auto;
            left: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LanguageSwitcher;
