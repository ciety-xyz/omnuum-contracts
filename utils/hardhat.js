const { ethers, upgrades, config, run } = require('hardhat');
const { rm } = require('fs/promises');
const path = require('path');
const { mapC, go } = require('fxjs');

const clean = async () => {
  const targets = ['artifacts', 'cache', '.openzeppelin', 'data'];
  await go(
    targets,
    mapC((target) => rm(path.join(__dirname, `../${target}`), { recursive: true, force: true })),
  );
};

module.exports.compile = async ({ quiet, force }) => {
  if (force) {
    await clean();
  }

  await run('compile', { force, quiet });
};
