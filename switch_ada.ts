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


export async function transferAda(index: number): Promise<string> {
    const account = `account_${index}`;
    console.log(`Transfer Ada from ${account} `);

    const from: AccountInfo = JSON.parse(await Deno.readTextFile(`./data/accounts/${account}.info`));
    const to: AccountInfo = JSON.parse(await Deno.readTextFile(`./data/accounts_2/${account}.info`));

    const priv = C.PrivateKey.from_bytes(Buffer.from(from.privKey, 'hex')).to_bech32();

    lucid.selectWalletFromPrivateKey(priv);

    const tx = await lucid.newTx()
        .payToAddress(to.address, { lovelace: BigInt("180000000") }).complete();
    const txSigned = await tx.sign().complete();
    console.log(txSigned.toString());
    const txHash = await txSigned.submit();
    console.log(`Transfer ada success with tx ${txHash}`);
    return txHash;
}

if (import.meta.main) {
    for (let i = 0; i < 99; i++) {
        await transferAda(i);
        await sleep(20000);
    }

}