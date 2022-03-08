const { spawn } = require('child_process');

/**
 * Run something and return a promise with the result
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} options
 *
 * @return {Promise<string>}
 */
module.exports.run = (command, arguments, options) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments, options);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.stderr.on('data', (data) => {
      stderr += data;
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(stderr);
      }
    });
  });
};

/**
 * Require a dependency, and call npm install if it's not found
 *
 * @param {string} dependency
 */
module.exports.install = async (dependency) => {
  try {
    return require(dependency);
  } catch (e) {
    console.log(`${dependency} not found, installing...`);
    await module.exports.run('npm', ['install', dependency]);
  }
};
