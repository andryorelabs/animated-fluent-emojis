/* eslint-disable unicorn-js/isolated-functions -- the evaluated callbacks run in the browser */
import { expect, test, type Locator, type Page } from '@playwright/test'

const DOCK = '[data-dock]'
const FAQ = '[aria-labelledby="faq-title"]'
const INSTALL = '[aria-labelledby="install-title"]'
const CLOSING = '[aria-labelledby="closing-title"]'
const PACKAGE_MANAGERS = ['bun', 'pnpm', 'npm', 'yarn']

const isShown = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return style.visibility === 'visible' && Number(style.opacity) > 0.99
  })

async function openHome(page: Page) {
  await page.goto('/')
  const dock = page.locator(DOCK)
  await expect(dock).toBeAttached()
  await page.waitForLoadState('load')
  return dock
}

async function scrollToInstall(page: Page) {
  await page.locator(INSTALL).evaluate((element) => {
    element.scrollIntoView({ block: 'center' })
  })
}

async function scrollToEnd(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
}

test.describe('floating dock with motion allowed', () => {
  test.use({
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })

  test('is hidden over the hero and shown past it', async ({ page }) => {
    const dock = await openHome(page)
    expect(await isShown(dock)).toBe(false)

    await scrollToInstall(page)
    await expect.poll(() => isShown(dock)).toBe(true)
  })

  test('lists every package manager and stays inside the page', async ({
    page,
  }) => {
    const dock = await openHome(page)
    await scrollToInstall(page)
    await expect.poll(() => isShown(dock)).toBe(true)

    await expect(dock.getByRole('tab')).toHaveText(PACKAGE_MANAGERS)
    const box = await dock.boundingBox()
    expect(box?.height).toBe(48)
    expect(box?.width).toBeLessThanOrEqual(736)
    const viewport = page.viewportSize()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      (viewport?.height ?? 0) - 16,
    )
  })

  test('hides again at the closing panel so it never covers the footer', async ({
    page,
  }) => {
    const dock = await openHome(page)
    await scrollToInstall(page)
    await expect.poll(() => isShown(dock)).toBe(true)

    await scrollToEnd(page)
    await expect.poll(() => isShown(dock)).toBe(false)
  })

  test('the tabs share the choice with the install block and copy the command', async ({
    page,
  }) => {
    const dock = await openHome(page)
    await scrollToInstall(page)
    await expect.poll(() => isShown(dock)).toBe(true)
    const island = dock.locator('astro-island')
    await expect(island).not.toHaveAttribute('ssr', /.*/)

    await dock.getByRole('tab', { name: 'pnpm' }).click()
    await expect(dock.getByRole('tab', { name: 'pnpm' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(
      page.getByRole('tab', { name: 'pnpm', selected: true }),
    ).toHaveCount(2)

    await dock.getByRole('button', { name: 'Copy' }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe('pnpm add animated-fluent-emojis')
  })
})

test.describe('floating dock under reduced motion', () => {
  test.use({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  })

  test('appears once past the hero without a transition and hides at the end', async ({
    page,
  }) => {
    const dock = await openHome(page)
    expect(await isShown(dock)).toBe(false)

    await scrollToInstall(page)
    await expect.poll(() => isShown(dock)).toBe(true)
    const transform = await dock.evaluate(
      (element) => getComputedStyle(element).transform,
    )
    expect(transform).toBe('none')

    await scrollToEnd(page)
    await expect.poll(() => isShown(dock)).toBe(false)
  })
})

test.describe('floating dock on a phone', () => {
  test.use({
    reducedMotion: 'no-preference',
    viewport: { width: 390, height: 844 },
  })

  test('fits the viewport, keeps 44px tap targets and does not overflow', async ({
    page,
  }) => {
    const dock = await openHome(page)
    await scrollToInstall(page)
    await expect.poll(() => isShown(dock)).toBe(true)

    const box = await dock.boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
    const tabs = await dock.getByRole('tab').all()
    for (const tab of tabs) {
      const hits = await tab.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const centreY = rect.top + rect.height / 2
        return [-20, 20].map((offset) =>
          element.contains(document.elementFromPoint(x, centreY + offset)),
        )
      })
      expect(hits).toEqual([true, true])
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('is gone at the page end, leaving the footer uncovered', async ({
    page,
  }) => {
    const dock = await openHome(page)
    await scrollToEnd(page)
    await expect.poll(() => isShown(dock)).toBe(false)
    await expect(page.locator('footer')).toBeInViewport()
  })
})

test.describe('faq mascot', () => {
  test.use({
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 900 },
  })

  test('follows the open question', async ({ page }) => {
    await page.goto('/')
    const faq = page.locator(FAQ)
    await faq.scrollIntoViewIfNeeded()
    await expect(faq.locator('astro-island')).not.toHaveAttribute('ssr', /.*/)
    const mascot = (id: string) =>
      faq
        .locator(`[data-faq-mascot="${id}"]`)
        .evaluate((element) => getComputedStyle(element).opacity)

    await expect(
      faq.getByRole('button', { name: /in a chat or a document/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(() => mascot('chat')).toBe('1')
    await expect.poll(() => mascot('speed')).toBe('0')

    await faq.getByRole('button', { name: /slow my page/i }).click()
    await expect.poll(() => mascot('speed')).toBe('1')
    await expect.poll(() => mascot('chat')).toBe('0')
    await expect(
      faq.getByRole('button', { name: /in a chat or a document/i }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  test('the closing panel links to GitHub', async ({ page }) => {
    await page.goto('/')
    const link = page.locator(`${CLOSING} [data-closing-github]`)
    await expect(link).toHaveAttribute(
      'href',
      /github\.com\/andryorelabs\/animated-fluent-emojis/,
    )
  })
})
/* eslint-enable unicorn-js/isolated-functions -- end of the browser callbacks */
