import { alovaInstance } from './client'
import { CMDEnum, RequestData, ResponseData, StepEnum, InfoEnum, StateEnum } from './type';
import type { DesignTool } from '../types'

function workspaceApiBase(designTool?: DesignTool): string {
  return designTool === 'frontend' ? '/api/frontend/workspace' : '/api/workspace'
}

export interface GetInfoRequest {
  step: StepEnum;
  id: InfoEnum;
}

export interface GetInfoResponse {
  step: string;
  id: InfoEnum;
  info: any;
}

export function getInfoApi(request: RequestData<GetInfoRequest>, designTool?: DesignTool) {
  return alovaInstance.Post<ResponseData<GetInfoResponse>>(`${workspaceApiBase(designTool)}/get_info`, request as unknown as RequestData<GetInfoRequest>)
}



export interface RTL2GDSRequest {
  rerun: boolean;
}

export interface RTL2GDSResponse {
  rerun: boolean;
}

export function rtl2gdsApi(request: RequestData<RTL2GDSRequest>, designTool?: DesignTool) {
  return alovaInstance.Post<ResponseData<RTL2GDSResponse>>(`${workspaceApiBase(designTool)}/rtl2gds`, request as unknown as RequestData<RTL2GDSRequest>)
}

export interface RunStepRequest {
  step: StepEnum;
  rerun: boolean;
  sim_test_suite?: string;
}

export interface RunStepResponse {
  step: StepEnum;
  state: StateEnum;
}

export function runStepApi(request: RequestData<RunStepRequest>, designTool?: DesignTool) {
  return alovaInstance.Post<ResponseData<RunStepResponse>>(`${workspaceApiBase(designTool)}/run_step`, request as unknown as RequestData<RunStepRequest>)
}

// ============ Home Page API ============

export interface HomePageResponse {
  path: string
}

/**
 * 调用 get_home_page API 获取 home.json 的路径
 */
export function getHomePageApi(designTool?: DesignTool) {
  return alovaInstance.Post<ResponseData<HomePageResponse>>(`${workspaceApiBase(designTool)}/get_home_page`, {
    cmd: CMDEnum.home_page,
    data: {}
  })
}
