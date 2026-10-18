// GENERATED from transaction.ts by scripts/sync-network-source.mjs; do not edit.
const LIMITATION = 'One node\'s getrawtransaction/getblockchaininfo view only; not proof of transaction validity, wallet receipt, settlement, finality, anonymity, or consensus. Historical lookup may require txindex or a known block hash.';
const NETWORKS = ['main', 'test', 'regtest'];
const HEX_64 = /^[0-9a-fA-F]{64}$/;
const height = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295 ? value : null;
const confirmations = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= -1 && value <= 4294967295 ? value : null;
const record = (val) => val !== null && typeof val === 'object' && !Array.isArray(val);
const status = (pass) => pass === true ? 'pass' : pass === false ? 'fail' : 'unknown';
function checkPolicy(policy) {
    if (!record(policy) || !NETWORKS.includes(policy.expectedNetwork) ||
        typeof policy.expectedTxid !== 'string' || !HEX_64.test(policy.expectedTxid) ||
        !Number.isSafeInteger(policy.requiredConfirmations) ||
        policy.requiredConfirmations < 1 || policy.requiredConfirmations > 10000 ||
        Object.keys(policy).some(k => !['expectedNetwork', 'expectedTxid', 'requiredConfirmations'].includes(k)))
        throw new TypeError('Invalid transaction observation policy');
}
/**
 * Normalize trusted RPC result objects. Passing a JSON-RPC envelope or
 * a raw hexadecimal string is an error: extract *result* on the host first.
 * A returned `confirmation_target_met` is NEVER proof of payment receipt.
 */
export function evaluateZcashTransaction(transactionResult, blockchainInfoResult, policy) {
    checkPolicy(policy);
    if (!record(blockchainInfoResult) ||
        (transactionResult !== null && !record(transactionResult)))
        throw new TypeError('Expected trusted JSON-RPC result objects, not envelopes or serialized transaction data');
    const chain = blockchainInfoResult;
    const tx = transactionResult;
    const network = NETWORKS.includes(chain.chain) ? chain.chain : null;
    const chainHeight = height(chain.blocks);
    const txHeight = tx ? height(tx.height) : null;
    const conf = tx ? confirmations(tx.confirmations) : null;
    const correctTxid = tx ? typeof tx.txid === 'string' && HEX_64.test(tx.txid) &&
        tx.txid.toLowerCase() === policy.expectedTxid.toLowerCase() : null;
    const hash = tx && typeof tx.blockhash === 'string' && HEX_64.test(tx.blockhash) ? tx.blockhash : null;
    const hasHash = tx && Object.prototype.hasOwnProperty.call(tx, 'blockhash');
    const hasHeight = tx && Object.prototype.hasOwnProperty.call(tx, 'height');
    const active = tx && typeof tx.in_active_chain === 'boolean' ? tx.in_active_chain : null;
    let consistency = null;
    if (conf !== null && chainHeight !== null && tx) {
        if (conf > 0)
            consistency = hash !== null && txHeight !== null && txHeight <= chainHeight &&
                conf === chainHeight - txHeight + 1;
        else if (conf === 0)
            consistency = !hasHash && !hasHeight && active !== true;
        else
            consistency = active === false ? hash !== null : active === true ? false : null;
    }
    const checkList = [
        { code: 'NETWORK_MATCH', status: status(network === null ? null : network === policy.expectedNetwork) },
        { code: 'TRANSACTION_ID', status: status(correctTxid) },
        { code: 'CHAIN_HEIGHT', status: status(chainHeight !== null ? true : null) },
        { code: 'CONFIRMATION_CONSISTENCY', status: status(consistency) },
        { code: 'ACTIVE_CHAIN', status: status(active === false ? false : active === true ? true : conf === null ? null : conf < 0 ? false : conf > 0 ? true : null) },
        { code: 'CONFIRMATION_TARGET', status: status(conf === null ? null : conf >= policy.requiredConfirmations) },
    ];
    let state = 'unknown';
    if (network !== null && network !== policy.expectedNetwork)
        state = 'wrong_network';
    else if (tx === null)
        state = 'unavailable';
    else if (correctTxid === false || consistency === false || (active === false && conf !== -1) ||
        (active === true && conf === -1))
        state = 'inconsistent';
    else if (network === null || chainHeight === null || correctTxid !== true || consistency === null)
        state = 'unknown';
    else if (conf === -1 && active === false)
        state = 'orphaned';
    else if (conf === 0)
        state = 'unconfirmed';
    else if (conf !== null && conf >= policy.requiredConfirmations)
        state = 'confirmation_target_met';
    else if (conf !== null && conf > 0)
        state = 'confirming';
    return {
        schema_version: 1, network, expected_network: policy.expectedNetwork,
        state, confirmations: conf, required_confirmations: policy.requiredConfirmations,
        chain_height: chainHeight, transaction_height: txHeight,
        confirmation_target_met: state === 'confirmation_target_met',
        checks: checkList, limitation: LIMITATION,
    };
}
/**
 * Tracks a single expected transaction in memory. It retains the last block
 * hash privately for possible reorg hints; never exposes raw hashes or TXIDs.
 * A reorg hint requires independent canonical-chain verification.
 */
export function createZcashTransactionObserver(policy) {
    checkPolicy(policy);
    const fixed = Object.freeze({ ...policy });
    let previous = null;
    return {
        observe(transactionResult, blockchainInfoResult) {
            const observation = evaluateZcashTransaction(transactionResult, blockchainInfoResult, fixed);
            const tx = record(transactionResult) ? transactionResult : null;
            const rawHash = tx && typeof tx.blockhash === 'string' && HEX_64.test(tx.blockhash)
                ? tx.blockhash.toLowerCase() : null;
            const previousState = previous?.state ?? null;
            const possibleReorg = previous !== null && ((previous.chainHeight !== null && observation.chain_height !== null &&
                observation.chain_height < previous.chainHeight) ||
                (previous.confirmations !== null && previous.confirmations > 0 &&
                    (observation.state === 'orphaned' || observation.state === 'unconfirmed' ||
                        (observation.confirmations !== null && observation.confirmations < previous.confirmations))) ||
                (previous.blockHash !== null && rawHash !== null && previous.blockHash !== rawHash));
            // Don't retain tainted identity/hash or state after wrong-network or
            // inconsistent input. Keep the last trustworthy observation for comparison.
            if (['unconfirmed', 'confirming', 'confirmation_target_met', 'orphaned'].includes(observation.state)) {
                previous = { state: observation.state, confirmations: observation.confirmations,
                    chainHeight: observation.chain_height, blockHash: rawHash };
            }
            return {
                schema_version: 1, observation, previous_state: previousState,
                state_changed: previousState !== null && previousState !== observation.state,
                possible_reorg: possibleReorg, limitation: 'Possible reorg is a local hint, not proof; rescan against a trusted canonical chain. No transaction IDs or hashes are included.',
            };
        },
        reset() { previous = null; },
    };
}
