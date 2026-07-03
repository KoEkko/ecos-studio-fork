import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { LayoutViewerService } from './layoutViewerService'

interface ExecFileResult {
  stdout: string
  stderr: string
}
type TestViewerStdio = 'ignore' | ['ignore', number, number]
type TestSpawnProcess = (
  file: string,
  args: string[],
  options: {
    detached: boolean
    env: NodeJS.ProcessEnv
    stdio: TestViewerStdio
  },
) => { unref(): void }

const CURRENT_SOURCE_METADATA = {
  generator: {
    build_id: 'current-packer-build-id',
    name: 'ecos-layout-packer',
    version: '0.1.0',
  },
  source: {
    fingerprint: 'current-source-fingerprint',
    kind: 'view-json',
  },
}

const REPO_ROOT = '/repo'

function devLayoutViewerPaths() {
  return {
    cargoManifest: join(REPO_ROOT, 'ecos/layout-viewer/Cargo.toml'),
    packer: join(REPO_ROOT, 'ecos/scripts/ecos-layout-packer-wrapper.sh'),
    viewer: join(REPO_ROOT, 'ecos/scripts/layout-viewer-native-wrapper.sh'),
  }
}

function layoutPackageManifest(
  fingerprint = CURRENT_SOURCE_METADATA.source.fingerprint,
  buildId = CURRENT_SOURCE_METADATA.generator.build_id,
) {
  return JSON.stringify({
    generator: {
      ...CURRENT_SOURCE_METADATA.generator,
      build_id: buildId,
    },
    schema: 'ecos.layoutpkg.v1',
    source: {
      fingerprint,
      kind: 'view-json',
    },
    tilesets: {
      detail: 'detail/index.json',
    },
    version: 1,
    world_bbox: [0, 0, 100, 100],
  })
}

function createService(options: {
  appPath?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  execFile?: (file: string, args: string[]) => Promise<ExecFileResult>
  files?: Record<string, string>
  existingPaths?: string[]
  isPackaged?: boolean
  layoutViewerLogDirectory?: string
  now?: () => Date
  appendTextFile?: (path: string, text: string) => void
  closeLogFile?: (fd: number) => void
  makeDirectory?: (path: string) => void
  openLogFile?: (path: string, flags: string) => number
  resourcesPath?: string
  spawnProcess?: TestSpawnProcess
}) {
  const files = new Map(Object.entries(options.files ?? {}))
  const execFile =
    options.execFile ??
    vi.fn(async () => ({
      stderr: '',
      stdout: '',
    }))
  const unref = vi.fn()
  const spawnProcess: TestSpawnProcess =
    options.spawnProcess ?? vi.fn<TestSpawnProcess>(() => ({ unref }))
  const existingPaths = new Set([...(options.existingPaths ?? []), ...files.keys()])
  const service = new LayoutViewerService({
    appPath: options.appPath ?? '/repo/ecos/gui/apps/desktop-electron',
    cwd: options.cwd ?? '/repo/ecos/gui/apps/desktop-electron',
    env: options.env ?? {},
    execFile,
    fileExists: (path) => existingPaths.has(path),
    isPackaged: options.isPackaged ?? false,
    layoutViewerLogDirectory: options.layoutViewerLogDirectory,
    now: options.now,
    appendTextFile: options.appendTextFile,
    closeLogFile: options.closeLogFile,
    makeDirectory: options.makeDirectory,
    openLogFile: options.openLogFile,
    platform: 'linux',
    readTextFile: async (path) => {
      const text = files.get(path)
      if (text === undefined) {
        throw new Error(`file not found: ${path}`)
      }
      return text
    },
    resourcesPath: options.resourcesPath,
    spawnProcess,
  })

  return {
    execFile,
    service,
    spawnProcess,
    unref,
  }
}

describe('LayoutViewerService', () => {
  it('packs a relative view JSON root and launches the dev native viewer', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const devBinaries = devLayoutViewerPaths()
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const { execFile, service, spawnProcess, unref } = createService({
      existingPaths: [devBinaries.cargoManifest, devBinaries.packer, devBinaries.viewer],
    })

    const result = await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: 'output/gcd_route_view',
    })

    expect(execFile).toHaveBeenCalledWith(devBinaries.packer, [
      packageRoot,
      layoutPackagePath,
    ])
    expect(spawnProcess).toHaveBeenCalledWith(
      devBinaries.viewer,
      [layoutPackagePath],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      }),
    )
    expect(unref).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      layoutPackagePath,
      packageRoot,
      spawned: true,
    })
  })

  it('reuses an existing .layoutpkg manifest when the source fingerprint and generator match', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const devBinaries = devLayoutViewerPaths()
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const manifestPath = join(layoutPackagePath, 'manifest.json')
    const execFileRunner = vi.fn(async (file: string, args: string[]) => {
      if (
        file === devBinaries.packer &&
        args.join(' ') === `--fingerprint --json ${packageRoot}`
      ) {
        return {
          stderr: '',
          stdout: JSON.stringify(CURRENT_SOURCE_METADATA),
        }
      }
      return {
        stderr: '',
        stdout: '',
      }
    })
    const { execFile, service, spawnProcess } = createService({
      execFile: execFileRunner,
      files: {
        [manifestPath]: layoutPackageManifest(),
      },
      existingPaths: [devBinaries.cargoManifest, devBinaries.packer, devBinaries.viewer],
    })

    await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
    })

    expect(execFile).toHaveBeenCalledWith(devBinaries.packer, [
      '--fingerprint',
      '--json',
      packageRoot,
    ])
    expect(execFile).not.toHaveBeenCalledWith(devBinaries.packer, [
      packageRoot,
      layoutPackagePath,
    ])
    expect(spawnProcess).toHaveBeenCalledWith(
      devBinaries.viewer,
      [layoutPackagePath],
      expect.any(Object),
    )
  })

  it('rebuilds an existing .layoutpkg when the source fingerprint changes', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const devBinaries = devLayoutViewerPaths()
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const manifestPath = join(layoutPackagePath, 'manifest.json')
    const execFile = vi.fn(async (file: string, args: string[]) => {
      if (
        file === devBinaries.packer &&
        args.join(' ') === `--fingerprint --json ${packageRoot}`
      ) {
        return {
          stderr: '',
          stdout: JSON.stringify(CURRENT_SOURCE_METADATA),
        }
      }
      return {
        stderr: '',
        stdout: '',
      }
    })
    const { service } = createService({
      execFile,
      files: {
        [manifestPath]: layoutPackageManifest('stale-source-fingerprint'),
      },
      existingPaths: [devBinaries.cargoManifest, devBinaries.packer, devBinaries.viewer],
    })

    await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
    })

    expect(execFile).toHaveBeenCalledWith(devBinaries.packer, [
      '--fingerprint',
      '--json',
      packageRoot,
    ])
    expect(execFile).toHaveBeenCalledWith(devBinaries.packer, [
      packageRoot,
      layoutPackagePath,
    ])
  })

  it('rebuilds an existing .layoutpkg when the packer build id changes', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const devBinaries = devLayoutViewerPaths()
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const manifestPath = join(layoutPackagePath, 'manifest.json')
    const execFile = vi.fn(async (file: string, args: string[]) => {
      if (
        file === devBinaries.packer &&
        args.join(' ') === `--fingerprint --json ${packageRoot}`
      ) {
        return {
          stderr: '',
          stdout: JSON.stringify(CURRENT_SOURCE_METADATA),
        }
      }
      return {
        stderr: '',
        stdout: '',
      }
    })
    const { service } = createService({
      execFile,
      files: {
        [manifestPath]: layoutPackageManifest(undefined, 'stale-packer-build-id'),
      },
      existingPaths: [devBinaries.cargoManifest, devBinaries.packer, devBinaries.viewer],
    })

    await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
    })

    expect(execFile).toHaveBeenCalledWith(devBinaries.packer, [
      packageRoot,
      layoutPackagePath,
    ])
  })

  it('throws a build hint when the dev wrappers are missing', async () => {
    const { service } = createService({
      existingPaths: [devLayoutViewerPaths().cargoManifest],
    })

    await expect(
      service.open({
        projectPath: '/project',
        viewJsonPackageRoot: '/project/output/gcd_route_view',
      }),
    ).rejects.toThrow('Layout viewer wrappers were not found')
  })

  it('launches packaged binaries from electron resources', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const resourcesPath = '/opt/ECOS Studio/resources'
    const binaryDir = join(resourcesPath, 'binaries')
    const packer = join(binaryDir, 'ecos-layout-packer')
    const viewer = join(binaryDir, 'layout-viewer-native')
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const { execFile, service, spawnProcess } = createService({
      existingPaths: [packer, viewer],
      isPackaged: true,
      resourcesPath,
    })

    await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
      rebuildPackage: true,
    })

    expect(execFile).toHaveBeenCalledWith(packer, [packageRoot, layoutPackagePath])
    expect(spawnProcess).toHaveBeenCalledWith(
      viewer,
      [layoutPackagePath],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      }),
    )
  })

  it('captures native viewer output in a launch log when a log directory is configured', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const resourcesPath = '/opt/ECOS Studio/resources'
    const binaryDir = join(resourcesPath, 'binaries')
    const packer = join(binaryDir, 'ecos-layout-packer')
    const viewer = join(binaryDir, 'layout-viewer-native')
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const logDirectory = '/tmp/ecos/logs/session/layout-viewer'
    const viewerLogPath = join(logDirectory, 'layout-viewer-20260703-080001-002-1.log')
    const appendTextFile = vi.fn()
    const closeLogFile = vi.fn()
    const makeDirectory = vi.fn()
    const openLogFile = vi.fn(() => 42)
    const { service, spawnProcess } = createService({
      appendTextFile,
      closeLogFile,
      existingPaths: [packer, viewer],
      isPackaged: true,
      layoutViewerLogDirectory: logDirectory,
      makeDirectory,
      now: () => new Date('2026-07-03T08:00:01.002Z'),
      openLogFile,
      resourcesPath,
    })

    const result = await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
      rebuildPackage: true,
    })

    expect(makeDirectory).toHaveBeenCalledWith(logDirectory)
    expect(appendTextFile).toHaveBeenCalledWith(
      viewerLogPath,
      expect.stringContaining(`viewer=${viewer}`),
    )
    expect(appendTextFile).toHaveBeenCalledWith(
      viewerLogPath,
      expect.stringContaining(`layoutPackage=${layoutPackagePath}`),
    )
    expect(openLogFile).toHaveBeenCalledWith(viewerLogPath, 'a')
    expect(spawnProcess).toHaveBeenCalledWith(
      viewer,
      [layoutPackagePath],
      expect.objectContaining({
        detached: true,
        stdio: ['ignore', 42, 42],
      }),
    )
    expect(closeLogFile).toHaveBeenCalledWith(42)
    expect(result).toEqual({
      layoutPackagePath,
      packageRoot,
      spawned: true,
      viewerLogPath,
    })
  })

  it('closes the launch log file when native viewer spawn fails', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const resourcesPath = '/opt/ECOS Studio/resources'
    const binaryDir = join(resourcesPath, 'binaries')
    const packer = join(binaryDir, 'ecos-layout-packer')
    const viewer = join(binaryDir, 'layout-viewer-native')
    const closeLogFile = vi.fn()
    const spawnProcess: TestSpawnProcess = vi.fn(() => {
      throw new Error('spawn failed')
    })
    const { service } = createService({
      appendTextFile: vi.fn(),
      closeLogFile,
      existingPaths: [packer, viewer],
      isPackaged: true,
      layoutViewerLogDirectory: '/tmp/ecos/logs/session/layout-viewer',
      makeDirectory: vi.fn(),
      openLogFile: vi.fn(() => 42),
      resourcesPath,
      spawnProcess,
    })

    await expect(
      service.open({
        projectPath: '/project',
        viewJsonPackageRoot: packageRoot,
        rebuildPackage: true,
      }),
    ).rejects.toThrow('spawn failed')

    expect(closeLogFile).toHaveBeenCalledWith(42)
    expect(spawnProcess).toHaveBeenCalledWith(
      viewer,
      [join(packageRoot, '.layoutpkg')],
      expect.objectContaining({
        stdio: ['ignore', 42, 42],
      }),
    )
  })

  it('falls back to PATH binaries in packaged Nix builds', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const nixBin = '/nix/store/ecos-layout-viewer/bin'
    const packer = join(nixBin, 'ecos-layout-packer')
    const viewer = join(nixBin, 'layout-viewer-native')
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const { execFile, service, spawnProcess } = createService({
      env: {
        PATH: `${nixBin}:/usr/bin`,
      },
      existingPaths: [packer, viewer],
      isPackaged: true,
      resourcesPath: '/nix/store/ecos-studio/share/ecos-studio/resources',
    })

    await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
      rebuildPackage: true,
    })

    expect(execFile).toHaveBeenCalledWith(packer, [packageRoot, layoutPackagePath])
    expect(spawnProcess).toHaveBeenCalledWith(
      viewer,
      [layoutPackagePath],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      }),
    )
  })
})
