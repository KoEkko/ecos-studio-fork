import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'

const testState = vi.hoisted(() => ({
  currentProject: {
    value: { path: '/workspace/demo' } as { path: string } | null,
  },
  sseMessages: null as Ref<unknown[]> | null,
  stepRefreshCounter: null as Ref<number> | null,
  fetchSharedHomeData: vi.fn(),
  readProjectTextFile: vi.fn(),
  writeProjectTextFile: vi.fn(),
  resolveProjectPathAccess: vi.fn(async (path: string) => path),
}))

vi.mock('./useWorkspace', () => ({
  useWorkspace: () => ({
    currentProject: testState.currentProject,
    sseMessages: testState.sseMessages,
    stepRefreshCounter: testState.stepRefreshCounter,
  }),
}))

vi.mock('./useTauri', () => ({
  useTauri: () => ({
    isInTauri: true,
  }),
}))

vi.mock('./useHomeData', () => ({
  fetchSharedHomeData: testState.fetchSharedHomeData,
  convertRemoteToLocalPath: (path: string) => path,
}))

vi.mock('@/utils/projectFiles', () => ({
  readProjectTextFile: testState.readProjectTextFile,
  writeProjectTextFile: testState.writeProjectTextFile,
}))

vi.mock('@/utils/projectFs', () => ({
  resolveProjectPathAccess: testState.resolveProjectPathAccess,
}))

import { useParameters } from './useParameters'

describe('useParameters desktop bridge integration', () => {
  beforeEach(() => {
    testState.currentProject.value = { path: '/workspace/demo' }
    testState.sseMessages = ref([])
    testState.stepRefreshCounter = ref(0)
    testState.fetchSharedHomeData.mockReset()
    testState.readProjectTextFile.mockReset()
    testState.writeProjectTextFile.mockReset()
    testState.resolveProjectPathAccess.mockClear()
  })

  it('loads and saves parameters through the bridge-backed file helpers', async () => {
    testState.fetchSharedHomeData.mockResolvedValue({
      parameters: '/workspace/demo/home/parameters.json',
    })
    testState.readProjectTextFile.mockResolvedValue(JSON.stringify({
      PDK: 'ics55',
      Design: 'demo',
      'Top module': 'chip_top',
      Die: { Size: [100, 100], Area: 10000 },
      Core: {
        Size: [80, 80],
        Area: 6400,
        'Bounding box': '(0,0) (80,80)',
        Utilitization: 0.5,
        Margin: [4, 4],
        'Aspect ratio': 1,
      },
      'Max fanout': 20,
      'Target density': 0.3,
      'Target overflow': 0.1,
      'Global right padding': 0,
      'Cell padding x': 600,
      'Routability opt flag': 1,
      Clock: 'clk',
      'Frequency max [MHz]': 100,
      'Bottom layer': 'MET2',
      'Top layer': 'MET5',
      'PDK Root': '/pdks/ics55',
    }))

    const parameters = useParameters()

    await vi.waitFor(() => {
      expect(testState.readProjectTextFile).toHaveBeenCalledWith('/workspace/demo/home/parameters.json')
    })

    expect(parameters.config.design).toBe('demo')
    expect(parameters.config.topModule).toBe('chip_top')

    parameters.config.design = 'updated_demo'

    await expect(parameters.saveParameters()).resolves.toBe(true)

    expect(testState.resolveProjectPathAccess).toHaveBeenCalledWith('/workspace/demo/home/parameters.json')
    expect(testState.writeProjectTextFile).toHaveBeenCalledWith(
      '/workspace/demo/home/parameters.json',
      expect.stringContaining('"Design": "updated_demo"'),
    )
  })
})
