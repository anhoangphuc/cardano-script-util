import {
    Lucid, Blockfrost, C,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

import { Buffer } from "https://deno.land/std@0.139.0/node/buffer.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { AccountInfo } from "./types.ts";
import NaCl from 'npm:tweetnacl';
import { constructDerive } from "./prepare_http.ts";

export async function generateAndFundAccount(accountName: string): Promise<AccountInfo> {
    console.log(`Generate account with name ${accountName}`);

    const keys = NaCl.sign.keyPair();
    const privKey = Buffer.from(keys.secretKey).toString('hex');
    const pubKey = Buffer.from(keys.publicKey).toString('hex');
    const deriveResponse = await constructDerive(pubKey);

    const accountInfo: AccountInfo = {
        pubKey: privKey,
        privKey: pubKey,
        address: deriveResponse.account_identifier.address,
    }
    console.log(accountInfo);
    await Deno.writeTextFile(`./data/accounts_2/${accountName}.info`, JSON.stringify(accountInfo));
    return accountInfo;
}

if (import.meta.main) {
    const fromAccount = Number(Deno.args[0]);
    const toAccount = Number(Deno.args[1]);
    for (let i=fromAccount; i<toAccount; i++) {
        await generateAndFundAccount(`account_${i}`);
    }
}