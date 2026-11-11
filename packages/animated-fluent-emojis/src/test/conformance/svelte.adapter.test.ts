import { createRawSnippet, mount, unmount } from 'svelte'
import { afterEach, beforeEach, expect, test } from 'vitest'

import Emoji from '../../svelte/Emoji.svelte'
import type { EmojiProps } from '../../svelte/types.js'
import { configureEmojis } from '../../utils/index.js'

const knownId = 'grinning-face'

const mounted: {
  container: HTMLElement
  instance?: Record<string, unknown> | undefined
} = { container: document.createElement('div') }

const render = (props: EmojiProps): HTMLElement => {
  mounted.instance = mount(Emoji, { target: mounted.container, props })
  return mounted.container
}

beforeEach(() => {
  mounted.container = document.createElement('div')
  document.body.append(mounted.container)
  configureEmojis({})
})

afterEach(() => {
  if (mounted.instance) void unmount(mounted.instance)
  mounted.instance = undefined
  mounted.container.remove()
})

const fallbackSnippet = createRawSnippet(() => ({
  render: () => '<b data-testid="fallback">custom</b>',
}))

test('an unknown id renders the fallback snippet once the manifest is ready', async () => {
  const container = render({
    id: 'definitely-not-an-emoji',
    fallback: fallbackSnippet,
  })

  await expect
    .poll(
      () => container.querySelector('[data-testid="fallback"]')?.textContent,
    )
    .toBe('custom')
})

test('a null fallback renders nothing for an unknown id', async () => {
  const container = render({ id: 'definitely-not-an-emoji', fallback: null })

  await expect.poll(() => container.querySelector('span')).toBeNull()
})

test('class, style and attributes reach the root span', async () => {
  const container = render({
    id: knownId,
    size: 32,
    class: 'mine',
    style: { margin: '2px' },
    attributes: { 'data-probe': 'yes' },
  })

  await expect.poll(() => container.querySelector('img')).not.toBeNull()

  const root = container.querySelector<HTMLElement>('span.mine')
  expect(root?.dataset.probe).toBe('yes')
  expect(root?.style.margin).toBe('2px')
  expect(root?.style.width).toBe('32px')
})

test('onLoad is called with the load event of the image', async () => {
  const events: Event[] = []
  render({
    id: knownId,
    onLoad: (event) => {
      events.push(event)
    },
  })

  await expect.poll(() => events.length).toBe(1)
  expect(events[0]?.type).toBe('load')
})
