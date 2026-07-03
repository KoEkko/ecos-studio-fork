import {
  execFile as execFileCallback,
  spawn as spawnProcessCallback,
} from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  resolveProjectFileAbsolutePath,
  type LayoutViewerOpenRequest,
  type LayoutViewerOpenResult,
} from '@ecos-studio/shared'
import { electronLogger, type ElectronLogger } from './logger'

const BUILD_HINT =
  'Build them with: cd ecos/layout-viewer && cargo build --release -p layout-viewer-native -p ecos-layout-packer'
const LAYOUT_PACKAGE_SCHEMA = 'ecos.layoutpkg.v1'
const LAYOUT_PACKAGE_VERSION = 1
const LAYOUT_PACKER_NAME = 'ecos-layout-packer'

type FileExists = (path: string) => boolean
type MakeDirectory = (path: string) => void
type AppendTextFile = (path: string, text: string) => void
type OpenLogFile = (path: string, flags: string) => number
type CloseLogFile = (fd: number) => void
interface ExecFileResult {
  stdout: string
  stderr: string
}
type ExecFileRunner = (file: string, args: string[]) => Promise<ExecFileResult>
type ReadTextFile = (path: string) => Promise<string>
type ViewerStdio = 'ignore' | ['ignore', number, number]
type SpawnProcess = (
  file: string,
  args: string[],
  options: {
    detached: boolean
    env: NodeJS.ProcessEnv
    stdio: ViewerStdio
  },
) => { unref(): void }

export interface LayoutViewerServiceOptions {
  appPath: string
  cwd: string
  env?: NodeJS.ProcessEnv
  execFile?: ExecFileRunner
  fileExists?: FileExists
  isPackaged: boolean
  layoutViewerLogDirectory?: string
  logger?: ElectronLogger
  makeDirectory?: MakeDirectory
  appendTextFile?: AppendTextFile
  closeLogFile?: CloseLogFile
  now?: () => Date
  openLogFile?: OpenLogFile
  platform?: NodeJS.Platform
  readTextFile?: ReadTextFile
  resourcesPath?: string
  spawnProcess?: SpawnProcess
}

interface LayoutViewerBinaries {
  packerPath: string
  viewerPath: string
}

interface LayoutViewerLaunchLog {
  fd: number
  path: string
  stdio: ['ignore', number, number]
}

interface LayoutPackageSourceMetadata {
  generator: {
    build_id: string
    name: string
    version: string
  }
  source: {
    fingerprint: string
    kind: string
  }
}

interface LayoutPackageCacheManifest extends LayoutPackageSourceMetadata {
  schema: string
  version: number
}

function defaultExecFile(file: string, args: string[]): Promise<ExecFileResult> {
  return new Promise((resolve, reject) => {
    execFileCallback(file, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolve({
        stderr,
        stdout,
      })
    })
  })
}

function defaultMakeDirectory(path: string): void {
  mkdirSync(path, { recursive: true })
}

function defaultAppendTextFile(path: string, text: string): void {
  appendFileSync(path, text, 'utf8')
}

function defaultOpenLogFile(path: string, flags: string): number {
  return openSync(path, flags)
}

async function defaultReadTextFile(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

function executableName(baseName: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? `${baseName}.exe` : baseName
}

function ancestorPaths(startPath: string, maxDepth = 12): string[] {
  const paths: string[] = []
  let current = startPath
  for (let i = 0; i < maxDepth; i += 1) {
    paths.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return paths
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLayoutPackageSourceMetadata(
  value: unknown,
): value is LayoutPackageSourceMetadata {
  if (!isRecord(value) || !isRecord(value.generator) || !isRecord(value.source)) {
    return false
  }

  return (
    value.generator.name === LAYOUT_PACKER_NAME &&
    typeof value.generator.version === 'string' &&
    typeof value.generator.build_id === 'string' &&
    value.source.kind === 'view-json' &&
    typeof value.source.fingerprint === 'string'
  )
}

function isLayoutPackageCacheManifest(
  value: unknown,
): value is LayoutPackageCacheManifest {
  if (!isRecord(value)) {
    return false
  }

  return (
    isLayoutPackageSourceMetadata(value) &&
    value.schema === LAYOUT_PACKAGE_SCHEMA &&
    value.version === LAYOUT_PACKAGE_VERSION
  )
}

function layoutPackageCacheMatches(
  manifest: LayoutPackageCacheManifest,
  currentSource: LayoutPackageSourceMetadata,
): boolean {
  const cachedBuildId =
    typeof manifest.generator.build_id === 'string' ? manifest.generator.build_id : ''

  return (
    manifest.generator.version === currentSource.generator.version &&
    cachedBuildId === currentSource.generator.build_id &&
    manifest.source.fingerprint === currentSource.source.fingerprint
  )
}

function formatLogTimestamp(date: Date, sequence: number): string {
  const [datePart = '', timePart = ''] = date.toISOString().split('T')
  const [time = '', millisWithZone = ''] = timePart.split('.')
  const millis = millisWithZone.replace('Z', '').padEnd(3, '0').slice(0, 3)

  return `${datePart.replace(/-/g, '')}-${time.replace(/:/g, '')}-${millis}-${sequence}`
}

function formatLaunchLogHeader(options: {
  env: NodeJS.ProcessEnv
  layoutPackagePath: string
  packageRoot: string
  timestamp: Date
  viewerPath: string
}): string {
  const envKeys = [
    'APPDIR',
    'APPIMAGE',
    'DISPLAY',
    'WAYLAND_DISPLAY',
    'XDG_SESSION_TYPE',
    'XDG_CURRENT_DESKTOP',
    'WINIT_UNIX_BACKEND',
    'WGPU_BACKEND',
    'LIBGL_ALWAYS_SOFTWARE',
    'MESA_LOADER_DRIVER_OVERRIDE',
    'LD_LIBRARY_PATH',
  ]
  const lines = [
    '# ECOS Layout Viewer Launch',
    `timestamp=${options.timestamp.toISOString()}`,
    `viewer=${options.viewerPath}`,
    `packageRoot=${options.packageRoot}`,
    `layoutPackage=${options.layoutPackagePath}`,
    '',
    '[env]',
    ...envKeys.map((key) => `${key}=${options.env[key] ?? ''}`),
    '',
    '[output]',
  ]

  return `${lines.join('\n')}\n`
}

export class LayoutViewerService {
  private launchLogSequence = 0
  private readonly appPath: string
  private readonly appendTextFile: AppendTextFile
  private readonly closeLogFile: CloseLogFile
  private readonly cwd: string
  private readonly env: NodeJS.ProcessEnv
  private readonly execFile: ExecFileRunner
  private readonly fileExists: FileExists
  private readonly isPackaged: boolean
  private readonly layoutViewerLogDirectory?: string
  private readonly logger: ElectronLogger
  private readonly makeDirectory: MakeDirectory
  private readonly now: () => Date
  private readonly openLogFile: OpenLogFile
  private readonly platform: NodeJS.Platform
  private readonly readTextFile: ReadTextFile
  private readonly resourcesPath?: string
  private readonly spawnProcess: SpawnProcess

  constructor(options: LayoutViewerServiceOptions) {
    this.appPath = options.appPath
    this.appendTextFile = options.appendTextFile ?? defaultAppendTextFile
    this.closeLogFile = options.closeLogFile ?? closeSync
    this.cwd = options.cwd
    this.env = options.env ?? process.env
    this.execFile = options.execFile ?? defaultExecFile
    this.fileExists = options.fileExists ?? existsSync
    this.isPackaged = options.isPackaged
    this.layoutViewerLogDirectory = options.layoutViewerLogDirectory
    this.logger = options.logger ?? electronLogger
    this.makeDirectory = options.makeDirectory ?? defaultMakeDirectory
    this.now = options.now ?? (() => new Date())
    this.openLogFile = options.openLogFile ?? defaultOpenLogFile
    this.platform = options.platform ?? process.platform
    this.readTextFile = options.readTextFile ?? defaultReadTextFile
    this.resourcesPath = options.resourcesPath
    this.spawnProcess = options.spawnProcess ?? spawnProcessCallback
  }

  async open(request: LayoutViewerOpenRequest): Promise<LayoutViewerOpenResult> {
    const packageRoot = resolveProjectFileAbsolutePath(
      request.projectPath,
      request.viewJsonPackageRoot,
    )
    const layoutPackagePath = join(packageRoot, '.layoutpkg')
    const binaries = this.resolveBinaries()

    if (
      await this.shouldRebuildPackage(
        request,
        binaries.packerPath,
        packageRoot,
        layoutPackagePath,
      )
    ) {
      await this.execFile(binaries.packerPath, [packageRoot, layoutPackagePath])
    }

    const launchLog = this.createLaunchLog(
      binaries.viewerPath,
      packageRoot,
      layoutPackagePath,
    )
    let child: ReturnType<SpawnProcess>
    try {
      child = this.spawnProcess(binaries.viewerPath, [layoutPackagePath], {
        detached: true,
        env: this.env,
        stdio: launchLog?.stdio ?? 'ignore',
      })
    } finally {
      if (launchLog) {
        this.closeLaunchLog(launchLog)
      }
    }
    child.unref()

    const result: LayoutViewerOpenResult = {
      layoutPackagePath,
      packageRoot,
      spawned: true,
    }
    if (launchLog) {
      result.viewerLogPath = launchLog.path
    }
    return result
  }

  private createLaunchLog(
    viewerPath: string,
    packageRoot: string,
    layoutPackagePath: string,
  ): LayoutViewerLaunchLog | null {
    if (!this.layoutViewerLogDirectory) {
      return null
    }

    const timestamp = this.now()
    this.launchLogSequence += 1
    const logPath = join(
      this.layoutViewerLogDirectory,
      `layout-viewer-${formatLogTimestamp(timestamp, this.launchLogSequence)}.log`,
    )

    try {
      this.makeDirectory(this.layoutViewerLogDirectory)
      this.appendTextFile(
        logPath,
        formatLaunchLogHeader({
          env: this.env,
          layoutPackagePath,
          packageRoot,
          timestamp,
          viewerPath,
        }),
      )
      const fd = this.openLogFile(logPath, 'a')
      this.logger.info('[layout-viewer] Native viewer log: %s', logPath)
      return {
        fd,
        path: logPath,
        stdio: ['ignore', fd, fd],
      }
    } catch (err) {
      this.logger.warn('[layout-viewer] Failed to create native viewer log: %s', err)
      return null
    }
  }

  private closeLaunchLog(launchLog: LayoutViewerLaunchLog): void {
    try {
      this.closeLogFile(launchLog.fd)
    } catch (err) {
      this.logger.warn('[layout-viewer] Failed to close native viewer log: %s', err)
    }
  }

  private async shouldRebuildPackage(
    request: LayoutViewerOpenRequest,
    packerPath: string,
    packageRoot: string,
    layoutPackagePath: string,
  ): Promise<boolean> {
    if (request.rebuildPackage) {
      return true
    }

    const manifestPath = join(layoutPackagePath, 'manifest.json')
    if (!this.fileExists(manifestPath)) {
      return true
    }

    const cachedManifest = await this.readCachedManifest(manifestPath)
    if (!isLayoutPackageCacheManifest(cachedManifest)) {
      return true
    }

    const currentSource = await this.readCurrentSourceMetadata(packerPath, packageRoot)
    return !layoutPackageCacheMatches(cachedManifest, currentSource)
  }

  private async readCachedManifest(manifestPath: string): Promise<unknown> {
    try {
      return JSON.parse(await this.readTextFile(manifestPath))
    } catch {
      return undefined
    }
  }

  private async readCurrentSourceMetadata(
    packerPath: string,
    packageRoot: string,
  ): Promise<LayoutPackageSourceMetadata> {
    const result = await this.execFile(packerPath, [
      '--fingerprint',
      '--json',
      packageRoot,
    ])
    let parsed: unknown
    try {
      parsed = JSON.parse(result.stdout)
    } catch {
      throw new Error(
        `Failed to parse layout package fingerprint output from ${packerPath}.`,
      )
    }

    if (!isLayoutPackageSourceMetadata(parsed)) {
      throw new Error(
        `Layout package fingerprint output from ${packerPath} is not supported.`,
      )
    }

    return parsed
  }

  private resolveBinaries(): LayoutViewerBinaries {
    if (this.isPackaged) {
      return this.resolvePackagedBinaries() ?? this.resolvePathBinaries()
    }

    return this.resolveDevBinaries()
  }

  private resolvePackagedBinaries(): LayoutViewerBinaries | null {
    const binaryDir = this.resourcesPath ? join(this.resourcesPath, 'binaries') : ''
    const packerPath = join(
      binaryDir,
      executableName('ecos-layout-packer', this.platform),
    )
    const viewerPath = join(
      binaryDir,
      executableName('layout-viewer-native', this.platform),
    )

    if (this.fileExists(packerPath) && this.fileExists(viewerPath)) {
      return { packerPath, viewerPath }
    }

    return null
  }

  private resolvePathBinaries(): LayoutViewerBinaries {
    const packerPath = this.resolveCommandFromPath('ecos-layout-packer')
    const viewerPath = this.resolveCommandFromPath('layout-viewer-native')

    if (packerPath && viewerPath) {
      return { packerPath, viewerPath }
    }

    throw new Error('Layout viewer binaries were not found on PATH.')
  }

  private resolveCommandFromPath(command: string): string | null {
    const pathValue = this.env.PATH ?? ''
    const separator = this.platform === 'win32' ? ';' : ':'

    for (const directory of pathValue.split(separator).filter(Boolean)) {
      const commandPath = join(directory, executableName(command, this.platform))
      if (this.fileExists(commandPath)) {
        return commandPath
      }
    }

    return null
  }

  private resolveDevBinaries(): LayoutViewerBinaries {
    let repoRoot: string
    try {
      repoRoot = this.findRepoRoot()
    } catch {
      return this.resolvePathBinaries()
    }
    const packerWrapperPath = join(repoRoot, 'ecos/scripts/ecos-layout-packer-wrapper.sh')
    const viewerWrapperPath = join(
      repoRoot,
      'ecos/scripts/layout-viewer-native-wrapper.sh',
    )

    if (!this.fileExists(packerWrapperPath) || !this.fileExists(viewerWrapperPath)) {
      throw new Error(
        `Layout viewer wrappers were not found under ${join(repoRoot, 'ecos/scripts')}. ${BUILD_HINT}`,
      )
    }

    return {
      packerPath: packerWrapperPath,
      viewerPath: viewerWrapperPath,
    }
  }

  private findRepoRoot(): string {
    for (const startPath of [this.appPath, this.cwd]) {
      for (const candidate of ancestorPaths(startPath)) {
        if (this.fileExists(join(candidate, 'ecos/layout-viewer/Cargo.toml'))) {
          return candidate
        }
      }
    }

    throw new Error(
      `Unable to locate ecos/layout-viewer from ${this.appPath}. ${BUILD_HINT}`,
    )
  }
}
