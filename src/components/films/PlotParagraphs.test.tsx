import { render, screen } from '@testing-library/react';

import PlotParagraphs from './PlotParagraphs';

/**
 * Synopses arrive from OMDB and TMDb with their paragraph breaks intact, and a
 * single `<p>` swallows them — which is what this component exists to stop. The
 * assertions are about the breaks, not the styling.
 */
describe('PlotParagraphs', () => {
    it('breaks a plot where its newlines are', () => {
        const { container } = render(<PlotParagraphs plot={'First part.\nSecond part.'} />);

        const paragraphs = container.querySelectorAll('p');
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0]).toHaveTextContent('First part.');
        expect(paragraphs[1]).toHaveTextContent('Second part.');
    });

    it('treats a run of blank lines as one break', () => {
        const { container } = render(<PlotParagraphs plot={'First.\n\n\nSecond.'} />);

        expect(container.querySelectorAll('p')).toHaveLength(2);
    });

    it('spaces every paragraph but the last', () => {
        const { container } = render(
            <PlotParagraphs plot={'One.\nTwo.\nThree.'} className="text-sm" gapClassName="mb-2" />
        );

        const paragraphs = container.querySelectorAll('p');
        expect(paragraphs[0]).toHaveClass('text-sm', 'mb-2');
        expect(paragraphs[1]).toHaveClass('text-sm', 'mb-2');
        expect(paragraphs[2]).toHaveClass('text-sm');
        expect(paragraphs[2]).not.toHaveClass('mb-2');
    });

    it('falls back when there is no plot to show', () => {
        render(<PlotParagraphs plot={'   \n  '} fallback={<span>Plot not available.</span>} />);

        expect(screen.getByText('Plot not available.')).toBeInTheDocument();
    });
});
