import { expect, test, type Page } from '@playwright/test'
import { installDesktopMock, readEcosE2EState } from './desktopMock'

async function openNewWorkspaceWizard(page: Page) {
  await page.getByRole('button', { name: 'File' }).click()
  await page.getByRole('button', { name: /New Workspace/ }).click()

  const wizard = page.locator('.new-project-wizard-panel')
  await expect(wizard.getByRole('heading', { name: 'New Project' })).toBeVisible()
  return wizard
}

async function createWorkspaceFromWizard(page: Page) {
  const wizard = await openNewWorkspaceWizard(page)

  await wizard.getByPlaceholder('e.g. my_chip_design').fill('e2e_chip')
  await wizard.getByRole('button', { name: /Browse/ }).click()
  await expect(wizard.getByPlaceholder('Choose a folder...')).toHaveValue(
    '/workspace/e2e_chip',
  )
  await wizard.getByRole('button', { name: /Continue/ }).click()

  await expect(
    wizard.getByRole('heading', { exact: true, name: 'Design Files' }),
  ).toBeVisible()
  await wizard.getByRole('button', { name: /Browse/ }).click()
  await wizard.getByRole('button', { name: /Select RTL files/ }).click()
  await expect(wizard.getByText('alu.sv', { exact: true })).toBeVisible()
  await wizard.getByPlaceholder('e.g. top_module').fill('chip_top')
  await wizard.getByPlaceholder('e.g. clk').fill('clk_i')
  await wizard.getByRole('button', { name: /Continue/ }).click()

  await expect(wizard.getByRole('heading', { name: 'Technology Setup' })).toBeVisible()
  await expect(wizard.getByText('ICS55 PDK')).toBeVisible()
  await wizard.getByRole('button', { name: /Continue/ }).click()

  await expect(wizard.getByRole('heading', { name: 'Review & Create' })).toBeVisible()
  await wizard.getByRole('button', { name: /Create Project/ }).click()

  await expect(page).toHaveURL(/#\/workspace\/home$/)
}

test.beforeEach(async ({ page }) => {
  await installDesktopMock(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ECOS Studio' })).toBeVisible()
})

test('creates a workspace from the new project wizard with a mocked desktop bridge', async ({
  page,
}) => {
  await createWorkspaceFromWizard(page)

  const state = await readEcosE2EState(page)
  expect(state.createdWorkspace).toMatchObject({
    directory: '/workspace/e2e_chip',
    pdk: 'ics55',
    pdk_root: '/pdks/ics55',
    rtl_list: ['/external/alu.sv'],
  })
  expect(state.createdWorkspace?.parameters).toMatchObject({
    Clock: 'clk_i',
    Design: 'e2e_chip',
    PDK: 'ics55',
    'Top module': 'chip_top',
  })
})

test('opens an existing workspace from the File menu with a mocked desktop bridge', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'File' }).click()
  await page.getByRole('button', { name: /Open Workspace/ }).click()

  await expect(page).toHaveURL(/#\/workspace\/home$/)

  const state = await readEcosE2EState(page)
  expect(state.loadedWorkspace).toMatchObject({
    directory: '/workspace/e2e_chip',
  })
  expect(state.settings.current_project_path).toBe('/workspace/e2e_chip')
  expect(state.settings.recent_projects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'e2e_chip',
        path: '/workspace/e2e_chip',
      }),
    ]),
  )
})

test('manages RTL design files from the Design menu in a mocked workspace', async ({
  page,
}) => {
  await createWorkspaceFromWizard(page)

  await page.getByRole('button', { name: 'Design' }).click()
  await page.getByRole('button', { name: /Manage RTL Files/ }).click()

  const dialog = page.locator('.design-files-dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Manage RTL Design Files' }),
  ).toBeVisible()
  await expect(dialog.getByText('top.sv', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: /Browse/ }).click()
  await dialog.getByRole('button', { name: /Select RTL files/ }).click()
  await expect(dialog.getByText('alu.sv', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: /Save Changes/ }).click()
  await expect(page.getByText('Keep Current Run Results?')).toBeVisible()
  await page.getByRole('button', { name: /Keep Results/ }).click()
  await expect(dialog).toBeHidden()

  const state = await readEcosE2EState(page)
  expect(state.addedDesignFiles).toContainEqual(['/external/alu.sv'])
})
