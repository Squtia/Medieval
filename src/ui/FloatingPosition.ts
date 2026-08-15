export interface FloatingPositionInput {
  pointerX: number;
  pointerY: number;
  elementWidth: number;
  elementHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset?: number;
  padding?: number;
}

export function calculateFloatingPosition(input: FloatingPositionInput): { x: number; y: number } {
  const offset = input.offset ?? 15;
  const padding = input.padding ?? 12;
  const maxX = Math.max(padding, input.viewportWidth - input.elementWidth - padding);
  const maxY = Math.max(padding, input.viewportHeight - input.elementHeight - padding);

  let x = input.pointerX + offset;
  // 若右側溢出且左側有足夠空間，則翻轉至游標左側
  if (x + input.elementWidth > input.viewportWidth - padding && (input.pointerX - offset - input.elementWidth) >= padding) {
    x = input.pointerX - offset - input.elementWidth;
  } else {
    x = Math.min(maxX, Math.max(padding, x));
  }

  let y = input.pointerY + offset;
  if (y + input.elementHeight > input.viewportHeight - padding && (input.pointerY - offset - input.elementHeight) >= padding) {
    y = input.pointerY - offset - input.elementHeight;
  } else {
    y = Math.min(maxY, Math.max(padding, y));
  }

  return { x, y };
}

export function positionFloatingElement(element: HTMLElement, pointerX: number, pointerY: number): void {
  const { x, y } = calculateFloatingPosition({
    pointerX,
    pointerY,
    elementWidth: element.offsetWidth,
    elementHeight: element.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  });
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}
