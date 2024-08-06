import chalk from 'chalk';
import fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";
import readlineSync from "readline-sync";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { displayHeader, setupStakeCronJob, sleep } from "../lib/utils.js";
import { stakeTransaction } from "../lib/transaction.js";
import { parseProxy, shuffleArray } from "../lib/api.js";

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

const WALLETS = JSON.parse(fs.readFileSync("seeds.json", "utf-8"));

async function createWalletFromPrivateKey(privateKeyHex, prefix) {
  const privateKey = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const wallet = await DirectSecp256k1Wallet.fromKey(privateKey, prefix);
  return wallet;
}

async function executeTransactions(txCount, valoper) {
  for (let i = 0; i < txCount; i++) {
    for (const WALLET of WALLETS) {
      try {
        const wallet = await createWalletFromPrivateKey(WALLET, "symphony");
        const accounts = await wallet.getAccounts();
        const address = accounts[0].address;

        // Shuffle proxies for each transaction
        const shuffledProxies = shuffleArray(proxies);
        for (const proxy of shuffledProxies) {
          const { host, port, username, password } = parseProxy(proxy);
          const proxyUrl = `http://${username}:${password}@${host}:${port}`;

          console.log(chalk.blue(`🔗 Connecting to proxy: ${proxyUrl}...`));

          try {
            await stakeTransaction(wallet, valoper, proxyUrl);
            console.log(
              chalk.green(
                `✅ Successfully connected and transaction sent through proxy: ${proxyUrl}`
              )
            );
            break; // Exit the proxy loop on success
          } catch (proxyError) {
            console.log(
              chalk.yellow(`⚠️ Proxy failed: ${proxyUrl}, trying next proxy...`)
            );
            continue; // Try the next proxy
          }
        }
      } catch (error) {
        if (error.message.includes("invalid validator address")) {
          console.log(
            chalk.red(`Invalid validator address, please input a correct one.`)
          );
        } else {
          console.log(chalk.red(`Error in IIFE – Stake: ${error}`));
        }
      }
    }

    if (txCount > 1 && i < txCount - 1) {
      const sleepDuration =
        Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
      console.log(
        chalk.green(
          `Sleeping for ${sleepDuration / 1000} seconds... (${
            i + 1
          }/${txCount})`
        )
      );
      await sleep(sleepDuration);
    }
  }
}

(async () => {
  displayHeader();
  console.log(chalk.yellow("Please wait..."));
  console.log("");

  const choice = readlineSync.question(
    "Choose an option (1: One-time run // 2: Schedule daily run): "
  );

  //select random validator
  const validatorPath = path.join(__dirname, "proxy.txt");
  let validators = [];

  if (fs.existsSync(validatorPath)) {
    validators = fs.readFileSync(validatorPath, "utf-8").trim().split("\n");
  } else {
    console.error(
      chalk.red(`❌ Validator file not found at path: ${proxiesPath}`)
    );
    process.exit(1);
  }

  const valoper =
    readlineSync.question(
      "Submit validator address that you want to stake (example: symphonyvaloper15fz6rfdkwzy8pwglgmt44ehyr07u38hhlurgap): "
    ) || "symphonyvaloper15fz6rfdkwzy8pwglgmt44ehyr07u38hhlurgap";

  if (choice === "1") {
    const txCount = parseInt(
      readlineSync.question("How many transactions do you want? "),
      10
    );
    console.log("");
    await executeTransactions(txCount, valoper);
  } else if (choice === "2") {
    const txCount = parseInt(
      readlineSync.question("How many transactions do you want each day? "),
      10
    );
    console.log("");
    fs.writeFileSync("txStakeCount.json", JSON.stringify({ txCount }), "utf-8");
    fs.writeFileSync(
      "valoperAddress.json",
      JSON.stringify({ valoper }),
      "utf-8"
    );
    console.log(chalk.green("Scheduled daily transactions."));

    await executeTransactions(txCount, valoper);
    setupStakeCronJob(() => executeTransactions(txCount, valoper));

    console.log(chalk.green("Cron job scheduled to run every 24 hours."));
  } else {
    console.log(chalk.red("Invalid choice. Exiting."));
  }

  console.log(chalk.green("All tasks are done!"));
  console.log(chalk.green("Subscribe: https://t.me/HappyCuanAirdrop"));
})();
