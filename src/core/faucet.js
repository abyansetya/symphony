import fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";
import readlineSync from "readline-sync";
import cron from "node-cron";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import {
  fetchProxies,
  getFaucet,
  parseProxy,
  shuffleArray,
} from "../lib/api.js";
import { displayHeader } from "../lib/utils.js";
import chalk from "chalk";

// Function to create a wallet from a private key
const createWalletFromPrivateKey = async (privateKeyHex, prefix) => {
  const privateKey = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const wallet = await DirectSecp256k1Wallet.fromKey(privateKey, prefix);
  return wallet;
};

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read proxies from proxy.txt
const proxiesPath = path.join(__dirname, "proxy.txt");
let proxies = [];

if (fs.existsSync(proxiesPath)) {
  proxies = fs.readFileSync(proxiesPath, "utf-8").trim().split("\n");
} else {
  console.error(chalk.red(`❌ Proxy file not found at path: ${proxiesPath}`));
  process.exit(1);
}

export default async function runFaucetClaim() {
  console.log(chalk.yellow("Please wait..."));
  console.log("");

  // Using local proxies instead
  let PROXIES = shuffleArray(proxies);

  const WALLETS = JSON.parse(fs.readFileSync("seeds.json", "utf-8"));

  for (const WALLET of WALLETS) {
    const wallet = await createWalletFromPrivateKey(WALLET, "symphony");
    const address = (await wallet.getAccounts()).at(-1).address;

    for (const proxy of PROXIES) {
      const { host, port, username, password } = parseProxy(proxy);
      const proxyUrl = `http://${username}:${password}@${host}:${port}`;

      try {
        const { data, proxy: usedProxy } = await getFaucet(address, proxyUrl);
        if (data.status === "error") {
          console.error(
            chalk.red(`❌ Error for address ${address}: ${data.message}`)
          );
        } else {
          console.log(
            chalk.green(`✅ Claim faucet success using proxy ${usedProxy}!`)
          );
          console.log(
            chalk.cyan(
              `⚙️ Hash: https://testnet.ping.pub/symphony/tx/${data.result.txhash}`
            )
          );
        }
        console.log(
          chalk.magenta("====================================================")
        );
        console.log("");
        break; // Break out of the proxy loop after a successful request
      } catch (error) {
        console.error(
          chalk.yellow(`⚠️ Failed with proxy ${proxy}, trying next proxy...`)
        );
        continue; // Try the next proxy
      }
    }
  }
}

displayHeader();

const choice = readlineSync.keyInSelect(
  ["Run once", "Run every 24 hours"],
  "Do you want to run the script?"
);

if (choice === 0) {
  console.log(chalk.blue("Running faucet claim once..."));
  runFaucetClaim();
} else if (choice === 1) {
  console.log(
    chalk.blue("Running faucet claim immediately and setting up cron job...")
  );
  runFaucetClaim();

  cron.schedule("0 0 * * *", async () => {
    console.log(chalk.cyan("Starting scheduled job..."));
    try {
      await runFaucetClaim();
    } catch (error) {
      console.error(
        chalk.red("❌ Error occurred during scheduled job:", error.message)
      );
    }
  });
} else {
  console.log(chalk.red("Invalid choice. Exiting."));
  process.exit(1);
}
