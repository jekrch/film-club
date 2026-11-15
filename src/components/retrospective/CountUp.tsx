import React, { useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import { prefersReducedMotion } from '../../utils/motion';

interface CountUpProps {
    value: number;
    /** Digits after the point. */
    digits?: number;
    /** Seconds. */
    duration?: number;
    delay?: number;
    className?: string;
}

/** A figure that counts up from zero when it mounts. Reduced motion shows it at once. */
const CountUp: React.FC<CountUpProps> = ({
    value,
    digits = 0,
    duration = 1.2,
    delay = 0.2,
    className,
}) => {
    const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

    useEffect(() => {
        if (prefersReducedMotion()) {
            setShown(value);
            return;
        }
        const controls = animate(0, value, {
            duration,
            delay,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: setShown,
        });
        return () => controls.stop();
    }, [value, duration, delay]);

    return (
        <span className={`tabular-nums ${className ?? ''}`} aria-label={value.toFixed(digits)}>
            {shown.toFixed(digits)}
        </span>
    );
};

export default CountUp;
