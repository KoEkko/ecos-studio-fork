<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xl transition-all p-4 sm:p-6">
    <div
      class="relative w-full max-w-5xl bg-(--bg-primary)/95 backdrop-blur-2xl rounded-[24px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 dark:border-white/5 overflow-hidden flex flex-col h-[85vh] max-h-[850px] ring-1 ring-black/5 dark:ring-white/5">

      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/80 via-(--accent-color)/80 to-purple-500/80"></div>

      <button @click="$emit('close')"
        class="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-(--bg-secondary)/80 hover:bg-(--border-color) text-(--text-secondary) hover:text-(--text-primary) transition-colors duration-200 cursor-pointer">
        <i class="ri-close-line text-lg"></i>
      </button>

      <div class="flex flex-col md:flex-row h-full">
        <div class="w-full md:w-80 bg-(--bg-secondary)/40 border-r border-(--border-color)/40 p-8 md:p-10 flex flex-col shrink-0 relative">
          <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

          <div class="mb-12 relative z-10">
            <h1 class="text-3xl font-bold text-(--text-primary) tracking-tight">New Workspace</h1>
            <p class="text-sm text-(--text-secondary) mt-2">Configure your frontend design flow</p>
          </div>

          <div class="flex flex-col gap-8 relative z-10">
            <template v-for="(step, index) in steps" :key="step.id">
              <div class="relative flex items-start gap-4 group"
                :class="step.id <= highestStep && step.id !== currentStep ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'"
                @click="handleStepClick(step.id)">
                <div v-if="index < steps.length - 1"
                  class="absolute left-5 top-12 bottom-[-32px] w-[2px] -translate-x-1/2 rounded-full transition-colors duration-200"
                  :class="currentStep > step.id ? 'bg-(--accent-color)' : 'bg-(--border-color)/60'">
                </div>

                <div class="relative z-10 flex flex-col items-center shrink-0">
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200 shadow-sm',
                    currentStep > step.id ? 'bg-(--accent-color) text-white ring-4 ring-(--accent-color)/20 border border-transparent' :
                      currentStep === step.id ? 'bg-(--accent-color) text-white ring-4 ring-(--accent-color)/30 border border-transparent' :
                        'bg-(--bg-primary)/80 text-(--text-secondary) border border-(--border-color)'
                  ]">
                    <i v-if="currentStep > step.id" class="ri-check-line text-lg"></i>
                    <span v-else>{{ step.id }}</span>
                  </div>
                </div>

                <div class="flex flex-col pt-2 transition-transform duration-200" :class="currentStep === step.id ? 'translate-x-1' : ''">
                  <span :class="[
                    'text-base font-semibold transition-colors duration-200',
                    currentStep >= step.id ? 'text-(--text-primary)' : 'text-(--text-secondary)'
                  ]">{{ step.title }}</span>
                  <span v-if="currentStep === step.id" class="text-xs text-(--accent-color) mt-1 font-medium tracking-wide uppercase">In Progress</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="flex-1 flex flex-col min-w-0 bg-transparent relative">
          <div class="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
            <Transition name="fade-slide" mode="out-in">
              <div v-if="currentStep === 1" key="step1" class="max-w-2xl mx-auto w-full">
                <div class="mb-10">
                  <h2 class="text-2xl font-bold text-(--text-primary)">Project Basics</h2>
                  <p class="text-(--text-secondary) mt-2">Set up the fundamental details for your new workspace.</p>
                </div>

                <div class="space-y-8">
                  <div class="group">
                    <label class="block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200">
                      Project Name <span class="text-red-500">*</span>
                    </label>
                    <input v-model="config.parameters.design" type="text" placeholder="e.g. cl3_soc"
                      :class="[
                        'w-full px-4 py-3.5 bg-(--bg-secondary)/40 border rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 focus:outline-none focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm',
                        designNameError ? 'border-red-500 focus:border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                      ]" />
                    <p v-if="designNameError" class="mt-2 text-xs text-red-500 flex items-center gap-1">
                      <i class="ri-error-warning-fill"></i> {{ designNameError }}
                    </p>
                    <p v-else class="mt-2 text-xs text-(--text-secondary) flex items-center gap-1">
                      <i class="ri-error-warning-line"></i> Only letters, numbers, and underscores are allowed.
                    </p>
                  </div>

                  <div class="group">
                    <label class="block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200">
                      Project Description
                    </label>
                    <textarea v-model="config.parameters.description" rows="3" placeholder="Briefly describe this frontend flow..."
                      class="w-full px-4 py-3.5 bg-(--bg-secondary)/40 border border-(--border-color) rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 focus:outline-none focus:border-(--accent-color) focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm resize-none"></textarea>
                  </div>

                  <div class="group">
                    <label class="block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200">
                      Save Location <span class="text-red-500">*</span>
                    </label>
                    <div class="flex gap-3">
                      <div class="relative flex-1">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <i class="ri-folder-line text-(--text-secondary)"></i>
                        </div>
                        <input v-model="config.directory" type="text" readonly placeholder="Choose a folder..."
                          @click="selectLocation"
                          :class="[
                            'w-full pl-10 pr-4 py-3.5 bg-(--bg-secondary)/40 border rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 cursor-pointer focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm truncate',
                            directoryError ? 'border-red-500 focus:border-red-500' : 'border-(--border-color) focus:border-(--accent-color)'
                          ]" />
                      </div>
                      <button @click="selectLocation"
                        class="px-6 py-3.5 bg-(--bg-primary)/50 border border-(--border-color) text-(--text-primary) rounded-xl hover:bg-(--bg-secondary) hover:border-(--text-secondary) transition-colors duration-200 font-medium cursor-pointer shadow-sm flex items-center gap-2 shrink-0">
                        Browse
                      </button>
                    </div>
                    <p v-if="directoryError" class="mt-2 text-xs text-red-500 flex items-center gap-1">
                      <i class="ri-error-warning-fill"></i> {{ directoryError }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-else-if="currentStep === 2" key="step2" class="max-w-2xl mx-auto w-full">
                <div class="mb-10">
                  <h2 class="text-2xl font-bold text-(--text-primary)">Design Inputs</h2>
                  <p class="text-(--text-secondary) mt-2">Choose the RTL manifests and entry points used by the frontend flow.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div class="group">
                    <label class="block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200">
                      Top Module Name <span class="text-red-500">*</span>
                    </label>
                    <input v-model="config.parameters.top_module" type="text" placeholder="e.g. ysyxSoCTop"
                      class="w-full px-4 py-3 bg-(--bg-secondary)/40 border border-(--border-color) rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 focus:outline-none focus:border-(--accent-color) focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm" />
                  </div>
                  <div class="group">
                    <label class="block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200">
                      Clock Signal Name <span class="text-red-500">*</span>
                    </label>
                    <input v-model="config.parameters.clock" type="text" placeholder="e.g. clk"
                      class="w-full px-4 py-3 bg-(--bg-secondary)/40 border border-(--border-color) rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 focus:outline-none focus:border-(--accent-color) focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm" />
                  </div>
                </div>

                <div class="space-y-5">
                  <PathPicker
                    label="CPU Filelist"
                    required
                    icon="ri-file-list-3-line"
                    :model-value="config.parameters.cpu_filelist"
                    @browse="selectFile('cpu_filelist', 'Select CPU Filelist')"
                  />
                  <PathPicker
                    label="SoC Filelist"
                    required
                    icon="ri-file-list-3-line"
                    :model-value="config.parameters.soc_filelist"
                    @browse="selectFile('soc_filelist', 'Select SoC Filelist')"
                  />
                </div>

                <div class="mt-8">
                  <div @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false"
                    @drop.prevent="handleFileDrop" :class="[
                      'relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors duration-200 cursor-pointer group',
                      isDragging
                        ? 'border-(--accent-color) bg-(--accent-color)/5'
                        : 'border-(--border-color) hover:border-(--accent-color)/50 hover:bg-(--bg-secondary)/40'
                    ]" @click="selectRtlFiles">
                    <div class="flex flex-col items-center">
                      <div
                        class="w-16 h-16 rounded-2xl bg-(--bg-secondary)/50 border border-(--border-color) flex items-center justify-center mb-4 shadow-sm transition-colors duration-200"
                        :class="{ 'border-(--accent-color) text-(--accent-color)': isDragging }">
                        <i class="ri-upload-cloud-2-line text-3xl" :class="isDragging ? 'text-(--accent-color)' : 'text-(--text-secondary) group-hover:text-(--accent-color)'"></i>
                      </div>
                      <h3 class="text-base font-bold text-(--text-primary) mb-2">Add optional RTL files</h3>
                      <p class="text-sm text-(--text-secondary) mb-5 max-w-sm">Supports Verilog and SystemVerilog source files</p>
                      <button type="button"
                        class="px-6 py-2.5 bg-(--accent-color) text-white rounded-xl hover:opacity-90 shadow-sm transition-opacity duration-200 font-medium cursor-pointer">
                        Browse Files
                      </button>
                    </div>
                  </div>

                  <div v-if="config.rtl_list.length > 0" class="mt-6 space-y-2">
                    <div v-for="file in config.rtl_list" :key="file"
                      class="flex items-center justify-between px-4 py-3 bg-(--bg-secondary)/30 rounded-xl border border-(--border-color) group hover:bg-(--bg-secondary)/60 transition-colors duration-200 shadow-sm">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-lg bg-(--bg-primary)/80 flex items-center justify-center border border-(--border-color)/50 shadow-sm">
                          <i class="ri-file-code-line text-lg text-(--text-secondary)"></i>
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-(--text-primary) truncate text-sm" :title="file">{{ basename(file) }}</p>
                          <p class="text-xs text-(--text-secondary) truncate opacity-70">{{ file }}</p>
                        </div>
                      </div>
                      <button @click.stop="removeRtlFile(file)"
                        class="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer text-(--text-secondary) hover:text-red-500 shrink-0">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="currentStep === 3" key="step3" class="max-w-2xl mx-auto w-full">
                <div class="mb-10">
                  <h2 class="text-2xl font-bold text-(--text-primary)">Simulation Setup</h2>
                  <p class="text-(--text-secondary) mt-2">Configure the Verilator simulation inputs used by the sim step.</p>
                </div>

                <div class="space-y-5">
                  <PathPicker
                    label="Testbench"
                    icon="ri-terminal-box-line"
                    :model-value="config.parameters.testbench"
                    @browse="selectFile('testbench', 'Select Testbench Source')"
                  />

                  <div>
                    <div class="flex items-center justify-between mb-3">
                      <label class="block text-sm font-semibold text-(--text-primary)">
                        C/C++ Sources
                      </label>
                      <button @click="selectCppSources"
                        class="text-xs font-medium text-(--accent-color) hover:text-(--accent-color)/80 transition-colors duration-200 flex items-center gap-1 cursor-pointer">
                        <i class="ri-add-line"></i> Add Sources
                      </button>
                    </div>
                    <div v-if="config.parameters.sim_cpp_sources.length === 0"
                      class="flex items-center justify-center py-8 px-4 border-2 border-dashed border-(--border-color) rounded-2xl bg-(--bg-secondary)/20 text-(--text-secondary)">
                      <div class="text-center">
                        <i class="ri-file-code-line text-3xl opacity-40"></i>
                        <p class="text-sm mt-2">No C/C++ sources selected</p>
                      </div>
                    </div>
                    <div v-else class="space-y-2">
                      <div v-for="file in config.parameters.sim_cpp_sources" :key="file"
                        class="flex items-center justify-between px-4 py-3 bg-(--bg-secondary)/30 rounded-xl border border-(--border-color) group hover:bg-(--bg-secondary)/60 transition-colors duration-200 shadow-sm">
                        <div class="flex items-center gap-3 min-w-0">
                          <i class="ri-file-code-line text-(--text-secondary)"></i>
                          <span class="text-sm text-(--text-primary) truncate" :title="file">{{ file }}</span>
                        </div>
                        <button @click.stop="removeCppSource(file)"
                          class="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer text-(--text-secondary) hover:text-red-500 shrink-0">
                          <i class="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <TextListField label="Compile Flags" v-model="simCflagsText" placeholder="-I/path/to/SoC" />
                    <TextListField label="Link Flags" v-model="simLdflagsText" placeholder="-ldl" />
                  </div>

                  <TextListField label="Run Arguments" v-model="simRunArgsText" placeholder="--max-cycles&#10;10000000" />

                  <div class="p-6 rounded-2xl bg-(--bg-secondary)/20 border border-(--border-color) space-y-5">
                    <div class="flex items-center justify-between gap-4">
                      <div>
                        <h3 class="text-sm font-bold text-(--text-primary) flex items-center gap-2">
                          <i class="ri-play-list-2-line text-(--accent-color)"></i>
                          Simulation Cases
                        </h3>
                        <p class="text-xs text-(--text-secondary) mt-1">Program settings can be completed later in Configure.</p>
                      </div>
                      <label class="flex items-center gap-2 text-sm text-(--text-primary) cursor-pointer shrink-0">
                        <input v-model="config.parameters.sim_build_all_programs" type="checkbox"
                          class="w-4 h-4" />
                        Build all
                      </label>
                    </div>

                    <TextListField label="Program Names" v-model="simProgramNamesText" placeholder="rtthread" />

                    <PathPicker
                      label="Programs Directory"
                      icon="ri-folder-code-line"
                      :model-value="config.parameters.sim_programs_dir"
                      @browse="selectDirectory('sim_programs_dir', 'Select Programs Directory')"
                    />

                    <PathPicker
                      label="Tests Output Directory"
                      icon="ri-folder-upload-line"
                      :model-value="config.parameters.sim_tests_out_dir"
                      @browse="selectDirectory('sim_tests_out_dir', 'Select Tests Output Directory')"
                    />
                  </div>
                </div>
              </div>

              <div v-else-if="currentStep === 4" key="step4" class="max-w-2xl mx-auto w-full">
                <div class="mb-10 text-center">
                  <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 border border-green-500/20 shadow-sm">
                    <i class="ri-check-double-line text-3xl text-green-500"></i>
                  </div>
                  <h2 class="text-2xl font-bold text-(--text-primary)">Review & Create</h2>
                  <p class="text-(--text-secondary) mt-2">Review your configuration before finalizing.</p>
                </div>

                <div class="space-y-5">
                  <ReviewSection title="Project details" icon="ri-folder-info-line" @edit="jumpToStep(1)">
                    <ReviewItem label="Project Name" :value="config.parameters.design || '-'" />
                    <ReviewItem label="Top Module" :value="config.parameters.top_module || '-'" monospace />
                    <ReviewItem label="Save Location" :value="config.directory || '-'" monospace wide />
                  </ReviewSection>

                  <ReviewSection title="Design inputs" icon="ri-file-list-3-line" @edit="jumpToStep(2)">
                    <ReviewItem label="CPU Filelist" :value="config.parameters.cpu_filelist || '-'" monospace wide />
                    <ReviewItem label="SoC Filelist" :value="config.parameters.soc_filelist || '-'" monospace wide />
                    <ReviewItem label="Optional RTL Files" :value="String(config.rtl_list.length)" />
                    <ReviewItem label="Clock" :value="config.parameters.clock || '-'" monospace />
                  </ReviewSection>

                  <ReviewSection title="Simulation" icon="ri-terminal-box-line" @edit="jumpToStep(3)">
                    <ReviewItem label="Testbench" :value="config.parameters.testbench || '-'" monospace wide />
                    <ReviewItem label="C/C++ Sources" :value="String(config.parameters.sim_cpp_sources.length)" />
                    <ReviewItem label="Run Arguments" :value="String(config.parameters.sim_run_args.length)" />
                    <ReviewItem label="Programs" :value="config.parameters.sim_program_names.length ? config.parameters.sim_program_names.join(', ') : '-'" />
                  </ReviewSection>
                </div>
              </div>
            </Transition>
          </div>

          <div class="px-8 md:px-12 py-6 border-t border-(--border-color)/60 bg-(--bg-primary)/80 backdrop-blur-md flex items-center justify-between shrink-0 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-10">
            <button v-if="currentStep > 1" @click="prevStep"
              class="px-6 py-3 text-(--text-primary) bg-(--bg-secondary)/40 border border-(--border-color) hover:bg-(--bg-secondary)/80 rounded-xl transition-colors duration-200 font-semibold cursor-pointer flex items-center gap-2 shadow-sm">
              <i class="ri-arrow-left-line"></i>
              Back
            </button>
            <div v-else></div>

            <div class="flex items-center gap-4">
              <button @click="$emit('close')"
                class="px-6 py-3 text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary)/50 rounded-xl transition-colors duration-200 font-semibold cursor-pointer">
                Cancel
              </button>

              <button v-if="highestStep === 4 && currentStep < 4" @click="returnToReview" :disabled="!canProceed"
                class="px-6 py-3 bg-(--bg-secondary)/50 text-(--text-primary) border border-(--border-color) rounded-xl hover:bg-(--bg-secondary) hover:border-(--text-secondary) shadow-sm hover:shadow-md transition-all duration-200 font-semibold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <i class="ri-check-double-line"></i>
                Save & Return
              </button>

              <button v-if="currentStep < 4" @click="nextStep" :disabled="!canProceed"
                class="px-8 py-3 bg-(--accent-color) text-white rounded-xl hover:bg-(--accent-color)/90 shadow-sm hover:shadow-md transition-all duration-200 font-semibold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm">
                Continue
                <i class="ri-arrow-right-line"></i>
              </button>

              <button v-else @click="createProject" :disabled="isCreating"
                class="px-8 py-3 bg-(--accent-color) text-white rounded-xl hover:opacity-90 shadow-md hover:shadow-lg transition-all duration-200 font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <i v-if="isCreating" class="ri-loader-4-line animate-spin"></i>
                <i v-else class="ri-rocket-line"></i>
                {{ isCreating ? 'Creating Workspace...' : 'Create Workspace' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import type { WorkspaceConfig } from '../types'

interface FrontendParameters extends Record<string, unknown> {
  design: string
  description: string
  top_module: string
  clock: string
  frequency_max: number
  cpu_filelist: string
  soc_filelist: string
  testbench: string
  sim_cpp_sources: string[]
  sim_cflags: string[]
  sim_ldflags: string[]
  sim_run_args: string[]
  sim_program_names: string[]
  sim_programs_dir: string
  sim_tests_out_dir: string
  sim_build_all_programs: boolean
}

interface FrontendWorkspaceConfig extends WorkspaceConfig {
  designTool: 'frontend'
  parameters: FrontendParameters
}

interface Emits {
  (e: 'close'): void
  (e: 'create', config: WorkspaceConfig): void
}

const emit = defineEmits<Emits>()

const currentStep = ref(1)
const highestStep = ref(1)
const isDragging = ref(false)
const isCreating = ref(false)

const steps = [
  { id: 1, title: 'Basic Info' },
  { id: 2, title: 'Design Inputs' },
  { id: 3, title: 'Simulation Setup' },
  { id: 4, title: 'Review & Create' },
]

const config = ref<FrontendWorkspaceConfig>({
  directory: '',
  designTool: 'frontend',
  pdk: '',
  pdk_root: '',
  parameters: {
    design: '',
    description: '',
    top_module: 'ysyxSoCTop',
    clock: 'clk',
    frequency_max: 100,
    cpu_filelist: '',
    soc_filelist: '',
    testbench: '',
    sim_cpp_sources: [],
    sim_cflags: [],
    sim_ldflags: ['-ldl'],
    sim_run_args: ['--max-cycles', '10000000'],
    sim_program_names: ['rtthread'],
    sim_programs_dir: '',
    sim_tests_out_dir: '',
    sim_build_all_programs: false,
  },
  origin_def: '',
  origin_verilog: '',
  rtl_list: [],
})

const CHINESE_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/
const HAS_SPACE_RE = /\s/

const designNameError = computed(() => {
  const name = config.value.parameters.design || ''
  if (!name) return ''
  if (HAS_SPACE_RE.test(name)) return 'Project name cannot contain spaces'
  if (CHINESE_CHAR_RE.test(name)) return 'Project name cannot contain Chinese characters'
  return ''
})

const directoryError = computed(() => {
  const dir = config.value.directory
  if (!dir) return ''
  if (HAS_SPACE_RE.test(dir)) return 'Save path cannot contain spaces'
  if (CHINESE_CHAR_RE.test(dir)) return 'Save path cannot contain Chinese characters'
  return ''
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return config.value.directory.trim() !== ''
        && config.value.parameters.design.trim() !== ''
        && !designNameError.value
        && !directoryError.value
    case 2:
      return config.value.parameters.top_module.trim() !== ''
        && config.value.parameters.clock.trim() !== ''
        && config.value.parameters.cpu_filelist.trim() !== ''
        && config.value.parameters.soc_filelist.trim() !== ''
    default:
      return true
  }
})

const simCflagsText = computed({
  get: () => config.value.parameters.sim_cflags.join('\n'),
  set: (value: string) => { config.value.parameters.sim_cflags = splitLines(value) },
})

const simLdflagsText = computed({
  get: () => config.value.parameters.sim_ldflags.join('\n'),
  set: (value: string) => { config.value.parameters.sim_ldflags = splitLines(value) },
})

const simRunArgsText = computed({
  get: () => config.value.parameters.sim_run_args.join('\n'),
  set: (value: string) => { config.value.parameters.sim_run_args = splitLines(value) },
})

const simProgramNamesText = computed({
  get: () => config.value.parameters.sim_program_names.join('\n'),
  set: (value: string) => { config.value.parameters.sim_program_names = splitList(value) },
})

const selectLocation = async () => {
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Select Project Save Location',
  })
  if (result) {
    config.value.directory = result as string
  }
}

const selectFile = async (field: keyof FrontendParameters, title: string) => {
  const result = await open({
    multiple: false,
    title,
  })
  if (result) {
    config.value.parameters[field] = result as never
  }
}

const selectDirectory = async (field: keyof FrontendParameters, title: string) => {
  const result = await open({
    directory: true,
    multiple: false,
    title,
  })
  if (result) {
    config.value.parameters[field] = result as never
  }
}

const selectRtlFiles = async () => {
  const result = await open({
    multiple: true,
    filters: [{
      name: 'HDL Files',
      extensions: ['v', 'sv', 'vh', 'svh'],
    }],
    title: 'Select RTL Files',
  })
  if (result) {
    const files = Array.isArray(result) ? result : [result]
    addRtlFiles(files as string[])
  }
}

const selectCppSources = async () => {
  const result = await open({
    multiple: true,
    filters: [{
      name: 'C/C++ Sources',
      extensions: ['c', 'cc', 'cpp', 'cxx', 'h', 'hpp'],
    }],
    title: 'Select C/C++ Sources',
  })
  if (result) {
    const files = Array.isArray(result) ? result : [result]
    addCppSources(files as string[])
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (!files) return
  addRtlFiles(Array.from(files).map((f) => f.name))
}

function addRtlFiles(paths: string[]) {
  const existing = new Set(config.value.rtl_list)
  for (const path of paths) {
    if (!existing.has(path)) {
      config.value.rtl_list.push(path)
      existing.add(path)
    }
  }
}

function removeRtlFile(path: string) {
  config.value.rtl_list = config.value.rtl_list.filter((f) => f !== path)
}

function addCppSources(paths: string[]) {
  const existing = new Set(config.value.parameters.sim_cpp_sources)
  for (const path of paths) {
    if (!existing.has(path)) {
      config.value.parameters.sim_cpp_sources.push(path)
      existing.add(path)
    }
  }
}

function removeCppSource(path: string) {
  config.value.parameters.sim_cpp_sources = config.value.parameters.sim_cpp_sources.filter((f) => f !== path)
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function basename(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path
}

const nextStep = () => {
  if (currentStep.value < 4 && canProceed.value) {
    currentStep.value++
    highestStep.value = Math.max(highestStep.value, currentStep.value)
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const jumpToStep = (step: number) => {
  highestStep.value = Math.max(highestStep.value, currentStep.value)
  currentStep.value = step
}

const handleStepClick = (targetStep: number) => {
  if (targetStep === currentStep.value) return
  if (targetStep < currentStep.value) {
    jumpToStep(targetStep)
  } else if (targetStep <= highestStep.value && canProceed.value) {
    jumpToStep(targetStep)
  }
}

const returnToReview = () => {
  if (canProceed.value) {
    jumpToStep(4)
  }
}

const createProject = async () => {
  isCreating.value = true
  try {
    const parameters = {
      ...config.value.parameters,
      sim_cpp_sources: [...config.value.parameters.sim_cpp_sources],
      sim_cflags: [...config.value.parameters.sim_cflags],
      sim_ldflags: [...config.value.parameters.sim_ldflags],
      sim_run_args: [...config.value.parameters.sim_run_args],
      sim_program_names: [...config.value.parameters.sim_program_names],
    }
    emit('create', {
      ...config.value,
      designTool: 'frontend',
      parameters,
      rtl_list: [...config.value.rtl_list],
    })
  } finally {
    isCreating.value = false
  }
}

const PathPicker = defineComponent({
  props: {
    label: { type: String, required: true },
    modelValue: { type: String, default: '' },
    icon: { type: String, default: 'ri-file-line' },
    required: { type: Boolean, default: false },
  },
  emits: ['browse'],
  setup(props, { emit }) {
    return () => h('div', { class: 'group' }, [
      h('label', { class: 'block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200' }, [
        props.label,
        props.required ? h('span', { class: 'text-red-500' }, ' *') : null,
      ]),
      h('div', { class: 'flex gap-3' }, [
        h('div', { class: 'relative flex-1 min-w-0' }, [
          h('div', { class: 'absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none' }, [
            h('i', { class: `${props.icon} text-(--text-secondary)` }),
          ]),
          h('input', {
            value: props.modelValue,
            readonly: true,
            placeholder: 'Choose a file or folder...',
            class: 'w-full pl-10 pr-4 py-3 bg-(--bg-secondary)/40 border border-(--border-color) rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 cursor-pointer focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm truncate',
            onClick: () => emit('browse'),
          }),
        ]),
        h('button', {
          class: 'px-5 py-3 bg-(--bg-primary)/50 border border-(--border-color) text-(--text-primary) rounded-xl hover:bg-(--bg-secondary) hover:border-(--text-secondary) transition-colors duration-200 font-medium cursor-pointer shadow-sm shrink-0',
          onClick: () => emit('browse'),
        }, 'Browse'),
      ]),
    ])
  },
})

const TextListField = defineComponent({
  props: {
    label: { type: String, required: true },
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: 'group' }, [
      h('label', { class: 'block text-sm font-semibold text-(--text-primary) mb-2 group-focus-within:text-(--accent-color) transition-colors duration-200' }, props.label),
      h('textarea', {
        value: props.modelValue,
        rows: 4,
        placeholder: props.placeholder,
        class: 'w-full px-4 py-3 bg-(--bg-secondary)/40 border border-(--border-color) rounded-xl text-(--text-primary) placeholder:text-(--text-secondary)/50 focus:outline-none focus:border-(--accent-color) focus:bg-(--bg-primary)/80 transition-colors duration-200 shadow-sm resize-none font-mono text-sm',
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      }),
    ])
  },
})

const ReviewSection = defineComponent({
  props: {
    title: { type: String, required: true },
    icon: { type: String, default: 'ri-information-line' },
  },
  emits: ['edit'],
  setup(props, { slots, emit }) {
    return () => h('div', { class: 'bg-(--bg-secondary)/20 rounded-2xl border border-(--border-color) overflow-hidden backdrop-blur-sm' }, [
      h('div', { class: 'px-6 py-4 border-b border-(--border-color)/60 flex items-center justify-between bg-(--bg-secondary)/40' }, [
        h('h3', { class: 'font-bold text-(--text-primary) flex items-center gap-2' }, [
          h('i', { class: `${props.icon} text-(--accent-color)` }),
          props.title,
        ]),
        h('button', {
          class: 'text-sm font-medium text-(--accent-color) hover:text-(--accent-color)/80 transition-colors duration-200 px-3 py-1 rounded-md hover:bg-(--accent-color)/10 cursor-pointer',
          onClick: () => emit('edit'),
        }, 'Edit'),
      ]),
      h('div', { class: 'p-6 grid grid-cols-2 gap-y-6 gap-x-8' }, slots.default?.()),
    ])
  },
})

const ReviewItem = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '-' },
    monospace: { type: Boolean, default: false },
    wide: { type: Boolean, default: false },
  },
  setup(props) {
    return () => h('div', { class: props.wide ? 'col-span-2 min-w-0' : 'min-w-0' }, [
      h('span', { class: 'text-[11px] font-semibold text-(--text-secondary) uppercase tracking-wider' }, props.label),
      h('p', {
        class: [
          'font-medium text-(--text-primary) mt-1.5 truncate',
          props.monospace ? 'font-mono text-sm bg-(--bg-primary)/60 p-2.5 rounded-lg border border-(--border-color)/50' : '',
        ],
        title: props.value,
      }, props.value),
    ])
  },
})
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>
