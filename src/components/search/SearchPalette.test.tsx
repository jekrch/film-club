import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SearchPalette from './SearchPalette';
import Navbar from '../layout/Navbar';
import { serveWatchedLogs } from '../../test-utils/watchedFetch';
import { MODAL_ANIMATION_MS } from '../../hooks/useModalPresence';

// The auth control in the nav has nothing to do with search, and wants a
// provider and Google's script to render.
jest.mock('../../auth/NavAuthControl', () => ({
    __esModule: true,
    default: () => null,
}));

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const renderPalette = (onClose = jest.fn()) => {
    render(
        <MemoryRouter initialEntries={['/films']}>
            <SearchPalette isOpen onClose={onClose} />
            <Routes>
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>
    );
    return onClose;
};

const field = () => screen.getByRole('combobox');
const type = (value: string) => fireEvent.change(field(), { target: { value } });

beforeEach(() => {
    serveWatchedLogs({});
    // The scroll lock pins the page with it, and jsdom doesn't implement it.
    window.scrollTo = jest.fn();
});

describe('SearchPalette', () => {
    it('opens with the field focused, offering somewhere to go', async () => {
        renderPalette();
        expect(screen.getByRole('dialog', { name: 'Search the site' })).toBeInTheDocument();
        expect(field()).toHaveFocus();
        expect(screen.getByRole('group', { name: 'Jump to' })).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText('Loading member logs')).not.toBeInTheDocument()
        );
    });

    it('goes to the highlighted result on Enter, and closes', async () => {
        const onClose = renderPalette();
        type('almanac');

        const option = await screen.findByRole('option', { name: /Almanac/ });
        expect(option).toHaveAttribute('aria-selected', 'true');
        expect(field()).toHaveAttribute('aria-activedescendant', option.id);

        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onClose).toHaveBeenCalled();
        expect(screen.getByTestId('where')).toHaveTextContent('/almanac');
    });

    it('moves through results with the arrow keys, wrapping at the ends', async () => {
        renderPalette();
        type('l');
        const options = await screen.findAllByRole('option');
        expect(options.length).toBeGreaterThan(1);

        fireEvent.keyDown(field(), { key: 'ArrowUp' });
        expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(field(), { key: 'ArrowDown' });
        expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('says when nothing matches', async () => {
        renderPalette();
        type('zzzzqqq');
        expect(await screen.findByText(/No results for/)).toBeInTheDocument();
    });

    it('closes on Escape', () => {
        const onClose = renderPalette();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});

describe('Navbar search', () => {
    const renderNav = () =>
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

    it('opens from its button', () => {
        renderNav();
        fireEvent.click(screen.getAllByRole('button', { name: 'Search' })[0]);
        expect(screen.getByRole('dialog', { name: 'Search the site' })).toBeInTheDocument();
    });

    it('toggles on ⌘K and Ctrl+K', () => {
        // Fake timers so the exit animation's unmount timer runs on cue. On real
        // timers a loaded full-suite run could push it past `waitFor`'s timeout.
        jest.useFakeTimers();
        try {
            renderNav();
            act(() => {
                fireEvent.keyDown(window, { key: 'k', metaKey: true });
            });
            const dialog = screen.getByRole('dialog', { name: 'Search the site' });
            expect(dialog).toBeInTheDocument();

            act(() => {
                fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
            });
            expect(dialog).toHaveClass('animate-modal-panel-out');

            act(() => {
                jest.advanceTimersByTime(MODAL_ANIMATION_MS);
            });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });
});
