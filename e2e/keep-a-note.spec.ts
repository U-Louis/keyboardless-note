import { expect, test, type Page } from '@playwright/test'

async function allowInput(page: Page) {
  const tag = page.getByRole('button', { name: 'Input' })
  if ((await tag.getAttribute('aria-pressed')) !== 'true') await tag.click()
  await expect(tag).toHaveAttribute('aria-pressed', 'true')
  const list = page.getByRole('listbox', { name: 'Notes' })
  await list.focus()
  await expect(list).toBeFocused()
}

async function openPage(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await allowInput(page)
}

async function createLamp(page: Page) {
  await openPage(page)
  await page.keyboard.press('n')
  await expect(page.getByLabel('Title')).toBeFocused()
  await page.keyboard.type('Lamp')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option', { name: 'Lamp' })).toBeVisible()
  await expect(page.getByLabel('Body')).toBeFocused()
}

test('creates Lamp and stores the title', async ({ page }) => {
  await createLamp(page)
  await expect(page.getByLabel('Body')).toHaveValue('')
  await expect(page.getByLabel('Body')).toBeFocused()
  const stored = await page.evaluate(() => localStorage.getItem('keyboardless-note'))
  expect(JSON.parse(stored ?? 'null')).toEqual([
    expect.objectContaining({ title: 'Lamp', body: '' }),
  ])
})

test('refuses an empty title', async ({ page }) => {
  await openPage(page)
  await page.keyboard.press('n')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-error-code="note.title.required"]')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('keyboardless-note'))).toBeNull()
})

test('refuses clearing the title of Lamp', async ({ page }) => {
  await createLamp(page)
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByLabel('Title')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-error-code="note.title.required"]')).toBeVisible()
  await expect(page.getByRole('option', { name: 'Lamp' })).toBeVisible()
  const stored = await page.evaluate(() => localStorage.getItem('keyboardless-note'))
  expect(JSON.parse(stored ?? 'null')).toEqual([
    expect.objectContaining({ title: 'Lamp' }),
  ])
})

test('refuses a title of 81 characters', async ({ page }) => {
  await openPage(page)
  await page.keyboard.press('n')
  await page.keyboard.type('a'.repeat(81))
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-error-code="note.title.too_long"]')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('keyboardless-note'))).toBeNull()
})

test('keeps the body desk after reload', async ({ page }) => {
  await createLamp(page)
  await page.keyboard.type('desk')
  await page.reload()
  await expect(page.getByRole('option', { name: 'Lamp' })).toBeVisible()
  await allowInput(page)
  await expect(page.getByLabel('Body')).toHaveValue('desk')
})

test('deletes the selected note with d', async ({ page }) => {
  await createLamp(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox', { name: 'Notes' })).toBeFocused()
  await page.keyboard.press('d')
  await page.reload()
  await expect(page.getByRole('option')).toHaveCount(0)
})

test('a filled card sticks when another card is added', async ({ page }) => {
  await openPage(page)
  const board = page.getByRole('region', { name: 'Board' })
  await board.getByRole('button', { name: 'Add card' }).click()
  await page.keyboard.type('Lamp')
  await page.keyboard.press('Tab')
  await page.keyboard.type('desk')
  await board.getByRole('button', { name: 'Add card' }).click()
  await expect(board.getByRole('option', { name: 'Lamp' })).toContainText('desk')
  await expect(page.getByLabel('Title')).toBeFocused()
  await page.keyboard.type('Chair')
  await page.keyboard.press('Tab')
  await page.keyboard.type('legs')
  await board.getByRole('button', { name: 'Add card' }).click()
  await expect(board.getByRole('option', { name: 'Lamp' })).toContainText('desk')
  await expect(board.getByRole('option', { name: 'Chair' })).toContainText('legs')
  await page.reload()
  await expect(page.getByRole('option', { name: 'Lamp' })).toContainText('desk')
  await expect(page.getByRole('option', { name: 'Chair' })).toContainText('legs')
  const stored = await page.evaluate(() => localStorage.getItem('keyboardless-note'))
  expect(JSON.parse(stored ?? 'null')).toEqual([
    expect.objectContaining({ title: 'Lamp', body: 'desk' }),
    expect.objectContaining({ title: 'Chair', body: 'legs' }),
  ])
})

test('shows every card in the board, adds with +, and deletes with ×', async ({ page }) => {
  await openPage(page)
  const board = page.getByRole('region', { name: 'Board' })
  await board.getByRole('button', { name: 'Add card' }).click()
  await expect(page.getByLabel('Title')).toBeFocused()
  await page.keyboard.type('Lamp')
  await page.keyboard.press('Enter')
  await page.keyboard.type('desk')
  await page.keyboard.press('Escape')
  await board.getByRole('button', { name: 'Add card' }).click()
  await page.keyboard.type('Chair')
  await page.keyboard.press('Enter')
  await expect(board.getByRole('option', { name: 'Lamp' })).toBeVisible()
  await expect(board.getByRole('option', { name: 'Chair' })).toBeVisible()
  await expect(board.getByRole('option', { name: 'Lamp' })).toContainText('desk')
  await board.getByRole('button', { name: 'Delete Lamp' }).click()
  await expect(board.getByRole('option', { name: 'Lamp' })).toHaveCount(0)
  await expect(board.getByRole('option', { name: 'Chair' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('option', { name: 'Lamp' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Chair' })).toBeVisible()
})

test('clicks and keys stay off until the input tag is on', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'keyboardless-note',
      JSON.stringify([{ id: '1', title: 'Lamp', body: 'desk' }]),
    )
  })
  await page.goto('/')
  const input = page.getByRole('button', { name: 'Input' })
  const talk = page.getByRole('button', { name: 'Push to talk' })
  const lamp = page.getByRole('option', { name: 'Lamp' })
  await expect(input).toHaveAttribute('aria-pressed', 'false')
  await expect(talk).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete Lamp' })).toHaveCount(0)
  await expect(page.getByLabel('Title')).toHaveCount(0)
  await expect(lamp).toHaveCSS('pointer-events', 'none')
  await lamp.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.keyboard.press('n')
  await page.keyboard.press('d')
  await page.keyboard.type('nope')
  await expect(page.getByLabel('Title')).toHaveCount(0)
  await expect(lamp).toBeVisible()
  await input.click()
  await expect(input).toHaveAttribute('aria-pressed', 'true')
  const add = page.getByRole('button', { name: 'Add card' })
  const remove = page.getByRole('button', { name: 'Delete Lamp' })
  await expect(add).toBeVisible()
  await expect(remove).toBeVisible()
  await expect(lamp).toHaveCSS('pointer-events', 'auto')
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByLabel('Body')).toHaveValue('desk')
  await add.hover()
  await expect(add).toHaveCSS('background-color', 'rgb(255, 253, 248)')
  await remove.hover()
  await expect(remove).toHaveCSS('background-color', 'rgb(253, 232, 232)')
})
