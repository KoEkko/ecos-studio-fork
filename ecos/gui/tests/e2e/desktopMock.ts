import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __ecosE2E: EcosE2EState
    ecosDesktop: any
  }
}

export interface EcosE2EState {
  addedDesignFiles: string[][]
  cliCommands: Array<{ cmd: string; data: Record<string, unknown>; source?: string }>
  createdWorkspace: Record<string, unknown> | null
  removedDesignFiles: string[]
  settings: Record<string, unknown>
}

export async function installDesktopMock(page: Page) {
  await page.addInitScript(() => {
    const state = {
      addedDesignFiles: [],
      cliCommands: [],
      createdWorkspace: null,
      removedDesignFiles: [],
      settings: {
        imported_pdks: [
          {
            description: 'Reference 55nm process',
            detectedFiles: {
              directories: ['libs.ref', 'libs.tech'],
              files: ['README.md'],
            },
            id: 'pdk-ics55',
            importedAt: '2026-07-02T00:00:00.000Z',
            name: 'ICS55 PDK',
            path: '/pdks/ics55',
            pdkId: 'ics55',
            techNode: '55nm',
          },
        ],
        recent_projects: [],
      },
    }

    const unsubscribe = () => {}

    window.__ecosE2E = state
    window.ecosDesktop = {
      app: {
        getVersions: async () => ({
          dreamplace: '0.0.0',
          ecc: '0.0.0',
          gui: 'e2e',
          runtime: 'e2e',
        }),
      },
      cli: {
        execute: async (request) => {
          state.cliCommands.push(request)
          if (request.cmd === 'create_workspace') {
            state.createdWorkspace = request.data
            return {
              cmd: request.cmd,
              data: {
                directory: request.data.directory,
                workspace_id: request.data.directory,
              },
              message: [],
              response: 'success',
            }
          }
          if (request.cmd === 'load_workspace') {
            return {
              cmd: request.cmd,
              data: {
                directory: request.data.directory,
                workspace_id: request.data.directory,
              },
              message: [],
              response: 'success',
            }
          }
          if (request.cmd === 'reset_flow') {
            return {
              cmd: request.cmd,
              data: {
                directory: request.data.directory,
              },
              message: [],
              response: 'success',
            }
          }
          return {
            cmd: request.cmd,
            data: {},
            message: [],
            response: 'success',
          }
        },
        onEvent: () => unsubscribe,
      },
      dialog: {
        pickDirectory: async (options) => {
          if (options?.title === 'Select Project Save Location') {
            return '/workspace/e2e_chip'
          }
          if (options?.title === 'Select RTL Design Folder') {
            return '/workspace/e2e_chip/rtl'
          }
          if (options?.title === 'Select ECOS Studio Project Directory') {
            return '/workspace/e2e_chip'
          }
          return '/workspace/e2e_chip'
        },
        pickFiles: async () => null,
        pickRtlSources: async () => ({
          directories: [],
          files: ['/external/alu.sv'],
        }),
      },
      layoutViewer: {
        open: async () => ({
          layoutPackagePath: '',
          packageRoot: '',
          spawned: false,
        }),
      },
      menu: {
        onAction: () => unsubscribe,
      },
      remoteContent: {
        fetchJson: async () => null,
      },
      resources: {
        activatePdk: async () => {},
        cancel: async () => {},
        get: async (resourceId) => ({
          available_versions: [],
          category: 'pdk',
          description: 'Reference 55nm process',
          display_name: 'ICS55 PDK',
          installed_version: null,
          name: resourceId.replace(/^pdk:/, ''),
          path: '/pdks/ics55',
          status: 'installed',
          type: 'pdk',
        }),
        importLocalPath: async () => {},
        importPdkPath: async () => {},
        install: async () => {},
        list: async () => ({ resources: [] }),
        onProgress: () => unsubscribe,
        refreshRegistry: async () => {},
        removePdkReference: async () => {},
        uninstall: async () => {},
        update: async () => {},
        validatePdk: async () => {},
      },
      settings: {
        delete: async (key) => {
          delete state.settings[key]
        },
        get: async (key) => state.settings[key] ?? null,
        set: async (key, value) => {
          state.settings[key] = value
        },
      },
      system: {
        openExternal: async () => {},
      },
      window: {
        close: async () => {},
        confirmClose: async () => {},
        isMaximized: async () => false,
        minimize: async () => {},
        onCloseRequested: () => unsubscribe,
        onMaximizedChanged: () => unsubscribe,
        onResized: () => unsubscribe,
        setTitle: async () => {},
        toggleMaximize: async () => {},
      },
      workspace: {
        addDesignFiles: async (paths) => {
          state.addedDesignFiles.push(paths)
          return {
            added: paths.map((path) => ({
              basename: path.split('/').pop() ?? path,
              exists: true,
              filelistEntry: path,
              managedInWorkspace: false,
              resolvedPath: path,
            })),
            skipped: [],
          }
        },
        clearProjectRoot: async () => {},
        isProjectDirectory: async () => true,
        listDesignFiles: async () => [
          {
            basename: 'top.sv',
            exists: true,
            filelistEntry: '/workspace/e2e_chip/src/top.sv',
            managedInWorkspace: false,
            resolvedPath: '/workspace/e2e_chip/src/top.sv',
          },
        ],
        readOptionalProjectTextFile: async () => null,
        readOptionalProjectTextFileTail: async () => null,
        readOptionalProjectTextFileUpdate: async () => null,
        readProjectBinaryFile: async () => new Uint8Array(),
        readProjectTextFile: async () => '',
        readProjectTextFileTail: async () => null,
        registerProjectRoot: async (path) => path,
        removeDesignFile: async (filelistEntry) => {
          state.removedDesignFiles.push(filelistEntry)
          return {
            basename: filelistEntry.split('/').pop() ?? filelistEntry,
            exists: true,
            filelistEntry,
            managedInWorkspace: false,
            resolvedPath: filelistEntry,
          }
        },
        requestProjectPathAccess: async (path) => path,
        scanPdkDirectory: async (path) => ({
          canonicalPath: path,
          description: 'Reference 55nm process',
          detectedFiles: {
            directories: ['libs.ref', 'libs.tech'],
            files: ['README.md'],
          },
          name: 'ICS55 PDK',
          pdkId: 'ics55',
          techNode: '55nm',
        }),
        scanRtlDirectory: async (path) => ({
          files: [`${path}/top.sv`, `${path}/defs.vh`],
          rootPath: path,
        }),
        subscribeProjectLogTail: async () => unsubscribe,
        watchProjectFile: async () => unsubscribe,
        writeProjectTextFile: async () => {},
      },
      workspaceResources: {
        getIndex: async () => ({
          resources: {},
          versions: {
            all: 0,
            flow: 0,
            home: 0,
            logs: 0,
          },
        }),
        readFlow: async () => null,
        readHome: async () => ({
          'GDS merge': '',
          checklist: '',
          flow: '',
          layout: '',
          metrics: {},
          monitor: { step: [] },
          parameters: '',
        }),
        readParameters: async () => null,
      },
    }
  })
}

export async function readEcosE2EState(page: Page): Promise<EcosE2EState> {
  return await page.evaluate(() => window.__ecosE2E)
}
