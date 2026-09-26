import classNames from 'classnames';
import React from 'react';

interface SectionHeaderProps {
    title: string;
    className?: string;
}

/**
 * An editorial section head, as the profile's Interview section sets it: the
 * title in serif italic with a hairline ruled out to the right.
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({ title, className }) => (
    <div className={classNames('mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
        <h3 className="font-serif text-2xl italic text-slate-100">{title}</h3>
        <span
            className="h-px flex-grow self-center bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent"
            aria-hidden="true"
        />
    </div>
);

export default SectionHeader;
