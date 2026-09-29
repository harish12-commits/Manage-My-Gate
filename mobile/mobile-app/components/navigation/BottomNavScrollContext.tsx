import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

interface BottomNavScrollContextType {
  isCompact: boolean;
  setIsCompact: (compact: boolean) => void;
  handleScroll: (event: any) => void;
  scrollHandlerProps: {
    onScroll: (event: any) => void;
    scrollEventThrottle: number;
  };
}

const BottomNavScrollContext = createContext<BottomNavScrollContextType | null>(null);

let globalIsCompact = false;
const globalListeners = new Set<(compact: boolean) => void>();

export const setGlobalBottomNavCompact = (compact: boolean) => {
  if (globalIsCompact !== compact) {
    globalIsCompact = compact;
    globalListeners.forEach((listener) => listener(compact));
  }
};

export const subscribeGlobalBottomNavCompact = (listener: (compact: boolean) => void) => {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
};

const extractScrollY = (event: any): number => {
  if (typeof event === 'number') return event;
  if (!event) return 0;
  if (typeof event.nativeEvent?.contentOffset?.y === 'number') {
    return event.nativeEvent.contentOffset.y;
  }
  if (typeof event.contentOffset?.y === 'number') {
    return event.contentOffset.y;
  }
  return 0;
};

export const BottomNavScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCompact, setIsCompactState] = useState<boolean>(globalIsCompact);
  const isCompactRef = useRef<boolean>(globalIsCompact);
  const lastScrollY = useRef<number>(0);
  const lastScrollTime = useRef<number>(0);

  const setIsCompact = useCallback((compact: boolean) => {
    if (isCompactRef.current === compact) return;
    isCompactRef.current = compact;
    setIsCompactState(compact);
    setGlobalBottomNavCompact(compact);
  }, []);

  const handleScroll = useCallback(
    (event: any) => {
      const currentY = extractScrollY(event);

      // Protect against iOS overscroll bounce at top
      if (currentY <= 15) {
        setIsCompact(false);
        lastScrollY.current = Math.max(0, currentY);
        return;
      }

      const delta = currentY - lastScrollY.current;

      // Scrolling Down threshold: 16px -> Compact / Minimize breadth
      if (delta > 16) {
        setIsCompact(true);
        lastScrollY.current = currentY;
      }
      // Scrolling Up threshold: -16px -> Expand / Restore breadth
      else if (delta < -16) {
        setIsCompact(false);
        lastScrollY.current = currentY;
      }
    },
    [setIsCompact]
  );

  const scrollHandlerProps = {
    onScroll: handleScroll,
    scrollEventThrottle: 16,
  };

  return (
    <BottomNavScrollContext.Provider
      value={{
        isCompact,
        setIsCompact,
        handleScroll,
        scrollHandlerProps,
      }}
    >
      {children}
    </BottomNavScrollContext.Provider>
  );
};

export const useBottomNavScroll = () => {
  const context = useContext(BottomNavScrollContext);
  const [compact, setCompact] = useState(globalIsCompact);
  const localLastY = useRef(0);

  React.useEffect(() => {
    let isMounted = true;
    const unsub = subscribeGlobalBottomNavCompact((val) => {
      if (isMounted) {
        setCompact(val);
      }
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleLocalScroll = useCallback((event: any) => {
    const currentY = extractScrollY(event);

    if (currentY <= 15) {
      setGlobalBottomNavCompact(false);
      localLastY.current = Math.max(0, currentY);
      return;
    }

    const delta = currentY - localLastY.current;

    if (delta > 16) {
      setGlobalBottomNavCompact(true);
      localLastY.current = currentY;
    } else if (delta < -16) {
      setGlobalBottomNavCompact(false);
      localLastY.current = currentY;
    }
  }, []);

  if (context) {
    return context;
  }

  return {
    isCompact: compact,
    setIsCompact: setGlobalBottomNavCompact,
    handleScroll: handleLocalScroll,
    scrollHandlerProps: {
      onScroll: handleLocalScroll,
      scrollEventThrottle: 16,
    },
  };
};

export default BottomNavScrollContext;
