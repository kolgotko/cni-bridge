#!/usr/bin/env node

'use strict';

const {spawn, spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const ajv = new Ajv;

async function getStdinData() {

    return new Promise((res, rej) => {

        let returnData = '';

        let dataHandler = data => { returnData += data; };

        process.stdin.on('data', dataHandler);

        process.stdin.on('end', _ => {
            process.stdin.removeListener('data', dataHandler);
            res(returnData);
        });

    });

}

function ifConfig(ifName, args = []) {

    let result = spawnSync('ifconfig', [ifName, ...args]);
    return result.stdout
        .toString()
        .trim()

}

function ifCreate(ifName, args = []) {

    return ifConfig(ifName, ['create', ...args])
        .toString()
        .trim()

}

function getIfaces() {

    let result = spawnSync('ifconfig', ['-l']);
    return result.stdout
        .toString()
        .trim()
        .split(' ');

}

async function cmdAdd(envData, stdinData) {

    let bridgeName = stdinData.bridge;

    if (!getIfaces().includes(bridgeName)) {

        let bridge = ifCreate('bridge', ['up']);
        ifConfig(bridge, ['name', bridgeName]);

    }

    let epairA = ifCreate('epair', ['up']);
    let [_, num] = epairA.match(/^epair(\d+)a$/);
    let epairB = `epair${num}b`;

    ifConfig(bridgeName, ['addm', epairA]);

    epairB = ifConfig(epairB, ['name', envData.CNI_IFNAME]);
    ifConfig(epairB, ['vnet', envData.CNI_CONTAINERID]);

    if (stdinData.ipam.type) {

        let pluginName = stdinData.ipam.type;
        let envPath = process.env.PATH;

        process.env.PATH = `${envPath}:${envData.CNI_PATH}`;

        let ipamStdin = Object.assign({}, stdinData.ipam, {
            name: stdinData.name,
            cniVersion: stdinData.cniVersion,
        });

        let result = spawnSync(pluginName, [], {
            env: envData,
            input: JSON.stringify(ipamStdin),
        })

        let resultJson = JSON.parse(result.stdout.toString());
        resultJson.interfaces = [
            { name: envData.CNI_IFNAME }
        ];
        resultJson.ips[0].interface = 0;

        console.log(JSON.stringify(resultJson));

    }

}

async function cmdDel(envData, stdinData) {

    if (stdinData.ipam.type) {

        let pluginName = stdinData.ipam.type;
        let envPath = process.env.PATH;

        process.env.PATH = `${envPath}:${envData.CNI_PATH}`;

        let ipamStdin = Object.assign({}, stdinData.ipam, {
            name: stdinData.name,
            cniVersion: stdinData.cniVersion,
        });

        let result = spawnSync(pluginName, [], {
            env: envData,
            input: JSON.stringify(ipamStdin),
        })

        ifConfig(envData.CNI_IFNAME, ['-vnet', envData.CNI_CONTAINERID]);
        ifConfig(envData.CNI_IFNAME, ['destroy'])

    }

}

// main
(async _ => {

    let defaults = {
        cniVersion: '0.3.1',
        name: '',
        type: 'bridge',
        bridge: 'cni0', // bridge interface name
        ipam: {},
        args: {},
        ipMasq: false,
        promiscMode: false,
        mtu: null,
        isDefaultGateway: false,
        isGateway: false,
        hairpinMode: false,
        dns: {},
    };

    let envData = process.env;
    let command = envData.CNI_COMMAND;
    let containerId = envData.CNI_CONTAINERID;
    let ifName = envData.CNI_IFNAME;
    let path = envData.CNI_PATH;
    let cniArgs = envData.CNI_ARGS;

    let stdinData = JSON.parse(await getStdinData());
    stdinData = Object.assign({}, defaults, stdinData);

    switch (command) {
        case 'ADD':
            await cmdAdd(envData, stdinData);
            break;
        case 'DEL':
            await cmdDel(envData, stdinData);
            break;
    }

})();
