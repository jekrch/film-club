import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorDisplay from './ErrorDisplay';

interface ErrorBoundaryInnerProps {
    children: ReactNode;
    /**
     * When this value changes, the boundary clears its error state and attempts
     * to re-render its children. Driven by the current route so that navigating
     * away from a broken page recovers the app.
     */
    resetKey: unknown;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Class-based boundary that catches render-time errors in its subtree. React
 * error boundaries must be classes, so the functional `ErrorBoundary` wrapper
 * below supplies the route-derived `resetKey`.
 */
class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Surface the failure for diagnostics; without this a render throw is silent.
        console.error('ErrorBoundary caught an error:', error, info.componentStack);
    }

    componentDidUpdate(prevProps: ErrorBoundaryInnerProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorDisplay
                    message="Something went wrong while rendering this page."
                    backPath="/"
                    backButtonLabel="Return home"
                />
            );
        }
        return this.props.children;
    }
}

/**
 * Top-level error boundary. Renders {@link ErrorDisplay} when a descendant
 * throws during render, and resets itself on route changes so the user can
 * navigate back to a working page.
 */
const ErrorBoundary = ({ children }: { children: ReactNode }) => {
    const location = useLocation();
    return <ErrorBoundaryInner resetKey={location.pathname}>{children}</ErrorBoundaryInner>;
};

export default ErrorBoundary;
