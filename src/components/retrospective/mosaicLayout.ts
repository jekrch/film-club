import type { FrameImage } from '../../utils/frameSources';
import { wallColumns } from '../../utils/retrospectiveArt';

/** The most columns the wall shows (at `lg`); narrower screens show the first three or four. */
export const COLUMNS = 6;
/**
 * Tiles per column: enough to fill a tall phone screen in a narrow column with
 * a third left over to drift through.
 */
export const PER_COLUMN = 18;
/** Tiles at the head of each column, loaded eagerly: the ones on screen at first. */
export const EAGER_PER_COLUMN = 4;

/** The wall's columns, as `Mosaic` lays them. */
export const mosaicColumns = (images: FrameImage[]): FrameImage[][] =>
    wallColumns(images, COLUMNS, PER_COLUMN);

/**
 * The images a wall of these shows first, for warming the cache before it's
 * put up: the head of every column, in the same shuffle `Mosaic` lays.
 */
export const leadingTiles = (images: FrameImage[]): FrameImage[] =>
    mosaicColumns(images).flatMap((tiles) => tiles.slice(0, EAGER_PER_COLUMN));
