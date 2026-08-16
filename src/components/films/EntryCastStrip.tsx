import React from 'react';

import { tmdbPersonUrl } from '../../utils/personUtils';
import type { ListCastMember } from '../../types/list';

interface EntryCastStripProps {
    cast: ListCastMember[];
}

/**
 * The cast of a film on a list or in a watch log: headshot, name, character.
 *
 * Deliberately not `PersonStrip`, which is the club's. That one decides whether
 * a name is clickable from how many *club films* the person appears in, and a
 * click opens the person modal onto their club filmography. Most films here are
 * ones the club never watched, so their cast has no club filmography — the modal
 * would open on nothing. A name goes out to the actor's TMDb page instead, which
 * is where the record actually is, and one with no id is plain text rather than
 * a dead link.
 *
 * The card geometry matches `PersonStrip` so the two read as the same object in
 * different places.
 */
const EntryCastStrip: React.FC<EntryCastStripProps> = ({ cast }) => {
    if (cast.length === 0) return null;

    return (
        <div>
            <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cast
            </h6>
            {/* Negative margins with matching padding so a focus ring isn't
                clipped by the scroll container — `overflow-x` clips the vertical
                axis too. Same trick, same reason, as the club's strip. */}
            <div className="themed-scrollbar -mx-1 -mt-1 flex gap-4 overflow-x-auto px-1 pb-3 pt-1">
                {cast.map((member, index) => {
                    const url = member.tmdbId ? tmdbPersonUrl(member.tmdbId) : null;

                    const portrait = member.profileUrl ? (
                        <img
                            src={member.profileUrl}
                            alt={member.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                // Hide a dead headshot so the initial shows through.
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : (
                        <span className="text-2xl font-semibold text-slate-400">
                            {member.name.charAt(0)}
                        </span>
                    );

                    return (
                        <div key={`${member.name}-${index}`} className="w-20 flex-shrink-0 text-center">
                            {url ? (
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mx-auto mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-700 ring-1 ring-slate-600/40 transition hover:ring-2 hover:ring-blue-400/50"
                                    aria-label={`${member.name} on TMDb`}
                                >
                                    {portrait}
                                </a>
                            ) : (
                                <span className="mx-auto mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-700 ring-1 ring-slate-600/40">
                                    {portrait}
                                </span>
                            )}

                            <p className="truncate text-xs font-medium leading-tight" title={member.name}>
                                {url ? (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 transition-colors hover:text-blue-300"
                                    >
                                        {member.name}
                                    </a>
                                ) : (
                                    <span className="text-slate-200">{member.name}</span>
                                )}
                            </p>

                            {member.character && (
                                <p
                                    className="mt-0.5 line-clamp-2 text-xs leading-tight text-slate-500"
                                    title={member.character}
                                >
                                    {member.character}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EntryCastStrip;
