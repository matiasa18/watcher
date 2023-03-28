#!/usr/bin/env node

const inquirer = require('inquirer')
const jsonfile = require('jsonfile')
const fs = require('fs')
const cwd = fs.realpathSync(process.cwd()) // http://bit.ly/2YYe9R8 - because symlinks.
const dir = text => path.resolve(__dirname, text)
const path = require('path')
const chalk = require('chalk')
const _ = require('underscore')
const chokidar = require('chokidar')
const request = require('request');
const moment = require('moment');
const { readFile } = require('fs/promises');

const log = (message) => {
  let timestamp = moment().format('HH:mm');

  console.log(`${chalk.bold('[' + timestamp + ']')} ` + message);
}

const getFileContents = async (path) => {
  let result = await readFile(path, 'UTF-8');

  return result;
}


const upload = (path, contents, url) => {
  log('Uploading to: ' + chalk.bold(path));
  let promise = new Promise((resolve, reject) => {
    request.post({ url: url, formData: { data: contents, path: path } }, (err, httpResponse, body) => {
      if (err) {
        log('Upload failed:', err);
        reject(400);
      }

      let response = JSON.parse(httpResponse.body);

      if (response.status == 'error') {
        log(`${chalk.red('ERROR!')}, NetSuite responded: ${response.exception}.`);
        reject(400);
      } else {
        resolve(200);
      }
    })

  });

  return promise;
}

const setup = () => {
  inquirer
    .prompt([
      {
        type: 'input',
        name: 'rootFolder',
        message: 'Folder to put scripts in (Absolute path, ie: /SuiteScripts/xxxx/)'
      },
      {
        type: 'input',
        name: 'url',
        message: 'Url of the Suitelet'
      },
      {
        type: 'input',
        name: 'id',
        message: 'ID you will use, you will be prompted for this later'
      }
    ])
    .then(config => {
      log(`Writing ${chalk.yellow('.uploader_config.json')}...`);

      jsonfile.writeFileSync('./.uploader_config.json', [_.extend(config, {
        rootFolder: (config.rootFolder.match(/\/$/) ? config.rootFolder : config.rootFolder + '/'),
        url: config.url,
        id: config.id
      })]);

      log(`Writing ${chalk.yellow('.gitignore')}...`);

      fs.copyFileSync(dir('files/gitignore.txt'), '.gitignore')

      log(`Done. To start server now please run ${chalk.yellow('watcher run')}.`);
    });
}

const run = () => {
  log(`Please select what account you want to use.`);

  let json = jsonfile.readFileSync('./.uploader_config.json');

  inquirer
    .prompt([
      {
        type: 'list',
        name: 'id',
        message: 'Account ID',
        choices: _.pluck(json, 'id')
      }
    ])
    .then(selection => {
      let choice = _.findWhere(json, { id: selection.id });

      log(`Watching this folder, will upload to: ${chalk.yellow(choice.rootFolder)}`);

      chokidar.watch(['**/*.js', '**/*.xml']).on('all', async (event, path) => {
        if (event == 'change') {
          log('Detected file change: ' + chalk.bold(path));

          uploadFile(path, choice, null);
        }
      });
    });
}

const uploadSingle = () => {
  log(`Please select what account you want to use.`);

  let json = jsonfile.readFileSync('./.uploader_config.json');
  let id = process.argv[3];
  let file = process.argv[4];
  let path = process.argv[5];

  if (!id) {
    log(`${chalk.red('ERROR!')}, no id specified.`);
    return;
  }

  let option = _.findWhere(json, { id: id });

  if (!option) {
    log(`${chalk.red('ERROR!')}, do watcher setup and setup a ${id} (id) watcher.`);
    return;
  }

  if (!file) {
    log(`${chalk.red('ERROR!')}, no file specified.`);
    return;
  }

  if (!path) {
    log(`${chalk.red('ERROR!')}, no path specified.`);
    return;
  }

  uploadFile(file, option, path);
}

const uploadFile = async (path, config, forcedPath, retries) => {
  let contents = await getFileContents(path);
  retries = (retries) ? retries : 1;

  if (retries > 5) {
    log('Retries over 5');
    return;
  }

  if (retries > 1) {
    log('Retrying...');
  }

  let netsuitePath = (forcedPath) ? config.rootFolder + forcedPath : config.rootFolder + path;

  let promise = upload(netsuitePath, contents, config.url);

  promise.then((a, b, c) => {
    log(`${chalk.green('Success!')}, file uploaded.`);
  }).catch(async (err) => {
    await uploadFile(path, config, forcedPath, retries + 1);
  });
}

if (process.argv.length > 2) {
  var command = process.argv[2];

  if (command == 'setup') {
    setup();
  } else if (command == 'run') {
    run();
  } else if (command == 'upload') {
    uploadSingle();
  }
} else {
  log(`Please select one of the following options: ${chalk.red('[setup, run]')}`);
}