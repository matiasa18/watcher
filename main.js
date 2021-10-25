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

if (process.argv.length > 2) {
    var command = process.argv[2];

    if (command == 'setup') {
        setup();
    } else if (command == 'run') {
        run();
    } 
} else {
    console.error(`[] Please select one of the following options: ${chalk.red('[setup, run]')}`);
}

function setup() {
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
        console.log(`[] Writing ${chalk.yellow('.uploader_config.json')}...`);

        jsonfile.writeFileSync('./.uploader_config.json', [_.extend(config, {
            rootFolder: (config.rootFolder.match(/\/$/)? config.rootFolder : config.rootFolder + '/'),
            url: config.url,
            id: config.id
        })]);

        console.log(`[] Writing ${chalk.yellow('.gitignore')}...`);

        fs.copyFileSync(dir('files/gitignore.txt'), '.gitignore')

        console.log(`Done. To start server now please run ${chalk.yellow('watcher run')}.`);
    });
}

function run() {
    console.log(`[] Please select what account you want to use.`);
    
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
        let choice = _.findWhere(json, {id: selection.id});

        console.log(`[] Watching this folder, will upload to: ${chalk.yellow(choice.rootFolder)}`);

        chokidar.watch('.', {ignored: ['.uploader_config.json', '.gitignore', 'node_modules/**', 'package-lock.json', /(^|[\/\\])\../]}).on('all', (event, path) => {
            if (event == 'change') {
                console.log('[] Detected file change: ' + chalk.bold(path));
                let contents = fs.readFileSync(path, {encoding: 'utf-8'});

                upload(choice.rootFolder + path, contents, choice.url);
            }
        });        
    });
    /**/
}

function upload (path, contents, url) {
    console.log('[] Uploading to: ' + chalk.bold(path));

    request.post({url: url, formData: {data: contents, path: path}}, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('[] upload failed:', err);
        }

        let response = JSON.parse(httpResponse.body);

        if (response.status == 'error') {
            console.log(`[] ${chalk.red('ERROR!')}, NetSuite responded: ${response.exception}.`);
        } else {
            console.log(`[] ${chalk.green('Success!')}, file uploaded.`);
        }
    });
}