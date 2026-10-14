import type { FloorTile4D } from './floorTile';
import { roomHalfExtent } from '../ui/roomBoundary';

// Player World, just below the existing size-1.8 tesseract's y=-.9 base.
export const floorY = -1;
export const grayFloor: FloorTile4D = {
  type:'gray',yFloor:floorY,
  x:[-roomHalfExtent,roomHalfExtent],z:[-roomHalfExtent,roomHalfExtent],w:[-roomHalfExtent,roomHalfExtent],
};
