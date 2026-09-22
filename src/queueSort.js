export function compareQueueValues(a, b) {
  const left = a ?? "";
  const right = b ?? "";
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sortQueueRows(rows, sort, accessors, fallback) {
  const accessor = accessors[sort.key];
  if (!accessor) return [...rows];
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const order = compareQueueValues(accessor(a), accessor(b));
    return order ? order * direction : fallback?.(a, b) ?? 0;
  });
}
