import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Button from './Button';

interface CollapsibleContentProps {
    children: React.ReactNode;
    lineClamp?: number; // Number of lines to clamp to
    buttonTexts?: { more: string; less: string };
    className?: string; // For the content wrapper
    buttonClassName?: string;
    buttonSize?: 'sm' | 'md';
    durationMs?: number; // Length of the open/close height animation
}

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CollapsibleContent: React.FC<CollapsibleContentProps> = ({
    children,
    buttonSize,
    lineClamp = 3,
    buttonTexts = { more: 'Read More', less: 'Read Less' },
    className = '',
    buttonClassName = 'not-italic mt-2',
    durationMs = 260,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isActuallyOverflowing, setIsActuallyOverflowing] = useState(false);
    // while animating we drop the clamp and drive the height explicitly
    const [isAnimating, setIsAnimating] = useState(false);
    const [maxHeight, setMaxHeight] = useState<number | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // height of the clamped state, captured just before we open
    const collapsedHeightRef = useRef<number | null>(null);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const endAnimation = useCallback(() => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
        setIsAnimating(false);
        setMaxHeight(null);
    }, []);

    // transitionend never fires if the two heights match, so always arm a fallback
    const armFallback = useCallback(() => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = setTimeout(endAnimation, durationMs + 80);
    }, [durationMs, endAnimation]);

    useLayoutEffect(
        () => () => {
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        },
        []
    );

    // while animating the content is unclamped, so overflow can't be measured
    useLayoutEffect(() => {
        if (isAnimating) return;
        const element = contentRef.current;
        if (!element) return;
        if (!isExpanded) {
            const isClamped = element.scrollHeight > element.clientHeight;
            setIsActuallyOverflowing(isClamped);
        } else {
            setIsActuallyOverflowing(false); // When expanded, it's not considered "overflowing" in clamped sense
        }
    }, [children, isExpanded, isAnimating, lineClamp]);

    const toggleExpanded = () => {
        const element = contentRef.current;
        if (!element || !lineClamp || prefersReducedMotion()) {
            setIsExpanded((prev) => !prev);
            return;
        }

        if (!isExpanded) {
            const collapsedHeight = element.clientHeight;
            collapsedHeightRef.current = collapsedHeight;
            // one render: clamp comes off, height pinned to where it already was
            setIsAnimating(true);
            setIsExpanded(true);
            setMaxHeight(collapsedHeight);
            armFallback();
            requestAnimationFrame(() => {
                const full = contentRef.current?.scrollHeight;
                if (full != null) setMaxHeight(full);
            });
        } else {
            const fullHeight = element.scrollHeight;
            setIsAnimating(true);
            setMaxHeight(fullHeight);
            armFallback();
            requestAnimationFrame(() => {
                setIsExpanded(false);
                setMaxHeight(collapsedHeightRef.current ?? 0);
            });
        }
    };

    const handleTransitionEnd = useCallback(
        (event: React.TransitionEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget || event.propertyName !== 'max-height') {
                return;
            }
            endAnimation();
        },
        [endAnimation]
    );

    const isClamped = !isExpanded && !isAnimating && !!lineClamp;
    const showButton = isExpanded || isAnimating || isActuallyOverflowing;

    return (
        <div className={className}>
            <div
                ref={contentRef}
                className={isClamped ? `line-clamp-${lineClamp}` : ''}
                onTransitionEnd={handleTransitionEnd}
                style={{
                    ...(isClamped
                        ? {
                              WebkitLineClamp: lineClamp,
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                          }
                        : {}),
                    ...(isAnimating && maxHeight != null
                        ? {
                              maxHeight,
                              overflow: 'hidden',
                              transition: `max-height ${durationMs}ms ease-in-out`,
                          }
                        : {}),
                }}
            >
                {children}
            </div>
            {showButton && (
                <Button
                    onClick={toggleExpanded}
                    variant="link"
                    size={buttonSize === 'sm' ? 'xs' : 'sm'}
                    className={buttonClassName}
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? buttonTexts.less : buttonTexts.more}
                    {isExpanded ? (
                        <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                    )}
                </Button>
            )}
        </div>
    );
};

export default CollapsibleContent;
