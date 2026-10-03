export function clearPrototypeStorage(storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("yscc-")) storage.removeItem(key);
  }
}
