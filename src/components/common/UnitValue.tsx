import React from 'react';

/**
 * Sets the digits of a formatted value as numerals and drops the unit words
 * ("hrs", "min") down to small caps beside them, so "12 hrs 34 min" reads as
 * two figures rather than one long string. The numerals take the parent's
 * font; pair it with a large serif, as the stat cards do.
 */
const UnitValue: React.FC<{ value: string }> = ({ value }) => (
    <>
        {value.split(/(\d+(?:\.\d+)?)/).map((part, i) =>
            /^\d/.test(part) || part.trim() === '' ? (
                part
            ) : (
                <span
                    key={i}
                    className="mx-1 font-sans text-xs font-medium uppercase tracking-widest text-slate-400"
                >
                    {part.trim()}
                </span>
            )
        )}
    </>
);

export default UnitValue;
