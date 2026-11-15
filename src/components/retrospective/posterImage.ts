/**
 * A member's closing poster drawn to an image, for saving or sharing the way a
 * year-in-review card is: 1080 × 1920, the shape a phone's story fills.
 *
 * It's drawn on a canvas rather than captured from the slide, so it comes out
 * the same on every browser and at full size whatever the screen. The layout
 * follows the slide's — key art over the top, the face where the art fades,
 * the name and the year, the shelf of the favourite and their picks, the
 * figures, the billing — set out
 * again here at the image's own scale.
 *
 * A canvas that draws an image from another origin without CORS can't be
 * exported at all, so every image is fetched asking for CORS, and one that
 * refuses is skipped for the next. TMDb and Amazon allow it. Criterion's own
 * bucket doesn't, so its posters and stills go through the editing worker's
 * image proxy (`worker/src/imageProxy.ts`); on a build without the worker,
 * {@link keyArtOrder} puts them last and a poster falls back to its title.
 */

import { EDITOR_API_URL } from '../../config/editorEnv';

const WIDTH = 1080;
const HEIGHT = 1920;
const INK = '#030614'; // slate-950
const SLATE_50 = '#f8fafb';
const SLATE_100 = '#f2f5f8';
const SLATE_300 = '#ccd5e0';
const SLATE_400 = '#93a1b4';
const SLATE_500 = '#657489';
const SERIF = 'Georgia, Gelasio, serif';
const SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

/** How long one image gets to load before the next is tried. */
const IMAGE_TIMEOUT_MS = 20000;
/** Key art tried at most, in order. */
const KEY_ART_TRIES = 6;

/**
 * The shelf of one-sheets above the figures: the favourite, then their picks.
 * Every poster the same size, so the row reads as one shelf; the favourite is
 * told apart by its score. Shown at most {@link SHELF_MAX} picks, the last
 * place going to a "+3" when there are more. The slide's card sets its shelf
 * to the same proportions, in `cqw` (a hundredth of the card's width).
 */
export const SHELF = { posterW: 130, posterH: 195, gap: 16, groupGap: 56 } as const;
export const SHELF_MAX = 5;

/** The picks a shelf has room for, and how many more there were. */
export const shelfPicks = <T>(picks: T[], max = SHELF_MAX): { shown: T[]; more: number } =>
    picks.length <= max
        ? { shown: picks, more: 0 }
        : { shown: picks.slice(0, max - 1), more: picks.length - (max - 1) };

export interface PosterContent {
    year: number;
    name: string;
    /** Their photo, same-origin. */
    avatar: string;
    accent: string;
    /** Stills for the key art, best first; the first that loads is used. */
    keyArt: string[];
    favourite: { title: string; score: string; poster: string | null } | null;
    /** The films they picked for the club this year, in order. */
    picks: { title: string; poster: string | null }[];
    figures: { value: string; label: string }[];
}

/** Hosts known to send CORS headers on their images. */
const CORS_HOSTS = /^https:\/\/(image\.tmdb\.org|m\.media-amazon\.com)\//;

/**
 * Criterion's bucket, which sends none, and which the worker's image proxy
 * will fetch. Keep in step with `ALLOWED` in `worker/src/imageProxy.ts`.
 */
const PROXIED =
    /^https:\/\/(s3\.amazonaws\.com\/criterion-production\/|criterion-production\.s3\.amazonaws\.com\/)/;

/**
 * Where to fetch an image for the canvas: through the proxy when it needs it
 * and there is one, and otherwise, for a host with CORS, under a URL of its own.
 *
 * TMDb sends its CORS header only to a request that asks for it, and doesn't
 * say its answer varies by that, so the copy the browser cached when a slide
 * showed a still without CORS can't be used for the canvas. The extra
 * parameter (which the hosts ignore) gives CORS requests a cache entry of
 * their own, always with the header. The slide's card loads its images by
 * these same URLs, with CORS, so by the time the poster is drawn they're
 * already cached and nothing waits on the network.
 */
export const canvasUrl = (url: string, proxy: string = EDITOR_API_URL): string => {
    if (proxy && PROXIED.test(url)) return `${proxy}/img?url=${encodeURIComponent(url)}`;
    if (CORS_HOSTS.test(url)) return `${url}${url.includes('?') ? '&' : '?'}cors=1`;
    return url;
};

/** Whether the canvas can draw this image, directly or through the proxy. */
const drawable = (url: string, proxy: string): boolean =>
    CORS_HOSTS.test(url) || (!!proxy && PROXIED.test(url));

/** Stills in the order to try them: the ones the canvas can draw first, each list's order kept. */
export const keyArtOrder = (urls: string[], proxy: string = EDITOR_API_URL): string[] => {
    const usable = [...new Set(urls.filter((url) => url?.startsWith('http')))];
    return [
        ...usable.filter((url) => drawable(url, proxy)),
        ...usable.filter((url) => !drawable(url, proxy)),
    ];
};

/**
 * TMDb serves a still at several widths; the image wants the largest, since a
 * story crops a 16:9 frame to its middle third and blows that up to fill.
 */
export const fullSize = (url: string): string =>
    url.replace(/^(https:\/\/image\.tmdb\.org\/t\/p\/)w\d+\//, '$1original/');

/**
 * An image the canvas may draw and still export, or null when it can't be had.
 * Fetched by its {@link canvasUrl}, so it comes from the cache the slide's card
 * filled when it can, and the blob that comes back is this page's own to draw.
 * A failure is logged, to find in the browser's console.
 */
const loadImage = async (src: string): Promise<ImageBitmap | HTMLImageElement | null> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    try {
        const response = await fetch(canvasUrl(src), {
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal,
        });
        if (!response.ok) {
            console.warn(`Poster image: ${response.status} for ${src}`);
            return null;
        }
        const blob = await response.blob();
        if (typeof createImageBitmap === 'function') return await createImageBitmap(blob);
        const url = URL.createObjectURL(blob);
        try {
            const image = new Image();
            image.src = url;
            await image.decode();
            return image;
        } finally {
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.warn(`Poster image: couldn't load ${src}`, error);
        return null;
    } finally {
        window.clearTimeout(timer);
    }
};

/**
 * The key art's URLs in the order to try them: each still at full size, then
 * as given. A phone skips the full size: TMDb's originals run to 4K and more,
 * and iOS Safari, past its memory for a decoded image, draws nothing at all
 * without saying so. The stored 1280px still is plenty for a phone's screen.
 */
export const artCandidates = (urls: string[], fullSizeToo: boolean): string[] =>
    urls.slice(0, KEY_ART_TRIES).flatMap((url) => {
        const big = fullSize(url);
        return fullSizeToo && big !== url ? [big, url] : [url];
    });

/** A phone or tablet, by its pointer: where the full-size stills aren't worth the risk. */
const coarsePointer = (): boolean =>
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Whether anything was painted over the fill in this box. A browser that
 * can't draw an image may leave the canvas untouched rather than throw, so the
 * art is checked by sampling a grid of points: a real still won't be the
 * exact page colour at every one.
 */
const painted = (ctx: CanvasRenderingContext2D, w: number, h: number): boolean => {
    const STEPS = 6;
    for (let i = 0; i < STEPS; i++) {
        for (let j = 0; j < STEPS; j++) {
            const x = Math.floor(((i + 0.5) / STEPS) * w);
            const y = Math.floor(((j + 0.5) / STEPS) * h);
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
            if (Math.abs(r - 3) > 2 || Math.abs(g - 6) > 2 || Math.abs(b - 20) > 2) return true;
        }
    }
    return false;
};

/**
 * Draws the first still that both loads and actually paints into the art's
 * box, on the page colour. False when none would.
 */
const drawKeyArt = async (
    ctx: CanvasRenderingContext2D,
    urls: string[],
    h: number
): Promise<boolean> => {
    for (const url of urls) {
        const image = await loadImage(url);
        if (!image) continue;
        ctx.fillStyle = INK;
        ctx.fillRect(0, 0, WIDTH, h);
        try {
            drawCover(ctx, image, 0, 0, WIDTH, h);
        } catch {
            // Treated as not drawn: the check below finds the box still blank.
        }
        if ('close' in image) image.close();
        if (painted(ctx, WIDTH, h)) return true;
    }
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, WIDTH, h);
    return false;
};

/** The faces the card is set in, loaded before it's drawn so the canvas doesn't fall back. */
const loadFonts = async (): Promise<void> => {
    if (!document.fonts?.load) return;
    await Promise.all(
        [`400 88px ${SERIF}`, `300 80px ${SANS}`, `600 28px ${SANS}`, `500 22px ${SANS}`].map(
            (font) => document.fonts.load(font).catch(() => [])
        )
    );
};

/** Draw an image to fill a box, cropped from its centre, as `object-fit: cover`. */
const drawCover = (
    ctx: CanvasRenderingContext2D,
    image: ImageBitmap | HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
) => {
    const iw = 'naturalWidth' in image ? image.naturalWidth : image.width;
    const ih = 'naturalHeight' in image ? image.naturalHeight : image.height;
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
};

/** Letter-spaced text where the canvas supports it; plain where it doesn't. */
const setTracking = (ctx: CanvasRenderingContext2D, px: number) => {
    if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = `${px}px`;
};

/** Text cut to a width, with an ellipsis if it had to be. */
const fitText = (ctx: CanvasRenderingContext2D, text: string, max: number): string => {
    if (ctx.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
};

/** `#rrggbb` at an opacity, for gradients. */
const withAlpha = (hex: string, alpha: number): string => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) return `rgba(183, 110, 65, ${alpha})`;
    const n = parseInt(match[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** How far a line of text reaches above its baseline, as drawn in the current font. */
const ascent = (ctx: CanvasRenderingContext2D, text: string): number =>
    ctx.measureText(text).actualBoundingBoxAscent;

export interface RenderedPoster {
    blob: Blob;
    /** False when the key art couldn't be loaded and the poster went without it. */
    complete: boolean;
}

/**
 * Draws the poster and returns it as a JPEG, or null where there's no canvas
 * to draw on.
 *
 * The text is laid from the foot up, each line placed by the measured height
 * of the one below it, so a missing favourite or a fallback font closes the
 * gap instead of colliding. The face sits on top of that stack, and the key
 * art runs down to just below it.
 */
export const renderPoster = async (content: PosterContent): Promise<RenderedPoster | null> => {
    const picks = shelfPicks(content.picks);
    const [avatar, favouritePoster, pickPosters] = await Promise.all([
        // The member's photo is this site's own, so any load will do.
        loadImage(content.avatar),
        content.favourite?.poster ? loadImage(content.favourite.poster) : null,
        Promise.all(picks.shown.map((pick) => (pick.poster ? loadImage(pick.poster) : null))),
        loadFonts(),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const cx = WIDTH / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Measure the stack from the foot up before drawing anything, so the art
    // knows where to end.
    const BILLING_Y = HEIGHT - 84;
    const billingFont = `500 22px ${SANS}`;
    const labelFont = `600 22px ${SANS}`;
    // Figures in Inter: Georgia's numerals are old-style, so "43" drops below
    // "6.0" and a row of them never lines up.
    const figureFont = `300 80px ${SANS}`;
    const yearFont = `400 300px ${SERIF}`;
    const nameFont = `400 96px ${SERIF}`;

    const labelY = BILLING_Y - 92;
    ctx.font = figureFont;
    const figureY = labelY - 44;
    const figureTop = figureY - ascent(ctx, '0123456789');

    const hasShelf = !!content.favourite || picks.shown.length > 0;
    const shelfTop = figureTop - 64 - SHELF.posterH;
    const shelfLabelY = shelfTop - 22;
    ctx.font = labelFont;
    const above = hasShelf ? shelfLabelY - ascent(ctx, 'PICKS') : figureTop;

    ctx.font = yearFont;
    const yearText = String(content.year);
    // Georgia's old-style numerals hang below the line (the 7 in 2027), so
    // the gap is measured from the year's lowest point.
    const yearY = above - 56 - ctx.measureText(yearText).actualBoundingBoxDescent;
    const yearTop = yearY - ascent(ctx, yearText);
    ctx.font = nameFont;
    const nameText = fitText(ctx, `${content.name}'s`, WIDTH - 160);
    const nameY = yearTop - 44;
    const nameTop = nameY - ascent(ctx, nameText);

    const R = 112;
    const avatarY = nameTop - 56 - R;
    const artH = Math.min(HEIGHT, avatarY + R + 60);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The key art, over the top, fading into the page.
    const art = await drawKeyArt(ctx, artCandidates(content.keyArt, !coarsePointer()), artH);
    const top = ctx.createLinearGradient(0, 0, 0, 380);
    top.addColorStop(0, 'rgba(3, 6, 20, 0.8)');
    top.addColorStop(1, 'rgba(3, 6, 20, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, WIDTH, 380);
    const fade = ctx.createLinearGradient(0, artH * 0.5, 0, artH);
    fade.addColorStop(0, 'rgba(3, 6, 20, 0)');
    fade.addColorStop(0.7, 'rgba(3, 6, 20, 0.85)');
    fade.addColorStop(1, INK);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, WIDTH, artH);

    // Their colour, glowing up from the bottom.
    const glow = ctx.createRadialGradient(cx, HEIGHT + 200, 0, cx, HEIGHT + 200, 1200);
    glow.addColorStop(0, withAlpha(content.accent, 0.32));
    glow.addColorStop(1, withAlpha(content.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The line over the art.
    ctx.fillStyle = SLATE_100;
    ctx.font = `600 28px ${SANS}`;
    setTracking(ctx, 10);
    ctx.fillText('THE CRITERION CLUB', cx, 128);
    setTracking(ctx, 0);

    // Their face, in a ring of their colour, where the art gives way.
    ctx.beginPath();
    ctx.arc(cx, avatarY, R + 14, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = content.accent;
    ctx.stroke();
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, avatarY, R, 0, Math.PI * 2);
        ctx.clip();
        drawCover(ctx, avatar, cx - R, avatarY - R, R * 2, R * 2);
        ctx.restore();
    }

    // The title: whose, then the year, large, in their colour.
    ctx.fillStyle = SLATE_50;
    ctx.font = nameFont;
    ctx.fillText(nameText, cx, nameY);
    ctx.fillStyle = content.accent;
    ctx.font = yearFont;
    setTracking(ctx, -8);
    ctx.fillText(yearText, cx, yearY);
    setTracking(ctx, 0);

    // The shelf: the favourite with its score, a rule, then their picks.
    if (hasShelf) {
        const { posterW: W, posterH: H, gap, groupGap } = SHELF;
        const groups: { label: string; count: number }[] = [
            ...(content.favourite ? [{ label: 'FAVOURITE', count: 1 }] : []),
            ...(picks.shown.length
                ? [{ label: 'PICKS', count: picks.shown.length + (picks.more ? 1 : 0) }]
                : []),
        ];
        const groupWidth = (n: number) => n * W + (n - 1) * gap;
        const total =
            groups.reduce((sum, g) => sum + groupWidth(g.count), 0) +
            (groups.length - 1) * groupGap;
        let x = cx - total / 2;
        groups.forEach((group, gi) => {
            const width = groupWidth(group.count);
            ctx.fillStyle = SLATE_400;
            ctx.font = labelFont;
            setTracking(ctx, 6);
            ctx.fillText(group.label, x + width / 2, shelfLabelY);
            setTracking(ctx, 0);
            if (gi > 0) {
                ctx.fillStyle = 'rgba(242, 245, 248, 0.15)';
                ctx.fillRect(x - groupGap / 2 - 1, shelfTop, 2, H);
            }
            if (group.label === 'FAVOURITE' && content.favourite) {
                drawPoster(ctx, favouritePoster, content.favourite.title, x, shelfTop);
                drawScore(ctx, content.favourite.score, content.accent, x + W, shelfTop + H);
            } else {
                picks.shown.forEach((pick, i) =>
                    drawPoster(ctx, pickPosters[i], pick.title, x + i * (W + gap), shelfTop)
                );
                if (picks.more) {
                    const mx = x + picks.shown.length * (W + gap);
                    ctx.fillStyle = 'rgba(242, 245, 248, 0.06)';
                    ctx.fillRect(mx, shelfTop, W, H);
                    ctx.fillStyle = SLATE_300;
                    ctx.font = `300 52px ${SANS}`;
                    ctx.fillText(`+${picks.more}`, mx + W / 2, shelfTop + H / 2 + 18);
                }
            }
            x += width + groupGap;
        });
    }

    // The figures, in a row of columns with rules between.
    const COLUMN_W = 260;
    const rowLeft = cx - (content.figures.length * COLUMN_W) / 2;
    content.figures.forEach((figure, i) => {
        const fx = rowLeft + COLUMN_W * (i + 0.5);
        ctx.fillStyle = SLATE_50;
        ctx.font = figureFont;
        setTracking(ctx, 0);
        ctx.fillText(figure.value, fx, figureY);
        ctx.fillStyle = SLATE_400;
        ctx.font = labelFont;
        setTracking(ctx, 6);
        ctx.fillText(figure.label.toUpperCase(), fx, labelY);
        if (i > 0) {
            ctx.fillStyle = 'rgba(242, 245, 248, 0.15)';
            ctx.fillRect(rowLeft + COLUMN_W * i, figureTop - 6, 2, labelY + 10 - (figureTop - 6));
        }
    });

    // The billing, small, along the foot, well clear of the figures.
    ctx.fillStyle = SLATE_500;
    ctx.font = billingFont;
    setTracking(ctx, 6);
    ctx.fillText('CRITERIONCLUB.ORG', cx, BILLING_Y);

    const blob = await new Promise<Blob | null>((resolve) => {
        try {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
        } catch {
            resolve(null);
        }
    });
    return blob ? { blob, complete: art || !content.keyArt.length } : null;
};

/** One one-sheet on the shelf, or its title on a card when it has none or it won't load. */
const drawPoster = (
    ctx: CanvasRenderingContext2D,
    image: ImageBitmap | HTMLImageElement | null,
    title: string,
    x: number,
    y: number
) => {
    const { posterW: W, posterH: H } = SHELF;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#1f2939'; // slate-800
    ctx.fillRect(x, y, W, H);
    ctx.restore();
    if (image) {
        drawCover(ctx, image, x, y, W, H);
    } else {
        ctx.fillStyle = SLATE_300;
        ctx.font = `400 20px ${SERIF}`;
        wrapLines(ctx, title, W - 20, 4).forEach((line, i, lines) =>
            ctx.fillText(line, x + W / 2, y + H / 2 + (i - (lines.length - 1) / 2) * 26 + 7)
        );
    }
    ctx.strokeStyle = 'rgba(242, 245, 248, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, W - 2, H - 2);
};

/** The favourite's score, on a disc of their colour over the poster's corner. */
const drawScore = (
    ctx: CanvasRenderingContext2D,
    score: string,
    accent: string,
    right: number,
    bottom: number
) => {
    const r = 34;
    const x = right - 8;
    const y = bottom - 8;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `700 ${score.length > 2 ? 26 : 32}px ${SANS}`;
    ctx.fillText(score, x, y + 11);
};

/** Words broken into lines of at most this width, the last cut short if there are too many. */
const wrapLines = (
    ctx: CanvasRenderingContext2D,
    text: string,
    max: number,
    most: number
): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= max || !line) line = next;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length <= most) return lines.map((l) => fitText(ctx, l, max));
    return [...lines.slice(0, most - 1), fitText(ctx, `${lines[most - 1]}…`, max)];
};

/** Whether this device hands an image to a share sheet rather than downloading it. */
export const sharesFiles = (): boolean =>
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

/**
 * Hands the image over: to the share sheet on a phone, where "Save Image" and
 * every app live, or as a download anywhere else. False when the reader backed
 * out of the share sheet.
 */
export const deliverPoster = async (
    blob: Blob,
    filename: string,
    title: string
): Promise<boolean> => {
    const file = new File([blob], filename, { type: blob.type });
    if (sharesFiles() && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title });
            return true;
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return false;
            // Refused for some other reason (activation spent, say): download instead.
        }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
};
