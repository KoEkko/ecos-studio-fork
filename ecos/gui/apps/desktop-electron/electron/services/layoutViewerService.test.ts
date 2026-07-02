import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { LayoutViewerService } from './layoutViewerService'

interface ExecFileResult {
  stdout: string
  stderr: string
}

interface SpawnOptions {
  detached: boolean
  env: NodeJS.ProcessEnv
  stdio: 'ignore'
}

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
  resourcesPath?: string
}) {
  const files = new Map(Object.entries(options.files ?? {}))
  const execFile =
    options.execFile ??
    vi.fn(async () => ({
      stderr: '',
      stdout: '',
    }))
  const unref = vi.fn()
  const spawnProcess = vi.fn(
    (_file: string, _args: string[], _options: SpawnOptions) => ({ unref }),
  )
  const existingPaths = new Set([...(options.existingPaths ?? []), ...files.keys()])
  const service = new LayoutViewerService({
    appPath: options.appPath ?? '/repo/ecos/gui/apps/desktop-electron',
    cwd: options.cwd ?? '/repo/ecos/gui/apps/desktop-electron',
    env: options.env ?? {},
    execFile,
    fileExists: (path) => existingPaths.has(path),
    isPackaged: options.isPackaged ?? false,
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

  it('launches packaged native viewer with an isolated software-rendering environment', async () => {
    const packageRoot = '/project/output/gcd_route_view'
    const resourcesPath = '/tmp/.mount_ECOS/resources'
    const appDir = '/tmp/.mount_ECOS'
    const binaryDir = join(resourcesPath, 'binaries')
    const packer = join(binaryDir, 'ecos-layout-packer')
    const viewer = join(binaryDir, 'layout-viewer-native')
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const { service, spawnProcess } = createService({
      env: {
        APPDIR: appDir,
        APPIMAGE: '/home/ecos/ECOS-Studio.AppImage',
        ARGV0: './ECOS-Studio.AppImage',
        ELECTRON_RUN_AS_NODE: '1',
        GIO_EXTRA_MODULES: '/usr/lib/x86_64-linux-gnu/gio/modules',
        LD_LIBRARY_PATH: `${appDir}/usr/lib:/usr/local/lib`,
        OWD: '/home/ecos',
        PATH: '/usr/bin',
      },
      existingPaths: [packer, viewer],
      isPackaged: true,
      resourcesPath,
    })

    await service.open({
      projectPath: '/project',
      viewJsonPackageRoot: packageRoot,
      rebuildPackage: true,
    })

    expect(spawnProcess).toHaveBeenCalledWith(
      viewer,
      [layoutPackagePath],
      expect.objectContaining({
        env: expect.objectContaining({
          GIO_EXTRA_MODULES: '',
          LD_LIBRARY_PATH: '/usr/local/lib',
          LIBGL_ALWAYS_SOFTWARE: '1',
          PATH: '/usr/bin',
        }),
      }),
    )
    const viewerSpawnCall = spawnProcess.mock.calls[0]
    if (!viewerSpawnCall) {
      throw new Error('layout viewer was not spawned')
    }
    const viewerEnv = viewerSpawnCall[2].env
    expect(viewerEnv.APPDIR).toBeUndefined()
    expect(viewerEnv.APPIMAGE).toBeUndefined()
    expect(viewerEnv.ARGV0).toBeUndefined()
    expect(viewerEnv.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(viewerEnv.OWD).toBeUndefined()
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
