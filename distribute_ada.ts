import {
    Lucid, Blockfrost, C, toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

import { Buffer } from "https://deno.land/std@0.139.0/node/buffer.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { AccountInfo } from "./types.ts";
import { sleep } from "./utils.ts";

const blockfrostKey = Deno.env.get("BLOCKFROST_KEY");

const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", blockfrostKey),
    "Preprod",
)


export async function transferAda(fromAccount: string, toAccount: string, amount: string): Promise<string> {
    console.log(`Transfer ${amount} Ada from ${fromAccount} to ${toAccount}`);

    const from: AccountInfo = JSON.parse(await Deno.readTextFile(`./data/accounts/${fromAccount}.info`));
    const to: AccountInfo = JSON.parse(await Deno.readTextFile(`./data/accounts/${toAccount}.info`));

    const priv = C.PrivateKey.from_bytes(Buffer.from(from.privKey, 'hex')).to_bech32();

    lucid.selectWalletFromPrivateKey(priv);

    const tx = await lucid.newTx()
        .payToAddress(to.address, { lovelace: BigInt(amount) }).complete();
    const txSigned = await tx.sign().complete();
    console.log(txSigned.toString());
    const txHash = await txSigned.submit();
    console.log(`Transfer ada success with tx ${txHash}`);
    return txHash;
}

if (import.meta.main) {
    const startInd = [16, 20, 28, 37, 46, 55, 64, 73, 82, 91];
    const endInd = [19, 28, 37, 46, 55, 64, 73, 82, 91, 100];
    let t = 10;
    while (t--) {
        for (let i = 0; i < 10; i++) {
            if (startInd[i] < endInd[i]) {
                await transferAda(`account_${i}`, `account_${startInd[i]}`, '200000000');
                startInd[i] = startInd[i] + 1;
                await sleep(20000);
            }
        }
    }
}