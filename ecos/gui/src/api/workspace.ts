/**
 * Project API module for ECOS Studio workspaces.
 */

import { alovaInstance } from './client'
import { CMDEnum } from './type'
import type { DesignTool } from '../types'

function workspaceApiBase(designTool?: DesignTool): string {
  return designTool === 'frontend' ? '/api/frontend/workspace' : '/api/workspace'
}

// Types for API requests and responses
export interface ProjectInfo {
  name: string
  path: string
  flow?: Record<string, unknown>
}

export interface WorkspaceResponse {
  cmd: CMDEnum;
  response: string;
  data: {
    directory: string;
    workspace_id?: string;  // 前端用于订阅 SSE
  };
  message: string[];
}

export interface LoadWorkspaceRequest {
  cmd: CMDEnum.load_workspace;
  data: {
    directory: string;
  }
}

export interface SetPdkRootResponse {
  cmd: CMDEnum;
  response: string;
  data: {
    pdk: string;
    pdk_root: string;
    env_key: string;
  };
  message: string[];
}

export interface CreateWorkspaceRequest {
  cmd: CMDEnum.create_workspace;
  data: {
    pdk: string,
    pdk_root: string,
    directory: string,
    parameters: Record<string, unknown>,
    origin_def: string,
    origin_verilog: string,
    filelist: string,
    rtl_list: string[],
    cpu_filelist?: string,
    soc_filelist?: string,
    testbench?: string,
    sim_cpp_sources?: string[],
    sim_cflags?: string[],
    sim_ldflags?: string[],
    sim_run_args?: string[],
    sim_images?: string[],
    sim_all_tests?: boolean,
    sim_tests_dir?: string,
    sim_build_all_programs?: boolean,
    sim_program_names?: string[],
    sim_program_sources?: string[],
    sim_programs_dir?: string,
    sim_tests_out_dir?: string,
    sim_soc_root?: string,
    sim_build_test_script?: string,
  }
}

export interface SetPdkRootRequest {
  cmd: CMDEnum.set_pdk_root;
  data: {
    pdk: string;
    pdk_root: string;
  }
}

/**
 * Open an existing project
 * @param path - Full path to the project directory
 */
export function loadWorkspaceApi(directory: string, designTool?: DesignTool) {
  return alovaInstance.Post<WorkspaceResponse>(`${workspaceApiBase(designTool)}/load_workspace`, {
    cmd: CMDEnum.load_workspace,
    data: {
      directory: directory
    }
  } as LoadWorkspaceRequest)
}

/**
 * Create a new project
 * @param path - Parent directory where the project will be created
 * @param name - Name of the new project (optional, defaults to "New_Chip_Design")
 * @param options - Additional project configuration options from wizard
 */
export function createWorkspaceApi(
  options: {
    directory?: string,
    pdk?: string,
    parameters?: Record<string, unknown>,
    origin_def?: string,
    origin_verilog?: string,
    rtl_list?: string[]
    pdk_root?: string
    filelist?: string
    designTool?: DesignTool
    cpu_filelist?: string
    soc_filelist?: string
    testbench?: string
    sim_cpp_sources?: string[]
    sim_cflags?: string[]
    sim_ldflags?: string[]
    sim_run_args?: string[]
    sim_images?: string[]
    sim_all_tests?: boolean
    sim_tests_dir?: string
    sim_build_all_programs?: boolean
    sim_program_names?: string[]
    sim_program_sources?: string[]
    sim_programs_dir?: string
    sim_tests_out_dir?: string
    sim_soc_root?: string
    sim_build_test_script?: string
  }
) {
  return alovaInstance.Post<WorkspaceResponse>(`${workspaceApiBase(options.designTool)}/create_workspace`, {
    cmd: CMDEnum.create_workspace,
    data: {
      directory: options?.directory || '',
      pdk: options?.pdk || '',
      parameters: options.parameters || {},
      origin_def: options.origin_def || '',
      origin_verilog: options.origin_verilog || '',
      rtl_list: options.rtl_list || [],
      pdk_root: options.pdk_root || ''  ,
      filelist: options.filelist || '',
      cpu_filelist: options.cpu_filelist || '',
      soc_filelist: options.soc_filelist || '',
      testbench: options.testbench || '',
      sim_cpp_sources: options.sim_cpp_sources || [],
      sim_cflags: options.sim_cflags || [],
      sim_ldflags: options.sim_ldflags || [],
      sim_run_args: options.sim_run_args || [],
      sim_images: options.sim_images || [],
      sim_all_tests: options.sim_all_tests || false,
      sim_tests_dir: options.sim_tests_dir || '',
      sim_build_all_programs: options.sim_build_all_programs || false,
      sim_program_names: options.sim_program_names || [],
      sim_program_sources: options.sim_program_sources || [],
      sim_programs_dir: options.sim_programs_dir || '',
      sim_tests_out_dir: options.sim_tests_out_dir || '',
      sim_soc_root: options.sim_soc_root || '',
      sim_build_test_script: options.sim_build_test_script || ''
    }
  } as CreateWorkspaceRequest)
}

export function setPdkRootApi(options: {
  pdk?: string
  pdk_root?: string
}) {
  return alovaInstance.Post<SetPdkRootResponse>('/api/workspace/set_pdk_root', {
    cmd: CMDEnum.set_pdk_root,
    data: {
      pdk: options?.pdk || '',
      pdk_root: options?.pdk_root || '',
    },
  } as SetPdkRootRequest)
}

/**
 * Check project API health
 */
export function checkProjectApiHealth() {
  return alovaInstance.Get<{ status: string }>('/api/project/health')
}
