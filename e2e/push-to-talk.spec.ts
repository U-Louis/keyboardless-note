import { expect, test, type Page } from '@playwright/test'

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

async function allowInput(page: Page) {
  const tag = page.getByRole('button', { name: 'Input' })
  if ((await tag.getAttribute('aria-pressed')) !== 'true') await tag.click()
  await expect(tag).toHaveAttribute('aria-pressed', 'true')
  const list = page.getByRole('listbox', { name: 'Notes' })
  await list.focus()
  await expect(list).toBeFocused()
}

async function holdTalk(page: Page) {
  await allowInput(page)
  await page.keyboard.down('v')
  await expect(page.locator('[data-speech="recording"]')).toBeVisible()
  await page.waitForTimeout(400)
  await page.keyboard.up('v')
}

test('a spoken create stores Lamp', async ({ page }) => {
  let postedFile = false
  await page.route('**/api/talk', async (route) => {
    const body = route.request().postDataBuffer()
    postedFile = Boolean(
      body && body.byteLength > 32 && body.toString('latin1').includes('name="speech"'),
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript: 'new note Lamp',
        instruction: { action: 'create', title: 'Lamp' },
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await holdTalk(page)
  await expect(page.getByRole('option', { name: 'Lamp' })).toBeVisible()
  expect(postedFile).toBe(true)
  await expect(page.getByLabel('Body')).toHaveValue('')
  const stored = await page.evaluate(() => localStorage.getItem('keyboardless-note'))
  expect(JSON.parse(stored ?? 'null')).toEqual([
    expect.objectContaining({ title: 'Lamp', body: '' }),
  ])
})

test('a spoken empty title is refused', async ({ page }) => {
  await page.route('**/api/talk', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript: 'new note',
        instruction: { action: 'create', title: '   ' },
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await holdTalk(page)
  await expect(page.locator('[data-error-code="note.title.required"]')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('keyboardless-note'))).toBeNull()
})

test('a spoken delete removes the selected note', async ({ page }) => {
  await page.goto('/')
  await allowInput(page)
  await page.keyboard.press('n')
  await page.keyboard.type('Lamp')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await page.route('**/api/talk', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript: 'delete',
        instruction: { action: 'delete' },
      }),
    })
  })
  await holdTalk(page)
  await expect(page.getByRole('option')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('option')).toHaveCount(0)
})

test('the push to talk button is large and hold sends the clip', async ({ page }) => {
  let postedFile = false
  await page.route('**/api/talk', async (route) => {
    const body = route.request().postDataBuffer()
    postedFile = Boolean(
      body && body.byteLength > 32 && body.toString('latin1').includes('name="speech"'),
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript: 'new note Lamp',
        instruction: { action: 'create', title: 'Lamp' },
      }),
    })
  })
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Push to talk' })
  const box = await button.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(96)
  expect(box?.width).toBeGreaterThanOrEqual(320)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await expect(page.locator('[data-speech="recording"]')).toBeVisible()
  await page.waitForTimeout(400)
  await page.mouse.up()
  await expect(page.getByRole('option', { name: 'Lamp' })).toBeVisible()
  expect(postedFile).toBe(true)
})

test('a blocked microphone explains that the editor browser does not allow it', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('denied', 'NotAllowedError'))
  })
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await allowInput(page)
  await page.keyboard.down('v')
  const error = page.locator('[data-error-code="speech.mic"]')
  await expect(error).toHaveText(
    'The microphone is blocked. The browser inside the editor does not allow it. Open http://127.0.0.1:5173 in Chrome and allow the microphone.',
  )
  await expect(error).toHaveCSS('color', 'rgb(159, 18, 57)')
  await page.keyboard.up('v')
})

test('shows the whisper text when cursor fails', async ({ page }) => {
  await page.route('**/api/talk', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: { code: 'speech.cursor_key' },
        transcript: 'lights on the desk',
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await holdTalk(page)
  await expect(page.locator('[data-transcript]')).toHaveText('lights on the desk')
  await expect(page.locator('[data-error-code="speech.cursor_key"]')).toBeVisible()
})

test('shows a spinner while thinking and then the whisper text', async ({ page }) => {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/talk', async (route) => {
    await gate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript: 'lights on the desk',
        instruction: { action: 'none' },
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await holdTalk(page)
  await expect(page.locator('.spinner')).toBeVisible()
  release()
  await expect(page.locator('[data-transcript]')).toHaveText('lights on the desk')
})

test('a route plan creates the note and then its body', async ({ page }) => {
  await page.route('**/api/talk', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript:
          'Alors créez une note avec le titre test et le corps de texte. Ceci est un test.',
        steps: [
          { id: '1', after: [], instruction: { action: 'create', title: 'test' } },
          {
            id: '2',
            after: ['1'],
            instruction: { action: 'update_body', body: 'Ceci est un test.', target: 'test' },
          },
        ],
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await holdTalk(page)
  await expect(page.getByRole('option', { name: 'test' })).toBeVisible()
  await expect(page.getByLabel('Body')).toHaveValue('Ceci est un test.')
  await expect(page.locator('[data-error-code]')).toHaveCount(0)
  const stored = await page.evaluate(() => localStorage.getItem('keyboardless-note'))
  expect(JSON.parse(stored ?? 'null')).toEqual([
    expect.objectContaining({ title: 'test', body: 'Ceci est un test.' }),
  ])
})

test('a spoken read shows the card and a spoken count shows the total', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await allowInput(page)
  await page.keyboard.press('n')
  await expect(page.getByLabel('Title')).toBeFocused()
  await page.keyboard.type('Lamp')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Body')).toBeFocused()
  await page.keyboard.type('desk')
  await expect(page.getByLabel('Body')).toHaveValue('desk')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await page.route('**/api/talk', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        transcript: 'read Lamp and count',
        steps: [
          { id: '1', action: 'read_card', target: 'Lamp' },
          { id: '2', action: 'count' },
        ],
      }),
    })
  })
  await holdTalk(page)
  await expect(page.locator('[data-readout]')).toHaveText('Lamp\ndesk\n1')
  await expect(page.getByLabel('Body')).toHaveValue('desk')
  const stored = await page.evaluate(() => localStorage.getItem('keyboardless-note'))
  expect(JSON.parse(stored ?? 'null')).toEqual([
    expect.objectContaining({ title: 'Lamp', body: 'desk' }),
  ])
})
