import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ECOS Studio' })).toBeVisible()
})

test('shows the ECOS Studio home screen', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'ECOS Studio' })).toBeVisible()
})

test('navigates to the SoC template gallery from the home button', async ({ page }) => {
  await page.getByRole('button', { name: /SoC Remote template catalog/ }).click()

  await expect(page).toHaveURL(/#\/soc$/)
})

test('navigates to backend design from the home button', async ({ page }) => {
  await page.getByRole('button', { name: /Backend Design/ }).click()

  await expect(page).toHaveURL(/#\/ecc$/)
})

test('navigates to resource manager from the quick link', async ({ page }) => {
  await page.getByRole('button', { name: /Resource Manager/ }).click()

  await expect(page).toHaveURL(/#\/tools$/)
})

test('navigates to project management from the home button', async ({ page }) => {
  await page.getByRole('button', { name: /Project Management/ }).click()

  await expect(page).toHaveURL(/#\/projects$/)
})
