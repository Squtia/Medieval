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

  return {
    x: Math.min(maxX, Math.max(padding, input.pointerX + offset)),
    y: Math.min(maxY, Math.max(padding, input.pointerY + offset))
  };
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
