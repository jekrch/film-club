import classNames from 'classnames';
import React from 'react';
import type { CardAccent } from './AccentCard';

/**
 * Four button roles, matching how buttons are actually used in the app:
 *
 * - `link`  — text-only action inside prose or under a section ("Show More").
 * - `solid` — the one primary action on a view ("Try Again").
 * - `ghost` — an icon button: modal closes, toolbar toggles.
 * - `chip`  — a member of a segmented control (sort, category).
 *
 * Focus is deliberately absent here: index.css gives every <button> one
 * keyboard-only outline. An outline needs no offset color, so a single rule
 * works on the page background and on any card — unlike the five different
 * ring/ring-offset combinations these call sites used to carry.
 */
export type ButtonVariant = 'link' | 'solid' | 'ghost' | 'chip';
export type ButtonSize = 'xs' | 'sm' | 'md';

// Tailwind can't see dynamically built class names, so accents are static maps.
const LINK: Record<CardAccent, string> = {
    emerald: 'text-emerald-400 hover:text-emerald-300',
    blue: 'text-blue-400 hover:text-blue-300',
    amber: 'text-amber-400 hover:text-amber-300',
    rose: 'text-rose-400 hover:text-rose-300',
};

const SOLID: Record<CardAccent, string> = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    blue: 'bg-blue-600 hover:bg-blue-500 text-white',
    amber: 'bg-amber-600 hover:bg-amber-500 text-white',
    rose: 'bg-rose-600 hover:bg-rose-500 text-white',
};

const VARIANT_BASE: Record<ButtonVariant, string> = {
    link: 'rounded-sm font-medium',
    solid: 'rounded-md font-medium',
    ghost: 'rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-700/45',
    // font-medium lives here, not in the active state: changing weight on
    // selection re-measures the label and shoves the rest of the row sideways.
    chip: 'rounded-md border uppercase tracking-[0.12em] font-medium',
};

// Padding is per variant: a link sits inline with text and must not carry a
// box, while a ghost button is square around its icon.
const SIZING: Record<ButtonVariant, Record<ButtonSize, string>> = {
    link: { xs: 'text-xs gap-1', sm: 'text-sm gap-1', md: 'text-base gap-1.5' },
    solid: {
        xs: 'px-3 py-1 text-xs gap-1',
        sm: 'px-4 py-1.5 text-sm gap-1.5',
        md: 'px-5 py-2 text-sm gap-2',
    },
    ghost: { xs: 'p-1.5', sm: 'p-2', md: 'p-2.5' },
    chip: {
        xs: 'px-3 py-1.5 text-[10px] gap-1.5',
        sm: 'px-3.5 py-2 text-xs gap-1.5',
        md: 'px-4 py-2 text-sm gap-2',
    },
};

const CHIP_STATE = {
    // Neutral emphasis rather than an accent fill: segmented controls here hold
    // up to a dozen members, and one bright pill among them reads as noise.
    // Fills go lighter than the page, not darker — cards are transparent, so a
    // dark fill on the slate-900 background would be invisible.
    active: 'border-slate-400 bg-slate-700/50 text-slate-100',
    inactive:
        'border-slate-600/70 bg-slate-800/40 text-slate-400 hover:border-slate-400 hover:text-slate-100 hover:bg-slate-700/40',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    accent?: CardAccent;
    /** `chip` only: whether this member of the segmented control is selected. */
    active?: boolean;
}

const Button: React.FC<ButtonProps> = ({
    variant = 'link',
    size = 'sm',
    accent = 'blue',
    active = false,
    className,
    children,
    ...rest
}) => (
    <button
        className={classNames(
            'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            VARIANT_BASE[variant],
            SIZING[variant][size],
            variant === 'link' && LINK[accent],
            variant === 'solid' && SOLID[accent],
            variant === 'chip' && (active ? CHIP_STATE.active : CHIP_STATE.inactive),
            className
        )}
        {...rest}
    >
        {children}
    </button>
);

export default Button;
