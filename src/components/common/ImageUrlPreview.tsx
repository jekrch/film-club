import React from 'react';

interface ImageUrlPreviewProps {
    /** The URL as typed. Untrimmed — this is form state, mid-edit. */
    url: string;
    /** Size and shape of the thumb, which differs by what the field is for. */
    className?: string;
}

/**
 * A thumbnail of an image URL a member is typing into an editor field.
 *
 * Every editor that takes an image link shows one of these beside the field,
 * for a reason the field alone can't cover: where the image ends up is either
 * faded to a wash far too low to tell a dead URL from a dark frame, or — for a
 * poster — a slot that falls back to a placeholder and looks the same whether
 * the link was wrong or the film simply has no artwork. The preview is the only
 * place a broken link is visibly broken before it is saved.
 *
 * A URL that fails to load hides the element rather than swapping in a
 * placeholder: an empty space next to a filled-in field reads as "that link
 * doesn't resolve", which is exactly the message. Visibility is set on load as
 * well, since the same element is reused as the member keeps typing and a
 * previously failed URL must be able to come back.
 */
const ImageUrlPreview: React.FC<ImageUrlPreviewProps> = ({ url, className = '' }) => {
    const trimmed = url.trim();
    if (trimmed === '') return null;

    return (
        <img
            src={trimmed}
            alt=""
            className={`flex-shrink-0 rounded object-cover ring-1 ring-slate-600/40 ${className}`}
            onError={(event) => {
                event.currentTarget.style.visibility = 'hidden';
            }}
            onLoad={(event) => {
                event.currentTarget.style.visibility = 'visible';
            }}
        />
    );
};

export default ImageUrlPreview;
