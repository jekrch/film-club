import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    /** Currently selected value. Empty string represents the placeholder option. */
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    /** Label for the empty/"all" option, e.g. "All Genres". */
    placeholder: string;
    /** Accessible label rendered above the control. */
    label?: string;
    id?: string;
    className?: string;
}

/**
 * Custom, fully-styled dropdown that replaces the native <select> so the
 * option panel matches the app's austere slate aesthetic. Keyboard
 * accessible (arrow keys, Home/End, Enter/Space, Escape, type-ahead) and
 * closes on outside click.
 */
const Select = ({ value, onChange, options, placeholder, label, id, className }: SelectProps) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const listboxId = `${controlId}-listbox`;

    const allOptions: SelectOption[] = [{ value: '', label: placeholder }, ...options];
    const selectedIndex = Math.max(0, allOptions.findIndex((o) => o.value === value));
    const selectedLabel = allOptions[selectedIndex]?.label ?? placeholder;

    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(selectedIndex);
    const [dropUp, setDropUp] = useState(false);

    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const typeaheadRef = useRef<{ query: string; timer: number | null }>({ query: '', timer: null });

    const close = useCallback(() => {
        setOpen(false);
        buttonRef.current?.focus();
    }, []);

    // Decide whether to open above or below based on available space.
    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setDropUp(spaceBelow < 260 && rect.top > spaceBelow);
        setHighlighted(selectedIndex);
    }, [open, selectedIndex]);

    // Keep the highlighted option scrolled into view.
    useEffect(() => {
        if (!open || !listRef.current) return;
        const node = listRef.current.children[highlighted] as HTMLElement | undefined;
        node?.scrollIntoView({ block: 'nearest' });
    }, [open, highlighted]);

    // Close on outside interaction.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const commit = (index: number) => {
        const option = allOptions[index];
        if (option) onChange(option.value);
        close();
    };

    const handleTypeahead = (key: string) => {
        const state = typeaheadRef.current;
        if (state.timer) window.clearTimeout(state.timer);
        state.query += key.toLowerCase();
        const match = allOptions.findIndex((o) => o.label.toLowerCase().startsWith(state.query));
        if (match >= 0) {
            setHighlighted(match);
            if (!open) commit(match);
        }
        state.timer = window.setTimeout(() => {
            state.query = '';
        }, 600);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!open) setOpen(true);
                else setHighlighted((h) => Math.min(h + 1, allOptions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!open) setOpen(true);
                else setHighlighted((h) => Math.max(h - 1, 0));
                break;
            case 'Home':
                if (open) { e.preventDefault(); setHighlighted(0); }
                break;
            case 'End':
                if (open) { e.preventDefault(); setHighlighted(allOptions.length - 1); }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (open) commit(highlighted);
                else setOpen(true);
                break;
            case 'Escape':
                if (open) { e.preventDefault(); close(); }
                break;
            case 'Tab':
                if (open) setOpen(false);
                break;
            default:
                if (e.key.length === 1) handleTypeahead(e.key);
        }
    };

    const hasSelection = value !== '';

    return (
        <div className={className}>
            {label && (
                <label
                    htmlFor={controlId}
                    className="block mb-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400"
                >
                    {label}
                </label>
            )}
            <div ref={rootRef} className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    id={controlId}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    onClick={() => setOpen((o) => !o)}
                    onKeyDown={onKeyDown}
                    className={classNames(
                        'group flex w-full items-center justify-between gap-2 rounded-md border bg-slate-800/70 px-4 py-2 text-left text-sm transition-colors duration-200',
                        'focus:outline-none focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400/50',
                        open ? 'border-slate-400 text-slate-100' : 'border-slate-600/80 hover:border-slate-500',
                        hasSelection ? 'text-slate-100' : 'text-slate-400'
                    )}
                >
                    <span className="truncate">{selectedLabel}</span>
                    <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        className={classNames(
                            'h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200',
                            open && 'rotate-180'
                        )}
                    >
                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {open && (
                    <ul
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        tabIndex={-1}
                        aria-activedescendant={`${controlId}-opt-${highlighted}`}
                        className={classNames(
                            'themed-scrollbar absolute z-30 max-h-60 w-full overflow-y-auto rounded-md border border-slate-700 bg-slate-900/95 py-1 shadow-xl shadow-black/40 backdrop-blur-sm origin-top animate-fadeIn',
                            dropUp ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5'
                        )}
                    >
                        {allOptions.map((option, index) => {
                            const isSelected = option.value === value;
                            const isActive = index === highlighted;
                            return (
                                <li
                                    key={option.value || '__placeholder'}
                                    id={`${controlId}-opt-${index}`}
                                    role="option"
                                    aria-selected={isSelected}
                                    onMouseEnter={() => setHighlighted(index)}
                                    onClick={() => commit(index)}
                                    className={classNames(
                                        'flex cursor-pointer items-center gap-2 px-4 py-2 text-sm transition-colors duration-150',
                                        isActive ? 'bg-slate-700/60 text-slate-100' : 'text-slate-300',
                                        !option.value && 'text-slate-400'
                                    )}
                                >
                                    <span
                                        className={classNames(
                                            'h-3.5 w-px flex-shrink-0 rounded-full transition-colors duration-150',
                                            isSelected ? 'bg-slate-300' : 'bg-transparent'
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="truncate">{option.label}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default Select;
