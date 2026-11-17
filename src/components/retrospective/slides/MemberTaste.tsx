import React, { useEffect, useState } from 'react';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { fetchFilmSummary } from '../../../api/filmSummaries';
import { getPersonProfileByName, normalizePersonName } from '../../../utils/personUtils';
import { Headshot } from './shared';

interface MemberTasteProps {
    taste: NonNullable<MemberRetrospective['taste']>;
    director: MemberRetrospective['director'];
    accent: string;
}

/** A tally set as type, the biggest first and largest. */
const Words: React.FC<{ items: { name: string; count: number }[]; limit?: number }> = ({
    items,
    limit = 4,
}) => {
    const shown = items.slice(0, limit);
    const most = Math.max(1, ...shown.map((i) => i.count));
    return (
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-serif leading-none">
            {shown.map((item) => (
                <span
                    key={item.name}
                    className="text-slate-100"
                    style={{ fontSize: `${1.05 + (item.count / most) * 1.25}rem` }}
                >
                    {item.name}
                    <sup className="ml-0.5 text-xs text-slate-500">{item.count}</sup>
                </span>
            ))}
        </p>
    );
};

/**
 * The director's TMDb headshot. A director of a club film has one in the
 * bundled profile index; one known only from logs has it on a log film's crew,
 * which lives in the per-film summary file, so those are fetched until one
 * has it. Null until found, and when none of their films does.
 */
const useDirectorHeadshot = (director: MemberRetrospective['director']): string | null => {
    const name = director?.name ?? '';
    const ids = director?.imdbIDs.join(',') ?? '';
    const bundled = getPersonProfileByName(name)?.profileUrl ?? null;
    const [fetched, setFetched] = useState<{ key: string; url: string } | null>(null);
    const key = `${name}|${ids}`;

    useEffect(() => {
        if (bundled || !name || !ids) return;
        let live = true;
        const target = normalizePersonName(name);
        (async () => {
            for (const id of ids.split(',')) {
                const summary = await fetchFilmSummary(id);
                const url = summary?.crew?.find(
                    (c) => c.job === 'Director' && normalizePersonName(c.name) === target
                )?.profileUrl;
                if (url) {
                    if (live) setFetched({ key, url });
                    return;
                }
            }
        })();
        return () => {
            live = false;
        };
    }, [bundled, name, ids, key]);

    return bundled ?? (fetched?.key === key ? fetched.url : null);
};

/**
 * Their taste across both the club's films and their own: genres and decades
 * from everything, countries from club films alone (a log film's record has
 * none), and the director they kept coming back to.
 */
const MemberTaste: React.FC<MemberTasteProps> = ({ taste, director, accent }) => {
    const headshot = useDirectorHeadshot(director);
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>What you watched</Eyebrow>
            </Reveal>
            {taste.genres.length > 0 && (
                <Reveal step={1}>
                    <p
                        className="mb-2 text-sm text-slate-400"
                        style={{ marginTop: give('1.25rem', '0.75rem') }}
                    >
                        Genres
                    </p>
                    <Words items={taste.genres} />
                </Reveal>
            )}
            {taste.decades.length > 0 && (
                <Reveal step={1.7}>
                    <p
                        className="mb-2 text-sm text-slate-400"
                        style={{ marginTop: give('1.5rem', '0.75rem') }}
                    >
                        Decades
                    </p>
                    <Words items={taste.decades} limit={5} />
                </Reveal>
            )}
            {taste.countries.length > 0 && (
                <Reveal step={2.4}>
                    <p
                        className="mb-2 text-sm text-slate-400"
                        style={{ marginTop: give('1.5rem', '0.75rem') }}
                    >
                        Countries, among club films
                    </p>
                    <Words items={taste.countries} />
                </Reveal>
            )}
            {director && (
                <Reveal step={3.2}>
                    <div
                        className="flex items-center gap-4 border-t border-slate-100/10 sm:gap-5"
                        style={{
                            marginTop: give('2rem', '1rem'),
                            paddingTop: give('1.25rem', '0.75rem'),
                        }}
                    >
                        <Headshot
                            src={headshot}
                            name={director.name}
                            accent={accent}
                            size="h-16 w-16 sm:h-20 sm:w-20"
                        />
                        <p className="min-w-0 text-lg text-slate-300">
                            Most-watched director
                            <span className="block font-serif text-2xl text-slate-50">
                                {director.name}
                            </span>
                            <span className="block text-base text-slate-400">
                                {director.withClub + director.onOwn} films
                                {director.withClub && director.onOwn
                                    ? `, ${director.withClub} of them with the club`
                                    : ''}
                            </span>
                        </p>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberTaste;
