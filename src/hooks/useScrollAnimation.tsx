import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useScrollAnimation(
  sectionCount: number,
  options: UseScrollAnimationOptions = {}
) {
  const { threshold = 0.3, rootMargin = '-10% 0px -10% 0px' } = options;
  const [activeSection, setActiveSection] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set([0]));
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setSectionRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    sectionRefs.current[index] = el;
  }, []);

  const scrollToSection = useCallback((index: number) => {
    const section = sectionRefs.current[index];
    if (section) {
      // Find the scrollable parent (the form)
      const scrollableParent = section.closest('.form-scroll-container') || section.parentElement?.parentElement;
      if (scrollableParent) {
        const sectionTop = section.offsetTop - scrollableParent.getBoundingClientRect().top;
        scrollableParent.scrollTo({
          top: section.offsetTop - 20,
          behavior: 'smooth'
        });
      } else {
        // Fallback to scrollIntoView
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    // Set initial visible sections for better UX
    setVisibleSections(new Set([0, 1, 2, 3, 4, 5]));
    
    sectionRefs.current.forEach((section, index) => {
      if (!section) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSections(prev => new Set([...prev, index]));
              // Update active section based on which section is most visible
              if (entry.intersectionRatio > threshold) {
                setActiveSection(index);
              }
            }
          });
        },
        {
          threshold: [0.1, threshold, 0.6],
          rootMargin
        }
      );

      observer.observe(section);
      observers.push(observer);
    });

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [sectionCount, threshold, rootMargin]);

  return {
    activeSection,
    visibleSections,
    setSectionRef,
    scrollToSection,
    containerRef,
    isVisible: (index: number) => visibleSections.has(index)
  };
}

// Hook for individual element scroll visibility
interface UseElementVisibilityOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useElementVisibility<T extends HTMLElement = HTMLDivElement>(
  options: UseElementVisibilityOptions = {}
) {
  const { threshold = 0.1, rootMargin = "0px", triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isVisible };
}

// Component wrapper for scroll animations
interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  animation?: "fade-up" | "fade-in" | "scale-in" | "slide-left" | "slide-right";
}

export function ScrollAnimation({ 
  children, 
  className = "", 
  delay = 0,
  animation = "fade-up" 
}: ScrollAnimationProps) {
  const { ref, isVisible } = useElementVisibility<HTMLDivElement>();

  const animationClasses = {
    "fade-up": "translate-y-8 opacity-0",
    "fade-in": "opacity-0",
    "scale-in": "scale-95 opacity-0",
    "slide-left": "translate-x-8 opacity-0",
    "slide-right": "-translate-x-8 opacity-0",
  };

  const visibleClasses = "translate-y-0 translate-x-0 scale-100 opacity-100";

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${
        isVisible ? visibleClasses : animationClasses[animation]
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
