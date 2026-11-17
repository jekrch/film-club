import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { FrameImage } from '../../utils/frameSources';
import { prefersReducedMotion } from '../../utils/motion';
import { EAGER_PER_COLUMN, mosaicColumns } from './mosaicLayout';

interface MosaicProps {
    /** Posters and stills, in the order they should first appear. */
    images: FrameImage[];
    /** How strongly the art shows through, 0–1. */
    strength?: number;
    /**
     * Whether the wall brings its own {@link MosaicVeil}. Off when the caller
     * lays one veil over several walls, as a crossfade between them does.
     */
    veiled?: boolean;
    className?: string;
}

/**
 * Each column starts a little higher or lower, so the wall never settles into
 * rows. They all drift together, though: separate speeds read as busy. Offsets
 * in rem.
 */
const COLUMN_OFFSET = [0, 6, 2.5, 9, 4, 11];
/** Seconds for one leg of the drift. */
const DRIFT_DURATION = 130;

/**
 * What sits over the wall so copy can sit on it: darkest at the middle band
 * where the copy goes, and dissolving into the page at the top and bottom.
 */
export const MosaicVeil: React.FC = () => (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,43,0.82)_0%,rgba(15,23,43,0.55)_55%,rgba(15,23,43,0.2)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-page via-transparent to-page" />
    </div>
);

const columnVisibility = (column: number) =>
    column >= 4 ? 'hidden lg:flex' : column === 3 ? 'hidden sm:flex' : 'flex';

/**
 * The year's art, posters and stills together, laid in columns like a wall of
 * one-sheets and frame enlargements, and drifting slowly upward.
 *
 * Posters stand at 2:3 and stills lie at 16:9, so a column of both falls into
 * an uneven rhythm on its own. {@link wallColumns} shuffles the art into the
 * columns so a short year doesn't read as one list stamped over and over, and
 * the columns start at staggered heights. Reduced motion holds it still.
 */
const Mosaic: React.FC<MosaicProps> = ({
    images,
    strength = 0.35,
    veiled = true,
    className = '',
}) => {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());

    // Laid out from the full list, so a broken image just drops out of its
    // column instead of reshuffling the whole wall.
    const columns = useMemo(() => mosaicColumns(images), [images]);

    if (!images.length || images.every((image) => failed.has(image.url))) return null;

    const still = prefersReducedMotion();

    return (
        <div
            className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
            aria-hidden="true"
        >
            <div className="flex items-start gap-2" style={{ opacity: strength }}>
                {columns.map((tiles, column) => (
                    <motion.div
                        key={column}
                        className={`${columnVisibility(column)} min-w-0 flex-1 flex-col gap-2`}
                        style={{ marginTop: `-${COLUMN_OFFSET[column]}rem` }}
                        initial={{ y: '0%' }}
                        animate={still ? undefined : { y: ['0%', '-33%'] }}
                        transition={{
                            duration: DRIFT_DURATION,
                            ease: 'linear',
                            repeat: Infinity,
                            repeatType: 'mirror',
                        }}
                    >
                        {tiles.map((image, index) =>
                            failed.has(image.url) ? null : (
                                <img
                                    key={`${image.url}-${index}`}
                                    src={image.url}
                                    alt=""
                                    loading={index < EAGER_PER_COLUMN ? 'eager' : 'lazy'}
                                    decoding="async"
                                    className={`block w-full rounded-sm object-cover ${
                                        image.kind === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
                                    }`}
                                    onError={() =>
                                        setFailed((prev) => new Set(prev).add(image.url))
                                    }
                                />
                            )
                        )}
                    </motion.div>
                ))}
            </div>
            {veiled && <MosaicVeil />}
        </div>
    );
};

export default Mosaic;
