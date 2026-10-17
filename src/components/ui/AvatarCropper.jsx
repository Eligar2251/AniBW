// src/components/ui/AvatarCropper.jsx
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Upload, ZoomIn, ZoomOut, Move, RotateCcw } from "lucide-react";
import styles from "./AvatarCropper.module.css";

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const WHEEL_STEP = 0.08;
const BTN_STEP = 0.15;

function clampScale(value) {
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
}

// offsetX:
//   50 = по центру
//   больше 50 = смещение вправо
//   меньше 50 = смещение влево
//
// offsetY:
//   0 = верх изображения прижат к верхнему краю контейнера
//   отрицательные значения = двигаем изображение вверх
//   положительные запрещены
function clampOffsetY(value) {
  return Math.min(value, 0);
}

function getFrame(container, image, scale, offsetX, offsetY) {
  if (!container.width || !container.height || !image.width || !image.height) {
    return null;
  }

  const fitScale = Math.min(
    container.width / image.width,
    container.height / image.height,
  );

  const renderedWidth = image.width * fitScale * scale;
  const renderedHeight = image.height * fitScale * scale;

  const baseLeft = (container.width - renderedWidth) / 2;
  const left = baseLeft + ((offsetX - 50) / 100) * container.width;

  const top = clampOffsetY((offsetY / 100) * container.height);

  return {
    width: renderedWidth,
    height: renderedHeight,
    left,
    top,
  };
}

export default function AvatarCropper({
  src,
  scale: initialScale = 1,
  offsetX: initialOffsetX = 50,
  offsetY: initialOffsetY = 0,
  onChange,
  onFileSelect,
  disabled = false,
  aspectRatio = "2/3",
}) {
  const containerRef = useRef(null);
  const fileRef = useRef(null);
  const rafRef = useRef(null);

  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startOX: 50,
    startOY: 0,
  });

  const [scale, setScale] = useState(clampScale(initialScale));
  const [offsetX, setOffsetX] = useState(initialOffsetX);
  const [offsetY, setOffsetY] = useState(clampOffsetY(initialOffsetY));
  const [isDragging, setIsDragging] = useState(false);

  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });

  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
  });

  // Синхронизация извне
  useEffect(() => {
    setScale(clampScale(initialScale));
    setOffsetX(initialOffsetX);
    setOffsetY(clampOffsetY(initialOffsetY));
  }, [initialScale, initialOffsetX, initialOffsetY]);

  // Размер контейнера
  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };

    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Натуральный размер картинки
  useEffect(() => {
    if (!src) {
      setImageSize({ width: 0, height: 0 });
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImageSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = src;
  }, [src]);

  const emitChange = useCallback(
    (nextScale, nextOffsetX, nextOffsetY) => {
      onChange?.({
        scale: Math.round(nextScale * 100) / 100,
        offsetX: Math.round(nextOffsetX * 10) / 10,
        offsetY: Math.round(clampOffsetY(nextOffsetY) * 10) / 10,
      });
    },
    [onChange],
  );

  const applyState = useCallback(
    (nextScale, nextOffsetX, nextOffsetY, shouldEmit = true) => {
      const safeScale = clampScale(nextScale);
      const safeOffsetY = clampOffsetY(nextOffsetY);

      setScale(safeScale);
      setOffsetX(nextOffsetX);
      setOffsetY(safeOffsetY);

      if (shouldEmit) {
        emitChange(safeScale, nextOffsetX, safeOffsetY);
      }
    },
    [emitChange],
  );

  const frame = useMemo(
    () => getFrame(containerSize, imageSize, scale, offsetX, offsetY),
    [containerSize, imageSize, scale, offsetX, offsetY],
  );

  const schedulePositionUpdate = useCallback((nextX, nextY) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      setOffsetX(nextX);
      setOffsetY(clampOffsetY(nextY));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const zoomTo = useCallback(
    (delta, clientX = null, clientY = null) => {
      if (disabled || !src) return;

      const nextScale = clampScale(scale + delta);
      if (!frame || !containerRef.current || nextScale === scale) {
        applyState(nextScale, offsetX, offsetY);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const localX =
        clientX == null ? rect.width / 2 : Math.max(0, clientX - rect.left);
      const localY =
        clientY == null ? rect.height / 2 : Math.max(0, clientY - rect.top);

      const relX = frame.width > 0 ? (localX - frame.left) / frame.width : 0.5;
      const relY = frame.height > 0 ? (localY - frame.top) / frame.height : 0.5;

      const nextFrameBase = getFrame(
        containerSize,
        imageSize,
        nextScale,
        offsetX,
        offsetY,
      );

      if (!nextFrameBase) {
        applyState(nextScale, offsetX, offsetY);
        return;
      }

      const desiredLeft = localX - relX * nextFrameBase.width;
      const desiredTop = localY - relY * nextFrameBase.height;

      const baseLeft = (containerSize.width - nextFrameBase.width) / 2;

      const nextOffsetX =
        50 + ((desiredLeft - baseLeft) / containerSize.width) * 100;

      const nextOffsetY = (desiredTop / containerSize.height) * 100;

      applyState(nextScale, nextOffsetX, nextOffsetY);
    },
    [
      disabled,
      src,
      scale,
      frame,
      applyState,
      offsetX,
      offsetY,
      containerSize,
      imageSize,
    ],
  );

  // ВАЖНО: нативный wheel listener с passive:false,
  // чтобы скролл не прокручивал страницу
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !src) return;

    const handleNativeWheel = (e) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      zoomTo(delta, e.clientX, e.clientY);
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
    };
  }, [src, disabled, zoomTo]);

  const handleMouseDown = useCallback(
    (e) => {
      if (disabled || !src || e.button !== 0) return;
      e.preventDefault();

      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startOX: offsetX,
        startOY: offsetY,
      };

      setIsDragging(true);
    },
    [disabled, src, offsetX, offsetY],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragRef.current.dragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragRef.current.startY) / rect.height) * 100;

      const nextOffsetX = dragRef.current.startOX + dxPct;
      const nextOffsetY = dragRef.current.startOY + dyPct;

      schedulePositionUpdate(nextOffsetX, nextOffsetY);
    },
    [schedulePositionUpdate],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current.dragging) return;

    dragRef.current.dragging = false;
    setIsDragging(false);
    emitChange(scale, offsetX, offsetY);
  }, [scale, offsetX, offsetY, emitChange]);

  const handleTouchStart = useCallback(
    (e) => {
      if (disabled || !src) return;

      const touch = e.touches[0];
      if (!touch) return;

      dragRef.current = {
        dragging: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startOX: offsetX,
        startOY: offsetY,
      };

      setIsDragging(true);
    },
    [disabled, src, offsetX, offsetY],
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!dragRef.current.dragging || !containerRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const dxPct =
        ((touch.clientX - dragRef.current.startX) / rect.width) * 100;
      const dyPct =
        ((touch.clientY - dragRef.current.startY) / rect.height) * 100;

      const nextOffsetX = dragRef.current.startOX + dxPct;
      const nextOffsetY = dragRef.current.startOY + dyPct;

      schedulePositionUpdate(nextOffsetX, nextOffsetY);
    },
    [schedulePositionUpdate],
  );

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.dragging) return;

    dragRef.current.dragging = false;
    setIsDragging(false);
    emitChange(scale, offsetX, offsetY);
  }, [scale, offsetX, offsetY, emitChange]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleReset = useCallback(() => {
    applyState(1, 50, 0);
  }, [applyState]);

  const zoomIn = useCallback(() => {
    zoomTo(BTN_STEP);
  }, [zoomTo]);

  const zoomOut = useCallback(() => {
    zoomTo(-BTN_STEP);
  }, [zoomTo]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onFileSelect?.(file);
    handleReset();
  };

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={`${styles.container} ${isDragging ? styles.dragging : ""} ${!src ? styles.empty : ""}`}
        style={{ aspectRatio }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => {
          if (src && !disabled) handleReset();
        }}
        onClick={() => {
          if (!src && !disabled) fileRef.current?.click();
        }}
      >
        {src ? (
          <>
            <img
              src={src}
              alt=""
              className={styles.image}
              style={
                frame
                  ? {
                      width: `${frame.width}px`,
                      height: `${frame.height}px`,
                      left: `${frame.left}px`,
                      top: `${frame.top}px`,
                    }
                  : undefined
              }
              draggable={false}
            />

            <div
              className={`${styles.hint} ${isDragging ? styles.hintHidden : ""}`}
            >
              <Move size={14} strokeWidth={1.5} />
              <span>Перетащи · Колесо = масштаб · dblclick = сброс</span>
            </div>
          </>
        ) : (
          <div className={styles.placeholder}>
            <Upload size={28} strokeWidth={1} color="var(--color-text-faint)" />
            <span>Загрузить арт</span>
            <span className={styles.placeholderSub}>
              Можно приближать, отдалять и двигать
            </span>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      {src && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            title="Загрузить другое фото"
          >
            <Upload size={14} strokeWidth={1.5} />
          </button>

          <div className={styles.zoomGroup}>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={zoomOut}
              disabled={disabled || scale <= MIN_SCALE}
              title="Отдалить"
            >
              <ZoomOut size={14} strokeWidth={1.5} />
            </button>

            <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>

            <button
              type="button"
              className={styles.controlBtn}
              onClick={zoomIn}
              disabled={disabled || scale >= MAX_SCALE}
              title="Приблизить"
            >
              <ZoomIn size={14} strokeWidth={1.5} />
            </button>
          </div>

          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleReset}
            disabled={disabled}
            title="Сбросить"
          >
            <RotateCcw size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {!src && (
        <button
          type="button"
          className={styles.uploadBtn}
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
        >
          <Upload size={14} strokeWidth={1.5} />
          Выбрать изображение
        </button>
      )}
    </div>
  );
}
