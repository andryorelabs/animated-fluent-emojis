import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { FIXTURE_MANIFEST } from '../test/manifest-fixture.js'
import { configureEmojis } from '../utils/index.js'
import Emoji from './Emoji.astro'

const render = async (
  props: Record<string, unknown>,
  slots?: Record<string, string>,
): Promise<string> => {
  const container = await AstroContainer.create()
  return container.renderToString(
    Emoji,
    slots === undefined ? { props } : { props, slots },
  )
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => 0 as never)
  configureEmojis({
    assetSiteUrl: `https://astro-${crypto.randomUUID()}.test`,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(FIXTURE_MANIFEST))),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('a ready emoji renders a sized span around the sprite image', async () => {
  const html = await render({ id: 'cat', size: 64 })

  expect(html).toMatch(/<span [^>]*data-fluent-emoji=/)
  expect(html).toContain('width:64px;height:64px')
  expect(html).not.toContain('aria-hidden')
  expect(html).toMatch(/<img [^>]*alt="Cat"/)
  expect(html).toMatch(/<img [^>]*src="https:\/\/astro-[^"]+\.png"/)
  expect(html).toContain('loading="lazy"')
})

test('an empty alt marks the ready emoji decorative', async () => {
  const html = await render({ id: 'cat', alt: '' })

  expect(html).toMatch(/<span [^>]*aria-hidden="true"/)
})

test('a missing id renders nothing without a fallback', async () => {
  const html = await render({ id: 'no-such-emoji' })

  expect(html).not.toContain('<img')
  expect(html).not.toContain('data-fluent-emoji')
  expect(html).not.toContain('<span')
})

test('a missing id renders the fallback slot in a sized span', async () => {
  const html = await render(
    { id: 'no-such-emoji', size: 32 },
    { fallback: '<b class="fallback">?</b>' },
  )

  expect(html).toMatch(/<span [^>]*width:32px/)
  expect(html).toContain('<b class="fallback">?</b>')
  expect(html).not.toContain('<img')
})

test('a ready emoji keeps the fallback slot inert in a template', async () => {
  const html = await render(
    { id: 'cat' },
    { fallback: '<b class="fallback">?</b>' },
  )

  expect(html).toMatch(
    /<template data-fluent-emoji-fallback><b class="fallback">\?<\/b><\/template>/,
  )
  expect(html).toContain('<img')
})

test('the component emits its playback script', async () => {
  const html = await render({ id: 'cat' })

  expect(html).toMatch(/<script type="module" src="[^"]*Emoji\.astro\?/)
})
