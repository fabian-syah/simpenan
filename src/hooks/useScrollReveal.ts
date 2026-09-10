import { useEffect } from 'react';

/**
 * useScrollReveal
 * High-performance, lightweight (0 dep) scroll reveal observer.
 * Automatically watches all elements with `.cv-scroll-reveal` and attaches `.is-revealed`.
 * Unobserves elements once revealed to ensure zero memory / CPU overhead.
 */
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: immediately reveal all elements if IntersectionObserver is unsupported
      document.querySelectorAll('.cv-scroll-reveal').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -20px 0px',
        threshold: [0, 0.08],
      }
    );

    const elements = document.querySelectorAll('.cv-scroll-reveal:not(.is-revealed)');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, deps);
}
