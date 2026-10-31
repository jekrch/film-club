import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OffDocketStrip from './OffDocketStrip';
import type { OffDocketNote } from '../../utils/wallUtils';

const jacob: OffDocketNote = { member: 'Jacob', subject: 'Frankenstein', more: 10 };
const gabe: OffDocketNote = { member: 'Gabe', subject: 'The Goonies', more: 0 };
const andy: OffDocketNote = { member: 'Andy', subject: 'Heat', more: 0 };

const renderStrip = (notes: OffDocketNote[]) =>
    render(
        <MemoryRouter>
            <OffDocketStrip notes={notes} />
        </MemoryRouter>
    );

describe('OffDocketStrip', () => {
    it('renders nothing when there is nothing recent to tease', () => {
        const { container } = renderStrip([]);

        expect(container).toBeEmptyDOMElement();
    });

    it('links the whole tab to the log, and says there is more there', () => {
        renderStrip([jacob, gabe]);

        expect(screen.getByRole('link')).toHaveAttribute('href', '/log');
        expect(screen.getByRole('link')).toHaveTextContent(
            'Off the docket…moreJacob: Frankenstein+10 and 10 moreGabe: The Goonies'
        );
    });

    it('only shows a count for a member who has one', () => {
        renderStrip([jacob, gabe]);

        expect(screen.getByText('+10')).toBeInTheDocument();
        expect(screen.queryByText('+0')).not.toBeInTheDocument();
    });

    it('keeps two names at every width and holds a third back until md', () => {
        renderStrip([jacob, gabe, andy]);

        expect(screen.getByText('Jacob').parentElement).not.toHaveClass('hidden');
        expect(screen.getByText('Gabe').parentElement).not.toHaveClass('hidden');
        expect(screen.getByText('Andy').parentElement).toHaveClass('hidden', 'md:grid');
    });
});
