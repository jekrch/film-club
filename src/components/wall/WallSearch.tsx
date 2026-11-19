import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import {
    BarsArrowDownIcon,
    BarsArrowUpIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

import Button from '../common/Button';
import Collapse from '../common/Collapse';
import type { IconComponent } from '../common/trophyIcons';
import { DEFAULT_MEMBER_IMAGE, getMemberImage } from '../../types/team';
import type { WallOrder } from '../../utils/wallUtils';

/**
 * The wall's search: one small button in the header, opening onto a panel with a
 * search field, the members, and the order.
 *
 * Folded away by default because the wall is read top to bottom far more often
 * than it is searched, and a toolbar standing over it all the time would push
 * the first rows down the screen for the sake of the rare visit that wants it.
 * Closing the panel keeps whatever it was set to — the button carries a dot
 * while anything is — so a reader can fold it away to read their results.
 */

const PANEL_ID = 'wall-search-panel';

interface ToggleProps {
    open: boolean;
    /** Whether the panel is narrowing or reordering the wall, for the dot. */
    refined: boolean;
    onToggle: () => void;
}

/** The header's search button, in the filter chips' shape so the row stays one height. */
export const WallSearchToggle: React.FC<ToggleProps> = ({ open, refined, onToggle }) => (
    <Button
        variant="chip"
        size="xs"
        active={open}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? 'Hide search' : 'Search the log'}
        title="Search (/)"
        onClick={onToggle}
        className="relative !px-2"
    >
        <MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {refined && !open && (
            <span
                className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-400 ring-2 ring-slate-900"
                aria-hidden="true"
            />
        )}
    </Button>
);

const ORDERS: { value: WallOrder; label: string; Icon: IconComponent }[] = [
    { value: 'newest', label: 'Newest', Icon: ClockIcon as IconComponent },
    { value: 'highest', label: 'Highest', Icon: BarsArrowDownIcon as IconComponent },
    { value: 'lowest', label: 'Lowest', Icon: BarsArrowUpIcon as IconComponent },
];

/** A member's face, falling back to the default avatar rather than a broken image. */
const Avatar: React.FC<{ name: string; dim: boolean }> = ({ name, dim }) => {
    const [failed, setFailed] = useState(false);
    return (
        <img
            src={failed ? DEFAULT_MEMBER_IMAGE : getMemberImage(name)}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className={classNames(
                'h-5 w-5 shrink-0 rounded-full bg-slate-700 object-cover transition-[filter,opacity] duration-200',
                dim && 'opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0'
            )}
        />
    );
};

interface PanelProps {
    open: boolean;
    /** Bumped to pull focus into the field — on open, and on the `/` shortcut. */
    focusSignal: number;
    query: string;
    onQueryChange: (query: string) => void;
    /** The members with anything on the wall, in roster order and casing. */
    members: string[];
    /** Lowercased, as {@link WallRefinement} keeps them. */
    selected: Set<string>;
    onToggleMember: (name: string) => void;
    order: WallOrder;
    onOrderChange: (order: WallOrder) => void;
    refined: boolean;
    onReset: () => void;
    /** Esc on an empty field: fold the panel. Focus goes back to the button. */
    onClose: () => void;
}

const WallSearchPanel: React.FC<PanelProps> = ({
    open,
    focusSignal,
    query,
    onQueryChange,
    members,
    selected,
    onToggleMember,
    order,
    onOrderChange,
    refined,
    onReset,
    onClose,
}) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    /** Asked for focus before the field existed; it takes it as it mounts. */
    const pendingFocus = useRef(false);

    // `Collapse` mounts its content a render after `open` flips, so on opening
    // the field isn't there yet. The request is held, and the ref below honours
    // it the moment the field arrives. Already open, it is focused straight off.
    useEffect(() => {
        if (!open) return;
        const input = inputRef.current;
        if (input) input.focus({ preventScroll: true });
        else pendingFocus.current = true;
    }, [open, focusSignal]);

    const attachInput = useCallback((input: HTMLInputElement | null) => {
        inputRef.current = input;
        if (input && pendingFocus.current) {
            pendingFocus.current = false;
            input.focus({ preventScroll: true });
        }
    }, []);

    return (
        <Collapse open={open} id={PANEL_ID} innerClassName="mb-6">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-4">
                <div className="relative">
                    <MagnifyingGlassIcon
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                        aria-hidden="true"
                    />
                    <input
                        ref={attachInput}
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Escape') return;
                            event.preventDefault();
                            if (query) {
                                onQueryChange('');
                                return;
                            }
                            onClose();
                            document
                                .querySelector<HTMLElement>(`[aria-controls="${PANEL_ID}"]`)
                                ?.focus();
                        }}
                        placeholder="Search films, members, reviews…"
                        aria-label="Search the log"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full appearance-none rounded-lg border border-slate-700/70 bg-slate-950/40 py-2 pl-9 pr-10 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/15 [&::-webkit-search-cancel-button]:hidden"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {query ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onQueryChange('');
                                    inputRef.current?.focus();
                                }}
                                aria-label="Clear search"
                                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-700/50 hover:text-slate-200"
                            >
                                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                        ) : (
                            <kbd className="hidden rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 font-sans text-[10px] leading-none text-slate-500 sm:inline-block">
                                /
                            </kbd>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {members.length > 1 && (
                        <div
                            className="flex flex-wrap gap-1.5"
                            role="group"
                            aria-label="Filter by member"
                        >
                            {members.map((name) => {
                                const active = selected.has(name.toLowerCase());
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => onToggleMember(name)}
                                        className={classNames(
                                            'group inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors duration-200',
                                            active
                                                ? 'border-blue-400/50 bg-blue-500/10 text-slate-100'
                                                : 'border-slate-700/70 bg-slate-800/30 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                        )}
                                    >
                                        <Avatar name={name} dim={!active && selected.size > 0} />
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        <div
                            className="inline-flex rounded-lg border border-slate-700/70 bg-slate-950/30 p-0.5"
                            role="radiogroup"
                            aria-label="Order"
                        >
                            {ORDERS.map(({ value, label, Icon }) => {
                                const active = order === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => onOrderChange(value)}
                                        className={classNames(
                                            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-200',
                                            active
                                                ? 'bg-slate-700/70 text-slate-100 shadow-sm'
                                                : 'text-slate-400 hover:text-slate-200'
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Held in place when there is nothing to reset, so the
                            order control doesn't shift as it comes and goes. */}
                        <button
                            type="button"
                            onClick={onReset}
                            disabled={!refined}
                            className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 transition-[color,opacity] hover:text-slate-100 disabled:pointer-events-none disabled:opacity-0"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        </Collapse>
    );
};

export default WallSearchPanel;
