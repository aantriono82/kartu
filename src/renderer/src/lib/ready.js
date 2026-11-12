const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))

/** Resolves once fonts and all <img> in the document are loaded and painted. */
export async function waitForAssets(root = document) {
  await document.fonts.ready
  await nextFrame()
  const imgs = [...root.querySelectorAll('img')]
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))))
  await nextFrame()
  await nextFrame()
}
