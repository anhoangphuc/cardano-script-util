import {
    Lucid, Blockfrost, C,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

import { Buffer } from "https://deno.land/std@0.139.0/node/buffer.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { AccountInfo } from "./types.ts";

const blockfrostKey = Deno.env.get("BLOCKFROST_KEY");

const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", blockfrostKey),
    "Preprod",
)


export async function generateAndFundAccount(accountName: string): Promise<AccountInfo> {
    console.log(`Generate account with name ${accountName}`);

    const privKey = lucid.utils.generatePrivateKey();

    const address = await lucid
        .selectWalletFromPrivateKey(privKey)
        .wallet.address();

    const priv = C.PrivateKey.from_bech32(privKey);
    const pub = priv.to_public().as_bytes();
    const accountInfo: AccountInfo = {
        pubKey: Buffer.from(pub).toString('hex'),
        privKey: Buffer.from(priv.to_bytes()).toString('hex'),
        address,
    }
    await Deno.writeTextFile(`./data/accounts/${accountName}.info`, JSON.stringify(accountInfo));
    return accountInfo;
}

if (import.meta.main) {
    const fromAccount = Number(Deno.args[0]);
    const toAccount = Number(Deno.args[1]);
    for (let i=fromAccount; i<toAccount; i++) {
        await generateAndFundAccount(`account_${i}`);
    }
}