import {
    Lucid, Blockfrost, C, toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

import { Buffer } from "https://deno.land/std@0.139.0/node/buffer.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { AccountInfo } from "./types.ts";
import  NaCl from "npm:tweetnacl"

const blockfrostKey = Deno.env.get("BLOCKFROST_KEY");

const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", blockfrostKey),
    "Preprod",
)

const host = Deno.env.get("API_HOST");
const port = Deno.env.get("API_PORT");


export async function constructDerive(pubkey: string) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "public_key": {
            "hex_bytes": "${pubkey}",
            "curve_type": "edwards25519"
        }
    }`;
    const response = await fetch(`http://${host}:${port}/construction/derive`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json());

}

async function fetchPreprocess(operations: any) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "operations": ${JSON.stringify(operations)}
    }`;
    console.log(body);
    const response = await fetch(`http://${host}:${port}/construction/preprocess`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json()).options;
}

export async function constructionSubmit(signed_transaction: string): Promise<string> {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "signed_transaction": "${signed_transaction}"
    }`;
    console.log(body);
    console.log(`Start calling`);
    const response = await fetch(`http://${host}:${port}/construction/submit`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    console.log(`response is ${response}`);
    return (await response.json());
}

async function fetchMetadata(options: any) {
    const body = `{
         "network_identifier": {
            "blockchain": "cardano",
            "network": "preprod"
        },
        "options": ${JSON.stringify(options)}
    }`;
    console.log(body);
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
        "operations": ${JSON.stringify(operations)},
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
    console.log(totalBalance);
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
                }
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
                value: `50000000`,
                currency: {
                    symbol: "ADA",
                    decimals: 6
                }
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
                value: (totalBalance - 50000000n - 3000000n).toString(),
                currency: {
                    symbol: "ADA",
                    decimals: 6
                }
            },
            metadata: {},
        }
    ];
    const operations = [...inputOperations, ...outputOperations];
    return operations;
}

async function signAPayload(payload: any, privKey: string, pubKey: string) {
    console.log(`signPayload`);
    console.log(payload);
    const priv = C.PrivateKey.from_bytes(Buffer.from(privKey, 'hex')).to_bech32();
    lucid.selectWalletFromPrivateKey(priv);
    const address = await lucid.wallet.address();
    const signatures = await lucid.wallet.signMessage(address, payload.hex_bytes);
    console.log(JSON.stringify(signatures));
    return {
        signing_payload: payload[0],
        public_key: {
            hex_bytes: Buffer.from(pubKey, 'hex').toString("hex"),
            curve_type: "edwards25519",
          },
          signature_type: "ed25519",
          hex_bytes: signatures.signature,
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
    console.log(`body combine`);
    console.log(body);
    const response = await fetch(`http://${host}:${port}/construction/combine`, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body,
    });
    return (await response.json());
}

if (import.meta.main) {
}