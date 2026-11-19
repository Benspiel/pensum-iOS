import { fitZoom } from './state';

type Size = { width: number; height: number };

/** Layout before UIKit applies the user's pinch zoom. Keep the drawing centered even at the minimum fit scale. */
export function canvasViewport(scene: Size, viewport: Size) {
  const zoom = fitZoom(scene.width, scene.height, viewport.width, viewport.height);
  const width = scene.width * zoom;
  const height = scene.height * zoom;
  const contentWidth = Math.max(viewport.width, width);
  const contentHeight = Math.max(viewport.height, height);
  return {
    zoom, width, height, contentWidth, contentHeight,
    offset: { x: (contentWidth - viewport.width) / 2, y: (contentHeight - viewport.height) / 2 },
  };
}
