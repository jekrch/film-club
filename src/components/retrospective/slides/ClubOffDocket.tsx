import React, { useEffect, useState } from 'react';
import { fetchFilmSummary } from '../../../api/filmSummaries';
import { getTeamMemberByName } from '../../../types/team';
import { isImageSource } from '../../../utils/imageUrl';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import FeatureStill from '../FeatureStill';
import { FaceStack, MemberFace, Poster } from './shared';
import { FACE_RING, listNames } from './format';

interface ClubOffDocketProps {
    offDocket: NonNullable<ClubRetrospective['offDocket']>;
    sharedStills: string[];
    accent: string;
}

/**
 * What we watched on our own, between screenings: everyone's logs as entries,
 * never as club films. Each member's count stands on its own; then the films
 * more than one of us saw, the one the most of us saw featured with its stills
 * and the rest in a row beneath it.
 */
const ClubOffDocket: React.FC<ClubOffDocketProps> = ({ offDocket, sharedStills, accent }) => {
    const { entries, byMember, sharedFilms } = offDocket;
    const [lead, ...others] = sharedFilms;
    // The bundle carries only a few stills per film; the full set is fetched.
    const [fetched, setFetched] = useState<{ id: string; urls: string[] } | null>(null);
    const leadID = lead?.imdbID;
    useEffect(() => {
        if (!leadID) return;
        let live = true;
        fetchFilmSummary(leadID)
            .then((summary) => {
                if (live && summary?.backdropImages?.length) {
                    setFetched({ id: leadID, urls: summary.backdropImages });
                }
            })
            .catch(() => {});
        return () => {
            live = false;
        };
    }, [leadID]);
    // The slide's backdrop is the first still, so the slider leaves it out.
    const stills = [
        ...new Set([
            ...sharedStills,
            ...(fetched && fetched.id === leadID ? fetched.urls.slice(1) : []),
        ]),
    ].filter((url) => isImageSource(url) && !url.includes('N/A'));
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Off the docket</Eyebrow>
                {/* The count and what it counts side by side, the words wrapping
                into two lines beside the figure rather than a line under it. */}
                <div className="mt-3 flex items-center gap-4 sm:gap-5">
                    <p className="font-serif text-[4.5rem] leading-none text-slate-50 sm:text-[6.5rem]">
                        {entries}
                    </p>
                    <p className="max-w-[9em] font-serif text-2xl leading-tight text-slate-200 sm:text-3xl">
                        films watched on our own
                    </p>
                </div>
            </Reveal>
            <Reveal step={1.5}>
                <dl
                    className="flex flex-wrap gap-x-6 gap-y-2"
                    style={{ marginTop: give('1.25rem', '0.5rem') }}
                >
                    {byMember.map(({ name, count }) => {
                        const color = getTeamMemberByName(name) ? FACE_RING : undefined;
                        return (
                            <div key={name} className="flex items-center gap-2">
                                <MemberFace
                                    name={name}
                                    color={color}
                                    size="h-7 w-7 sm:h-8 sm:w-8"
                                />
                                <div className="flex items-baseline gap-2">
                                    <dt className="text-xs font-medium text-slate-200">{name}</dt>
                                    <dd className="font-serif text-2xl leading-none text-slate-100">
                                        {count}
                                    </dd>
                                </div>
                            </div>
                        );
                    })}
                </dl>
            </Reveal>
            {lead && (
                <Reveal step={2.5}>
                    <div
                        className="grid items-center gap-4 border-t border-slate-100/10 sm:grid-cols-[1fr_1.2fr]"
                        style={{
                            marginTop: give('1.5rem', '0.75rem'),
                            paddingTop: give('1.25rem', '0.75rem'),
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <Poster src={lead.poster} title={lead.title} className="w-14 sm:w-20" />
                            <div className="min-w-0">
                                <FaceStack
                                    faces={lead.members.map((name) => ({
                                        name,
                                        color: getTeamMemberByName(name) ? FACE_RING : undefined,
                                    }))}
                                    size="h-7 w-7"
                                    className="mb-2"
                                />
                                <p className="text-slate-300 sm:text-lg">
                                    {listNames(lead.members)}{' '}
                                    {lead.members.length === 2 ? 'both' : 'all'} found their way to{' '}
                                    <em className="font-serif text-slate-50">{lead.title}</em>
                                </p>
                            </div>
                        </div>
                        <FeatureStill stills={stills} accent={accent} compactRail />
                    </div>
                </Reveal>
            )}
            {others.length > 0 && (
                <Reveal step={3.5}>
                    <ul
                        className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4"
                        style={{ marginTop: give('1.25rem', '0.75rem') }}
                    >
                        {others.map((film) => (
                            <li key={film.imdbID} className="flex items-center gap-3">
                                <Poster
                                    src={film.poster}
                                    title={film.title}
                                    className="w-10 sm:w-12"
                                />
                                <p className="min-w-0 text-sm leading-snug">
                                    <em className="block font-serif text-slate-100">
                                        {film.title}
                                    </em>
                                    <span className="text-slate-400">
                                        {listNames(film.members)}
                                    </span>
                                </p>
                            </li>
                        ))}
                    </ul>
                </Reveal>
            )}
        </Slide>
    );
};

export default ClubOffDocket;
