import React from 'react';
import type { Track } from '../../config/retrospective';
import type { SoundtrackHandle } from '../../hooks/useSoundtrack';
import { soundtrackEmbedUrl } from '../../utils/youtubePlayer';

interface SoundtrackDockProps {
    /** Every choice, the one to start on first: see `playOrder`. */
    queue: Track[];
    soundtrack: SoundtrackHandle;
    /** The deck has closed and the music is fading: the tile fades with it. */
    leaving?: boolean;
}

/**
 * The soundtrack's player, which YouTube requires to stay visible and at least
 * 200×200 — so it gets a place of its own rather than sitting over the slides.
 *
 * It exists only while the show runs, and sits in the bay at the right end of
 * the deck's bottom bar (see `Story`), which is exactly its size plus a margin;
 * the slides end above the bar, so nothing is drawn under it. It is positioned
 * here rather than inside the bar so it outlives the deck by the second the
 * music takes to fade. The mute toggle and the "tap the video" hint are the
 * bar's, beside it.
 */
const SoundtrackDock: React.FC<SoundtrackDockProps> = ({ queue, soundtrack, leaving }) => {
    const { frameRef, onFrameLoad } = soundtrack;
    const [first, ...then] = queue;
    return (
        <figure
            className={`fixed bottom-[calc(env(safe-area-inset-bottom)+8px)] right-2 z-[80] sm:right-4 h-[200px] w-[200px] overflow-hidden rounded-md bg-black shadow-2xl ring-1 ring-slate-100/15 transition-opacity duration-1000 ${
                leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
        >
            <iframe
                // A new track is a new player: remounted rather than
                // re-pointed, so no message meant for the old one lands.
                key={first.id}
                ref={frameRef}
                onLoad={onFrameLoad}
                src={soundtrackEmbedUrl(
                    first.youtube,
                    window.location.origin,
                    then.map((t) => t.youtube)
                )}
                title={`Soundtrack: ${first.label}`}
                // `autoplay` delegates the page's tap to the embed, which is
                // what lets a play sent by message start with sound.
                allow="autoplay; encrypted-media; picture-in-picture"
                className="h-full w-full"
            />
        </figure>
    );
};

export default SoundtrackDock;
