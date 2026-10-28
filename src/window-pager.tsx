import { useRef, useState, type KeyboardEvent, type UIEvent } from "react";

import { ModuleContent } from "./module-view";
import { useWorkspaceContext } from "./workspace-context";

import type { WindowConfig } from "./layout";

interface WindowPagerProps {
  windows: readonly WindowConfig[];
}

const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

/** The windows of one tile: a scroller with scroll-snap, and dots to go to a window. All windows stay mounted. */
export function WindowPager({ windows }: WindowPagerProps) {
  const { windowLabel } = useWorkspaceContext();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToWindow = (index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior: isReduced ? "auto" : "smooth" });
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth > 0) setActiveIndex(Math.round(Math.abs(scrollLeft) / clientWidth));
  };

  const handleDotKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ARROW_STEPS[event.key];
    const next = step === undefined ? undefined : index + step;
    if (next === undefined || next < 0 || next >= windows.length) return;
    event.preventDefault();
    dotsRef.current?.querySelectorAll("button")[next]?.focus();
    scrollToWindow(next);
  };

  return (
    <>
      <div ref={scrollerRef} className="tessera-windows" onScroll={handleScroll}>
        {windows.map((config, i) => (
          <div key={i} className="tessera-window" inert={i !== activeIndex}>
            <ModuleContent moduleId={config.module} props={config.props} />
          </div>
        ))}
      </div>
      {windows.length > 1 && (
        <div ref={dotsRef} className="tessera-window-dots">
          {windows.map((_, i) => (
            <button
              key={i}
              type="button"
              className="tessera-window-dot"
              aria-label={windowLabel(i + 1, windows.length)}
              aria-current={i === activeIndex ? "true" : undefined}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => scrollToWindow(i)}
              onKeyDown={(event) => handleDotKeyDown(event, i)}
            />
          ))}
        </div>
      )}
    </>
  );
}
