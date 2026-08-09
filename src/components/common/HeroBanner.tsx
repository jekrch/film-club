import classNames from 'classnames';
import React from 'react';
import { Film } from '../../types/film';
import BaseCard from './BaseCard';
import HeroCollageBackground from './HeroCollageBackground';

interface HeroBannerProps {
    /** Films the collage draws its frames from. It picks its own panels. */
    films: Film[];
    children: React.ReactNode;
    /** Classes for the card itself — page-level spacing belongs here. */
    className?: string;
    /**
     * Classes for the content column that sits above the collage. Override
     * only when the banner's content needs a different width or layout than
     * the centered prose default.
     */
    contentClassName?: string;
}

/** Centered prose column: the treatment the About and Almanac banners use. */
const DEFAULT_CONTENT = 'mx-auto max-w-2xl px-2 py-10 sm:px-6 sm:py-12 md:py-14 text-center';

/**
 * A hero banner: a collage of stills washed behind a column of copy. The card
 * bleeds past the page container on wide screens (`banner-bleed`), and the
 * collage brightens toward the left and right edges — the extra width it gains
 * out there is art, not text, so it doesn't have to stay legible.
 *
 * Must stay a direct child of PageLayout's container for `banner-bleed` to
 * line up.
 */
const HeroBanner: React.FC<HeroBannerProps> = ({
    films,
    children,
    className,
    contentClassName = DEFAULT_CONTENT,
}) => (
    <BaseCard className={classNames('banner-bleed overflow-hidden relative', className)}>
        <HeroCollageBackground films={films} />
        <div className={classNames('relative z-30', contentClassName)}>{children}</div>
    </BaseCard>
);

export default HeroBanner;
