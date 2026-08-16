import React from 'react';

import { tmdbPersonUrl } from '../../utils/personUtils';
import type { EntryPerson } from '../../utils/entryDetails';

interface EntryPersonStripProps {
    /** The strip's heading — "Crew" or "Cast". */
    title: string;
    people: EntryPerson[];
}

/**
 * The people on a film in a list or a watch log: headshot, name, and what they
 * did. Used twice per panel, for the crew and for the cast — the card is the
 * same object either way, and only the subtitle differs (a job, or a part).
 *
 * Deliberately not `PersonStrip`, which is the club's. That one decides whether
 * a name is clickable from how many *club films* the person appears in, and a
 * click opens the person modal onto their club filmography. Most films here are
 * ones the club never watched, so nobody on them has a club filmography — the
 * modal would open on nothing. A name goes out to their TMDb page instead, which
 * is where the record actually is, and one with no id is plain text rather than
 * a dead link.
 *
 * The cards are `PersonStrip`'s, so the two read as the same object in
 * different places — same width, same labels — with the headshot one step down.
 * This strip opens inside a row of a list rather than owning a section of a
 * film's page, and a full-size portrait there weighs more than the row it is
 * expanding out of.
 */
const EntryPersonStrip: React.FC<EntryPersonStripProps> = ({ title, people }) => {
    if (people.length === 0) return null;

    return (
        <div>
            <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {title}
            </h6>
            {/* Negative margins with matching padding so a focus ring isn't
                clipped by the scroll container — `overflow-x` clips the vertical
                axis too. Same trick, same reason, as the club's strip. */}
            <div className="themed-scrollbar -mx-1 -mt-1 flex gap-4 overflow-x-auto px-1 pb-3 pt-1">
                {people.map((member, index) => {
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
                        <div
                            key={`${member.name}-${index}`}
                            className="w-24 flex-shrink-0 text-center"
                        >
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

                            {/* Wraps rather than truncates. Actors have long
                                names — most of a normal billing came out as
                                "Sidney Blac…" — and the card is here to say who
                                is in the film, which a cut name doesn't do. The
                                character line under it already runs to two
                                lines, so cards were never flush anyway. */}
                            <p
                                className="line-clamp-2 text-xs font-medium leading-tight"
                                title={member.name}
                            >
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

                            {member.role && (
                                <p
                                    className="mt-0.5 line-clamp-2 text-xs leading-tight text-slate-500"
                                    title={member.role}
                                >
                                    {member.role}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EntryPersonStrip;
