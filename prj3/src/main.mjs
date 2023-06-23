import serve from './knn-ws.mjs';


import { ok, err } from 'cs544-js-utils';
import { cwdPath } from 'cs544-node-utils';
import { makeFeaturesDao, } from 'prj2-sol';
import { parseImages } from 'prj1-sol';

import assert from 'assert';
import fs from 'fs';
import https from 'https';
import Path from 'path';
import util from 'util';

/**************************** main program *****************************/

const FILE_NAMES = {
    images: 'train-images-idx3-ubyte',
    labels: 'train-labels-idx1-ubyte',
};

const MNIST_HEADERS = {
    images: [{
            name: 'magic',
            value: 0x803,
        },
        {
            name: 'nImages',
        },
        {
            name: 'nRows',
            value: 28,
        },
        {
            name: 'nCols',
            value: 28,
        },
    ],
    labels: [{
            name: 'magic',
            value: 0x801,
        },
        {
            name: 'nLabels',
        },
    ],
};

export default async function main(args) {
    if (args.length !== 1 && args.length !== 2) usage();
    //const config = (await
    //    import (cwdPath(args[0]))).default;
    const port = getPort(2345);
    try {
        const daoResult = await makeFeaturesDao('mongodb://localhost:27017/knn');
        if (daoResult.hasErrors) panic(daoResult);
        const dao = daoResult.val;
        let trainLabeledFeatures;
        if (args.length === 2) {
            const dataDir = args[1];
            trainLabeledFeatures = await loadData(args[1], FILE_NAMES);
        }
        const serveResult = await serve({ k: 3, base: '/knn' }, dao, trainLabeledFeatures);
        if (serveResult.hasErrors) panic(serveResult);
        const app = serveResult.val;
        const serverOpts = {
            //key: fs.readFileSync(config.https.keyPath),
            //cert: fs.readFileSync(config.https.certPath),
        };
        https.createServer(serverOpts, app)
            .listen(2345, function() {
                console.log(`listening on port ${2345}`);
            });
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        //this runs even when http server still running, need to
        //keep dao open
        //if (dao) await dao.close();
    }
}

function usage() {
    const msg = `
    usage: ${Path.basename(process.argv[1])} CONFIG_PATH [MNIST_DATA_DIR]
  `.trim();
    console.error(msg);
    process.exit(1);
}

/**************************** Loading Data *****************************/

async function loadData(dir, filePaths) {
    const readFile = util.promisify(fs.readFile);
    const data = {};
    for (const t of Object.keys(filePaths)) {
        const path = Path.join(dir, filePaths[t]);
        try {
            const bytes = await readFile(path);
            data[t] = bytes;
        } catch (err) {
            console.error(`unable to read ${path}: ${err.message}`);
            process.exit(1);
        }
    }
    const parseResult = parseImages(MNIST_HEADERS, data);
    if (parseResult.hasErrors) panic(parseResult);
    return parseResult.val;
}

/****************************** Utilities ******************************/

function panic(errResult) {
    assert(errResult.hasErrors);
    for (const err of errResult.errors) {
        console.error(err.message);
    }
    process.exit(1);
}


function getPort(portStr) {
    let port;
    if (!/^\d+$/.test(portStr) || (port = Number(portStr)) < 1024) {
        usageError(`bad port ${portStr}: must be >= 1024`);
    }
    return port;
}