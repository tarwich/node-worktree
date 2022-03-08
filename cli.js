const inquirer = require('inquirer');

/**
 * @param {string} message
 * @param {[string, Function]} options
 */
module.exports.menu = async (message, options) => {
  const { [message]: action } = await inquirer.prompt({
    type: 'list',
    message,
    name: message,
    choices: options.map(([name, action]) => ({ name, value: action })),
  });

  return action();
};
