

import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  storageKey: string;
  defaultPosition: Position;
  buttonSize?: number;
}

export function useDraggable({ storageKey, defaultPosition, buttonSize = 56 }: UseDraggableOptions) {
  const [position, setPosition] = useState<Position>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const hasDraggedRef = useRef(false);

  // Always start at default position on page load
  // Position is only saved in sessionStorage for current tab navigation
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate position is within viewport
        const maxX = window.innerWidth - buttonSize;
        const maxY = window.innerHeight - buttonSize;
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        });
      }
      // Clear old localStorage data
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to load position:', e);
    }
  }, [storageKey, buttonSize]);

  // Save position to sessionStorage (only for current tab)
  const savePosition = useCallback((pos: Position) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pos));
    } catch (e) {
      console.error('Failed to save position:', e);
    }
  }, [storageKey]);

  // Constrain position within viewport
  const constrainPosition = useCallback((x: number, y: number): Position => {
    const maxX = window.innerWidth - buttonSize;
    const maxY = window.innerHeight - buttonSize;
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }, [buttonSize]);

  // Handle drag start (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  // Handle drag start (touch)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // Only set hasDragged if moved more than 5px
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }

      const newPos = constrainPosition(
        dragStartRef.current.posX + deltaX,
        dragStartRef.current.posY + deltaY
      );
      setPosition(newPos);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }

      const newPos = constrainPosition(
        dragStartRef.current.posX + deltaX,
        dragStartRef.current.posY + deltaY
      );
      setPosition(newPos);
    };

    const handleEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      savePosition(position);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, position, constrainPosition, savePosition]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => constrainPosition(prev.x, prev.y));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainPosition]);

  return {
    position,
    isDragging,
    hasDragged: () => hasDraggedRef.current,
    handlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
    },
  };
}
