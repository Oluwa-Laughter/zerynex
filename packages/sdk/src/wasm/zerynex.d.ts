/* tslint:disable */
/* eslint-disable */

export function analyze_pczt(bytes: Uint8Array, restricted: boolean): string;

export function analyze_pczt_policy(bytes: Uint8Array, policy_json: string): string;

/**
 * Browser and SDK binding for two-stage privacy regression checks.
 */
export function compare_pczt_stages(before: Uint8Array, after: Uint8Array, policy_json: string): string;

/**
 * Browser-only ZIP-321 validator. Returns a sanitized summary; never addresses,
 * memos or label contents. Caller must separately obtain wallet approval.
 */
export function inspect_zip321_request(uri: string, network: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly analyze_pczt: (a: number, b: number, c: number) => [number, number, number, number];
    readonly analyze_pczt_policy: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly compare_pczt_stages: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly inspect_zip321_request: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
