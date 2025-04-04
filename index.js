const { ethers } = require("ethers");
const fs = require("fs");
const readline = require("readline");
const axios = require("axios");

const PRIVATE_KEY_FILE = "privatekey.txt";
const ADDRESS_FILE = "address.txt";
const TOKEN_FILE = "token.txt";
const RPC_URL = "https://tea-sepolia.g.alchemy.com/public";
const BLOCK_EXPLORER_URL = "https://sepolia.tea.xyz/tx/";
const CHAIN_ID = 10218;
const DEFAULT_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
const DELAY_HOUR = 10; // delay time in hours

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch (error) {
    console.warn(
      `[⚠️  ] File ${filePath} not found or unreadable. Using default.`
    );
    return "";
  }
}

function writeFileContent(filePath, data) {
    try {
        return fs.writeFileSync(filePath, data);
    } catch (error) {
        console.log(error)
        console.warn(
            `[⚠️  ] File ${filePath} not found or unwriteable. Using default.`
        );
        return "";
    }
}

function validateAddresses(addresses) {
  return addresses.filter((address) => {
    if (!ethers.isAddress(address.trim())) {
      console.warn(`[⚠️  ] Invalid address skipped: ${address}`);
      return false;
    }
    return true;
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delaySync(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
      // Block the thread until the delay is over
  }
}

async function sendToRecipient(
  tokenContract,
  recipientAddress,
  amountInWei,
  isNativeToken
) {
  try {
    console.log(
      `[🚀] Sending ${
        isNativeToken ? "TEA" : "tokens"
      } to ${recipientAddress}...`
    );
    let tx;
    if (isNativeToken) {
      tx = await tokenContract.sendTransaction({
        to: recipientAddress.trim(),
        value: amountInWei,
      });
    } else {
      tx = await tokenContract.transfer(recipientAddress.trim(), amountInWei);
    }
    console.log(`[✅] Transaction sent! Hash: ${tx.hash}`);
    console.log(`[🔗] View on Block Explorer: ${BLOCK_EXPLORER_URL}${tx.hash}`);
  } catch (error) {
    console.error(
      `[❌] Error sending to ${recipientAddress}: ${error.message}`
    );
  }
}

async function sendToken(amountToSend) {
  let privateKey, recipientAddresses;

  while (true) {
    let now = new Date();
    let historyDay = readFileContent('date.txt');
    let currentDay = now.getDate() + '-' + now.getMonth() + '-' + now.getFullYear();

    if (historyDay != currentDay) {

      // jalankan proses
      var recordData = JSON.parse(fs.readFileSync('token.json', 'utf8'));
      for (let i = 0; i < recordData.length; i++) {
        
        try {
          privateKey = recordData[i].privateKey;

          // recipientAddresses = readFileContent(ADDRESS_FILE).split("\n"); -- old
          var response = await axios.get("https://raw.githubusercontent.com/clwkevin/LayerOS/main/addressteasepoliakyc.txt");
          if (response.data) {
            recipientAddresses = response.data.split('\n').map(addr => addr.trim().toLowerCase());
          } else {
            console.error("[❌] ERROR: Tidak dapat mengunduh data alamat KYC.");
            recipientAddresses = [];
          }

        } catch (error) {
          console.error("[❌] Failed to read input files. Exiting...");
          return;
        }
      
        if (!RPC_URL || !privateKey) {
          console.error("[❌] Missing required parameters: RPC URL or private key.");
          return;
        }
      
        let tokenContractAddress = recordData[i].token;
        let isNativeToken = false;
      
        if (!tokenContractAddress || !ethers.isAddress(tokenContractAddress)) {
          console.warn(
            "[⚠️  ] Invalid or missing token address. Using native token (TEA)."
          );
          tokenContractAddress = DEFAULT_TOKEN_ADDRESS;
          isNativeToken = true;
        }
      
        const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
        const wallet = new ethers.Wallet(privateKey, provider);
        const erc20Abi = [
          "function transfer(address to, uint256 amount) public returns (bool)",
          "function decimals() public view returns (uint8)",
        ];
        const tokenContract = isNativeToken
          ? wallet
          : new ethers.Contract(tokenContractAddress, erc20Abi, wallet);
      
        let amountInWei;
        try {
          if (isNativeToken) {
            amountInWei = ethers.parseUnits(amountToSend, 18);
          } else {
            const decimals = await tokenContract.decimals();
            amountInWei = ethers.parseUnits(amountToSend, decimals);
          }
        } catch (error) {
          console.error(`[❌] Error fetching token decimals: ${error.message}`);
          return;
        }
      
        recipientAddresses = validateAddresses(recipientAddresses);
        if (recipientAddresses.length === 0) {
          console.error("[❌] No valid recipient addresses found.");
          return;
        }
      
        for (const recipientAddress of recipientAddresses) {
          console.log("[💎] Sending From: " + recordData[i].wallet);

          await sendToRecipient(
            tokenContract,
            recipientAddress,
            amountInWei,
            isNativeToken
          );
          await delay(5000);
        }
      }

      let lastSync = now.getDate() + '-' + now.getMonth() + '-' + now.getFullYear();
      writeFileContent('date.txt', lastSync);
    } else {
      console.log("[🚫] Today process is already executed.");
    }

    console.log("[⌚️] Last Sync: ", now);
    let cooldown = 1000 * 60 * 60 * DELAY_HOUR;

    await delay(cooldown);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("[💰] Enter the amount of tokens to send: ", (amountToSend) => {
  if (!amountToSend || isNaN(amountToSend) || Number(amountToSend) <= 0) {
    console.error("[❌] Invalid amount entered. Exiting...");
    rl.close();
    return;
  }

  sendToken(amountToSend).then(() => rl.close());
});
