import {
    Lucid, Blockfrost, C, toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

import { Buffer } from "https://deno.land/std@0.139.0/node/buffer.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { AccountInfo } from "./types.ts";
import NaCl from "npm:tweetnacl"
import { constructionSubmit, fetchMempoolTxDetail } from "./prepare_http.ts";


const host = Deno.env.get("API_HOST");
const port = Deno.env.get("API_PORT");


async function fetchAdaCoins(address: string) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "account_identifier": {
            "address": "${address}"
        }
    }`;
    const response = await fetch(`http://${host}:${port}/account/coins`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json()).coins;

}

async function fetchPreprocess(operations: any) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "operations": ${JSON.stringify(operations, null, 4)},
        "metadata": {
            "relative_ttl": 1000,
            "deposit_parameters": {
                "keyDeposit": "2000000",
                "poolDeposit": "500000000"
            }
        }
    }`;
    const response = await fetch(`http://${host}:${port}/construction/preprocess`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    console.log(`response data`);
    return (await response.json()).options;
}

async function fetchMetadata(options: any) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "options": ${JSON.stringify(options)}
    }`;
    const response = await fetch(`http://${host}:${port}/construction/metadata`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json()).metadata;
}

async function fetchPayloads(operations: any, metadata: any) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "operations": ${JSON.stringify(operations, null, 4)},
        "metadata": ${JSON.stringify(metadata)}
    }`;
    const response = await fetch(`http://${host}:${port}/construction/payloads`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json());
}


function buildOperations(adaCoins: any, fromAccount: string, toAccount: string) {
    const totalBalance = adaCoins.map((adaCoin: any) => BigInt(adaCoin.amount.value))
        .reduce((x: bigint, y: bigint) => x + y, 0n);
    const inputOperations = adaCoins.map((adaCoin: any, index: number) => {
        return {
            operation_identifier: {
                network_index: 0,
                index: index,
            },
            related_operations: [],
            type: "input",
            status: "success",
            account: {
                address: fromAccount,
                metadata: {},
            },
            amount: {
                value: `-${adaCoin.amount.value}`,
                currency: {
                    symbol: "ADA",
                    decimals: 6
                },
                metadata: {},
            },
            coin_change: {
                coin_identifier: adaCoin.coin_identifier,
                coin_action: "coin_created",
            },
            metadata: {},
        }
    });
    const outputOperations = [
        {
            operation_identifier: {
                network_index: 0,
                index: inputOperations.length,
            },
            related_operations: [],
            type: "output",
            status: "success",
            account: {
                address: toAccount,
                metadata: {},
            },
            amount: {
                value: `1000000`,
                currency: {
                    symbol: "ADA",
                    decimals: 6
                },
                metadata: {}
            },
            metadata: {},
        },
        {
            operation_identifier: {
                network_index: 0,
                index: inputOperations.length + 1,
            },
            related_operations: [],
            type: "output",
            status: "success",
            account: {
                address: fromAccount,
                metadata: {},
            },
            amount: {
                value: (totalBalance - 1000000n - 1000000n).toString(),
                currency: {
                    symbol: "ADA",
                    decimals: 6
                },
                metadata: {},
            },
            metadata: {},
        }
    ];
    const operations = [...inputOperations, ...outputOperations];
    return operations;
}

async function signAPayload(payload: any, privKey: string, pubKey: string) {
    return {
        signing_payload: payload[0],
        public_key: {
            hex_bytes: Buffer.from(pubKey, 'hex').toString("hex"),
            curve_type: "edwards25519",
        },
        signature_type: "ed25519",
        hex_bytes: Buffer.from(
            NaCl.sign.detached(
                Buffer.from(payload[0].hex_bytes, "hex"),
                Buffer.from(privKey, 'hex'),
            )
        ).toString("hex"),
    }
}

export async function constructCombine(unsignedTransaction: any, payloadSignatures: any) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "unsigned_transaction": ${JSON.stringify(unsignedTransaction)},
        "signatures": ${JSON.stringify([payloadSignatures])}
    }`;
    const response = await fetch(`http://${host}:${port}/construction/combine`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json());
}

export async function prepareTransfer(fromAccount: string, toAccount: string): Promise<string> {
    const from: AccountInfo = JSON.parse(await Deno.readTextFile(`./data/accounts_2/${fromAccount}.info`));
    const to: AccountInfo = JSON.parse(await Deno.readTextFile(`./data/accounts_2/${toAccount}.info`));
    const adaCoins = await fetchAdaCoins(from.address);
    const operations = buildOperations(adaCoins, from.address, to.address);
    console.log(`operations is `);
    console.log(operations);
    const preprocess = await fetchPreprocess(operations);
    console.log(`preprocess is `);
    console.log(preprocess);
    const metadata = await fetchMetadata(preprocess);
    console.log(`metadata is `);
    console.log(metadata);
    const payloads = await fetchPayloads(operations, metadata);
    console.log(`payloads is`);
    console.log(payloads);
    const signedPayloads = await signAPayload(payloads.payloads, from.privKey, from.pubKey);
    const combined = await constructCombine(payloads.unsigned_transaction, signedPayloads);
    return combined.signed_transaction;
}

if (import.meta.main) {
    const signedTransactions: string[] = [];
    for (let i = 12; i < 13; i++) {
        const j = (i + 1) % 99;
        console.log(`prepare transfer ${i} - ${j}`);
        const signedTransaction = await prepareTransfer(`account_${i}`, `account_${j}`);
        signedTransactions.push(signedTransaction);
        console.log(`submit tx`, { i, j, signedTransaction });
        console.log(signedTransaction);
        const txHash = await constructionSubmit(signedTransaction);
        console.log(`fetch tx detail ${JSON.stringify(txHash)} in mempool`)
        console.log(txHash);
        // const txDetail = await fetchMempoolTxDetail((txHash as any).transaction_identifier.hash);
        console.log(`tx detail for ${(txHash as any).transaction_identifier.hash}`);
        // console.log(JSON.stringify(txDetail));
    }
}