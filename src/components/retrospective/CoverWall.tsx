import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FrameImage } from '../../utils/frameSources';
import Mosaic, { MosaicVeil } from './Mosaic';
import { leadingTiles } from './mosaicLayout';

interface CoverWallProps {
    /** Which report's wall this is; a new key is a new wall, crossfaded in. */
    wallKey: string;
    images: FrameImage[];
    strength?: number;
}

/** Seconds for one wall to dissolve into the next. */
const FADE = 0.9;
/**
 * The longest the old wall waits on the new one's art before handing over
 * anyway: on a slow connection the swap should still follow the click.
 */
const PRELOAD_TIMEOUT_MS = 1500;

/** Resolves once every image is fetched and decoded, or failed, or the wait runs out. */
const preload = (images: FrameImage[]): Promise<void> => {
    const all = Promise.allSettled(
        images.map((image) => {
            const img = new Image();
            img.decoding = 'async';
            img.src = image.url;
            return img.decode();
        })
    ).then(() => undefined);
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_TIMEOUT_MS));
    return Promise.race([all, timeout]);
};

/**
 * The cover's {@link Mosaic}, crossfading from one report's wall to the next.
 *
 * The cover stays mounted while the reader moves between years and members, so
 * without this the wall would blank and its posters pop in one by one. Instead
 * the outgoing wall holds while the incoming one's first screenful is fetched
 * and decoded, then the new wall dissolves in over it and the old one goes.
 */
const CoverWall: React.FC<CoverWallProps> = ({ wallKey, images, strength }) => {
    const [shown, setShown] = useState({ key: wallKey, images });

    useEffect(() => {
        // The same report with more art (a member's log arriving): no fade.
        if (wallKey === shown.key) {
            if (images !== shown.images) setShown({ key: wallKey, images });
            return;
        }
        let cancelled = false;
        preload(leadingTiles(images)).then(() => {
            if (!cancelled) setShown({ key: wallKey, images });
        });
        return () => {
            cancelled = true;
        };
    }, [wallKey, images, shown]);

    return (
        <>
            {/* A true crossfade, the old art going as the new arrives. The art
                is see-through (dimmed, with gaps between tiles), so holding the
                old wall solid under the new one would leave it showing through
                until it was removed, and the end of the fade would snap. */}
            <AnimatePresence initial={false}>
                <motion.div
                    key={shown.key}
                    className="pointer-events-none absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: FADE, ease: 'easeInOut' }}
                >
                    <Mosaic images={shown.images} strength={strength} veiled={false} />
                </motion.div>
            </AnimatePresence>
            {/* One veil over both walls, outside the fade, so only the art
                changes and the darkness behind the copy holds steady. */}
            {shown.images.length > 0 && <MosaicVeil />}
        </>
    );
};

export default CoverWall;
