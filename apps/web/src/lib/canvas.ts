/**
 * Draws a base64 JPEG frame onto a canvas, resizing the canvas backing store
 * to the frame's native dimensions first. Keeping canvas.width/height equal to
 * the page viewport preserves the aspect ratio and keeps input-coordinate
 * mapping (canvas.width / rect.width) exact when the viewport changes.
 */
export function drawFrame(canvas: HTMLCanvasElement, frameBase64: string) {
  const img = new Image()
  img.onload = () => {
    if (
      canvas.width !== img.naturalWidth ||
      canvas.height !== img.naturalHeight
    ) {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
    }
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  img.src = `data:image/jpeg;base64,${frameBase64}`
}
