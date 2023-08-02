#!/usr/bin/env node

const { program } = require('commander');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

program
  .option('-s, --shell', 'Enter shell mode. Input command.')
  .option('-v, --verbose <file>', 'Verbose mode')
  .option('-d, --download <file>', 'Download u-boot.imx via HID device')
  .option('-b, --write <partition> <file>', 'Write u-boot.imx to specified partition (e.g., "emmc" or "emmc_all")')
  .option(
    '-bshow <builtInCmd>',
    'Show built-in script',
    /^(emmc|emmc_all|fat_write|nand|nvme_all|qspi|sd|sd_all|spi_nand|spl)$/i
  )
  .option('-h, --help', 'Show general help')
  .option('-H, --detailed-help', 'Show detailed help for commands')
  .parse(process.argv);

const platform = os.platform();
console.log('Platform:', platform);
const platformMap = {
  win32: 'uuu.exe',
  darwin: 'uuu_mac',
  linux: 'uuu', // Replace with 'uuu_armv7' if appropriate for your platform
};

function downloadFile(url, filename) {
  return axios({
    method: 'get',
    url,
    responseType: 'stream',
  }).then((response) => {
    return new Promise((resolve, reject) => {
      const outputStream = fs.createWriteStream(filename);
      response.data.pipe(outputStream);
      outputStream.on('finish', () => resolve(filename));
      outputStream.on('error', (error) => reject(error));
    });
  });
}

function getUuuBinaryUrl(platform) {
  const binaryName = platformMap[platform];
  return `https://github.com/nxp-imx/mfgtools/releases/latest/download/${binaryName}`;
}

async function downloadUuuBinary() {
  const binaryUrl = getUuuBinaryUrl(platform);
  const binaryFileName = path.join(__dirname, 'mecha', platformMap[platform]);

  try {
    fs.mkdirSync(path.join(__dirname, 'mecha'), { recursive: true });
  } catch (error) {
    console.error('Error creating "mecha" directory:', error.message);
    return;
  }

  try {
    await downloadFile(binaryUrl, binaryFileName);
    console.log('Download completed:', binaryFileName);
  } catch (error) {
    console.error('Error downloading binary:', error.message);
  }
}

function runUuuCommand(args) {
  if (!platformMap[platform]) {
    console.error(`Unsupported platform: ${platform}`);
    return;
  }

  const uuuBinaryPath = path.join(__dirname, 'mecha', platformMap[platform]);
  const uuuProcess = spawn(uuuBinaryPath, args, { stdio: 'inherit' });

  uuuProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`uuu process exited with code ${code}`);
    }
  });
}

async function main() {
  // Download uuu binary if not already present
  await downloadUuuBinary();

  // Rest of the code to handle user commands
  if (program.help) {
    runUuuCommand(['-h']);
  } else if (program.detailedHelp) {
    runUuuCommand(['-H']);
  } else if (program.shell) {
    runUuuCommand(['-s']);
  } else if (program.verbose) {
    const file = program.verbose;
    if (!file) {
      console.error('Please provide the path to u-boot.imx');
    } else {
      runUuuCommand(['-v', file]);
    }
  } else if (program.download) {
    const file = program.download;
    if (!file) {
      console.error('Please provide the path to u-boot.imx');
    } else {
      runUuuCommand(['-d', file]);
    }
  } else if (program.write) {
    const [partition, file] = program.write;
    if (!partition || !file) {
      console.error('Please provide both the partition and the path to u-boot.imx');
    } else {
      runUuuCommand(['-b', partition, file]);
    }
  } else if (program.bshow) {
    const builtInCmd = program.bshow.toLowerCase();
    runUuuCommand(['-bshow', builtInCmd]);
  } else {
    console.error('Invalid command. Use --help for usage information.');
  }
}

main();
