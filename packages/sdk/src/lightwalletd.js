// GENERATED from lightwalletd.ts by scripts/sync-network-source.mjs; do not edit.
const NETWORKS = ['main', 'test', 'regtest'];
const LIMITATION = 'Offline, self-reported lightwalletd gRPC metadata only. Not consensus, shielded-sync, wallet readiness, server trust, proof validity, or private transaction verification.';
/** grpcurl typically renders protobuf uint64 as decimal strings. */
function height(value) {
    if (typeof value === 'number')
        return Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(value))
        return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}
/** Pure, redacted normalization. Never forward a complete gRPC response to a client. */
export function evaluateLightwalletdInfo(input, options = {}) {
    const fail = () => { throw new TypeError('Invalid lightwalletd readiness input or policy'); };
    try {
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            !options || typeof options !== 'object' || Array.isArray(options))
            return fail();
        const expected_network = options.expectedNetwork ?? 'test';
        const max_lag = options.maxHeightLag ?? 2;
        if (!NETWORKS.includes(expected_network) || !Number.isSafeInteger(max_lag) ||
            max_lag < 0 || max_lag > 1000)
            return fail();
        const data = input;
        const network = typeof data.chainName === 'string' &&
            NETWORKS.includes(data.chainName)
            ? data.chainName : null;
        const block_height = height(data.blockHeight);
        const estimated_height = height(data.estimatedHeight);
        const sapling_activation = height(data.saplingActivationHeight);
        const sync_lag = block_height === null || estimated_height === null || estimated_height === 0
            ? null : Math.max(0, estimated_height - block_height);
        // The branch identifier is deliberately never echoed, only presence/shape.
        const branch_present = typeof data.consensusBranchId === 'string' &&
            /^[0-9a-fA-F]{8}$/.test(data.consensusBranchId);
        const status = (value) => value === null ? 'unknown' : value ? 'pass' : 'fail';
        const checks = [
            { code: 'LIGHTD_NETWORK', status: status(network === null ? null : network === expected_network) },
            { code: 'LIGHTD_HEIGHT', status: status(block_height === null ? null : block_height > 0) },
            { code: 'LIGHTD_SAPLING', status: status(block_height === null || sapling_activation === null || sapling_activation === 0
                    ? null : block_height >= sapling_activation) },
            { code: 'LIGHTD_SYNC_LAG', status: status(sync_lag === null ? null : sync_lag <= max_lag) },
            { code: 'LIGHTD_BRANCH', status: status(branch_present ? true : null) },
        ];
        return {
            schema_version: 1, network, expected_network, block_height, estimated_height, sync_lag,
            ready: checks.every(check => check.status === 'pass'), checks, limitation: LIMITATION,
        };
    }
    catch {
        return fail();
    }
}
