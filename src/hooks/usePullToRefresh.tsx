import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "./use-mobile";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !isMobile) return;

    const container = containerRef.current;
    if (!container) return;

    let isAtTop = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if scrolled to top
      const scrollTop = container.scrollTop;
      isAtTop = scrollTop === 0;
      
      if (isAtTop && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing || !isAtTop) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      if (distance > 0) {
        // Apply resistance curve for natural feel
        const resistance = Math.min(distance / 2.5, threshold * 1.5);
        setPullDistance(resistance);

        // Prevent default scroll when pulling down
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;

      setIsPulling(false);

      if (pullDistance >= threshold) {
        // Haptic feedback when refresh is triggered
        if ('vibrate' in navigator) {
          navigator.vibrate(50); // Short vibration pulse
        }
        
        setIsRefreshing(true);
        try {
          await onRefresh();
          
          // Success haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate([30, 50, 30]); // Double pulse for success
          }
        } catch (error) {
          console.error("Refresh failed:", error);
          
          // Error haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 100]); // Triple pulse for error
          }
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, isMobile, isPulling, isRefreshing, onRefresh, pullDistance, threshold]);

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
  };
}
