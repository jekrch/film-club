/**
 * Turning a file a member picked into something the worker will commit.
 *
 * A profile picture is the one image on this site that isn't a link to somebody
 * else's server — the bytes end up in this repository, in every clone of it,
 * forever. So the browser does the work first: a phone photograph is six or
 * eight megabytes and 4000px wide, and what the page draws is a 192px circle.
 * Re-encoding to {@link AVATAR_MAX_DIMENSION} costs nothing anyone can see and
 * is the difference between an avatar that weighs 60 KB and one that weighs a
 * hundred times that.
 *
 * The parsing and arithmetic here are separated from the canvas work on purpose:
 * everything that decides *whether* a file is acceptable is a pure function with
 * a test, and the part that can only run in a browser is left as thin as it can
 * be.
 *
 * The worker validates the result again with its own rules — `validateAvatarUpload`
 * in `worker/src/validate.ts` — as it does for every other field. This side
 * exists so a member finds out about a 20 MB TIFF before uploading it.
 */

/** Longest edge of the stored image. The largest the site ever draws one is 192px. */
export const AVATAR_MAX_DIMENSION = 512;

/** JPEG quality for the re-encode. Visually clean at this size; 0.95 doubles the bytes. */
const AVATAR_QUALITY = 0.85;

/** What the re-encode always produces, whatever came in. */
const OUTPUT_TYPE = 'image/jpeg';

/**
 * Types a member may pick from. Narrower than what a canvas can decode, and
 * matching `AVATAR_TYPES` on the worker — GIF is excluded on both sides because
 * re-encoding one silently discards the animation that was the point of it.
 */
export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** The `accept` attribute for the file input, from the list above. */
export const UPLOAD_ACCEPT = ACCEPTED_UPLOAD_TYPES.join(',');

/**
 * The largest file worth opening. Not the stored size — that is decided by the
 * resize below — but a guard on decoding something enormous into a canvas on a
 * phone, where it is likelier to fail than to be slow.
 */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** Mirrors `LIMITS.avatarBytes`; the encoded result is checked against it. */
export const MAX_UPLOAD_BYTES = 600 * 1024;

/**
 * Why this file can't be used, or null when it can.
 *
 * A message rather than a boolean because there are two quite different reasons
 * and a member deserves to know which — "that's a HEIC" and "that's 40 MB" have
 * different fixes.
 */
export function describeUploadProblem(file: { type: string; size: number }): string | null {
    if (!(ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
        return 'That has to be a JPEG, PNG, or WebP image.';
    }
    if (file.size > MAX_SOURCE_BYTES) {
        return `That file is ${Math.round(file.size / (1024 * 1024))} MB; the limit is ${MAX_SOURCE_BYTES / (1024 * 1024)} MB.`;
    }
    return null;
}

/**
 * The size an image should be drawn at to fit inside a square of `max`, keeping
 * its proportions. An image already smaller is left alone rather than blown up —
 * upscaling adds bytes and no detail.
 */
export function fitWithin(
    width: number,
    height: number,
    max: number
): { width: number; height: number } {
    const longest = Math.max(width, height);
    if (longest <= max || longest === 0) {
        return { width: Math.round(width), height: Math.round(height) };
    }
    const scale = max / longest;
    // At least one pixel each way: a 4000×3 panorama would otherwise round to a
    // zero-height canvas, which throws rather than producing a bad image.
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

/** The two halves of a `data:` URL, or null when the string isn't one. */
export function splitDataUrl(dataUrl: string): { contentType: string; data: string } | null {
    const match = /^data:([^;,]+)(?:;[^,]*)*;base64,(.*)$/s.exec(dataUrl);
    if (!match) return null;
    return { contentType: match[1].toLowerCase(), data: match[2] };
}

/** How many bytes a base64 string stands for. Mirrors the worker's own copy. */
export function base64ByteLength(base64: string): number {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return (base64.length / 4) * 3 - padding;
}

/** An image ready to send: the bytes, their type, and a URL to preview them with. */
export interface PreparedUpload {
    contentType: string;
    /** Base64, no `data:` prefix — the form both the worker and GitHub want. */
    data: string;
    /**
     * The same image as a `data:` URL, for the preview beside the field. The
     * committed file isn't served until the next Pages build, so without this
     * an upload would show a broken thumbnail for the minute that follows.
     */
    previewUrl: string;
    bytes: number;
}

/** Reads a file into an `<img>`, which is the only way to get at its pixels. */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("That image couldn't be read. Try a different file."));
        };
        image.src = url;
    });
}

/**
 * Resizes and re-encodes a picked file, ready for `putProfileImage`.
 *
 * Rejects with a message meant for the member rather than a log line, since
 * every failure here is something they can act on: a file that isn't an image, a
 * browser that couldn't decode it, or — after the resize, so it is nearly
 * unreachable — a result still too large to store.
 */
export async function prepareAvatarUpload(file: File): Promise<PreparedUpload> {
    const problem = describeUploadProblem(file);
    if (problem) throw new Error(problem);

    const image = await loadImage(file);
    const { width, height } = fitWithin(
        image.naturalWidth || image.width,
        image.naturalHeight || image.height,
        AVATAR_MAX_DIMENSION
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("This browser couldn't process that image.");
    context.drawImage(image, 0, 0, width, height);

    // JPEG whatever came in: a PNG photograph is several times the size for no
    // visible gain at this scale, and transparency has nowhere to show in a
    // circular avatar anyway.
    const previewUrl = canvas.toDataURL(OUTPUT_TYPE, AVATAR_QUALITY);
    const split = splitDataUrl(previewUrl);
    if (!split) throw new Error("This browser couldn't process that image.");

    const bytes = base64ByteLength(split.data);
    if (bytes > MAX_UPLOAD_BYTES) {
        throw new Error(
            `That image is still ${Math.round(bytes / 1024)} KB after resizing; the limit is ${MAX_UPLOAD_BYTES / 1024} KB.`
        );
    }

    return { contentType: split.contentType, data: split.data, previewUrl, bytes };
}
