import parseImages from './parse-images.mjs';
import knn from './knn.mjs';

import { ok, err } from 'cs544-js-utils';

import fs from 'fs';
import Path from 'path';
import util from 'util';

/**************************** main program *****************************/

const FILE_NAMES = {
  training: {
    images: 'train-images-idx3-ubyte',
    labels: 'train-labels-idx1-ubyte',
  },
  test: {
    images: 't10k-images-idx3-ubyte',
    labels: 't10k-labels-idx1-ubyte',
  }
};

const MNIST_HEADERS = {
  images: [
    { name: 'magic',
      value: 0x803,
    },
    { name: 'nImages',
    },
    { name: 'nRows',
      value: 28,
    },
    { name: 'nCols',
      value: 28,
    },
  ],
  labels: [
    { name: 'magic',
      value: 0x801,
    },
    { name: 'nLabels',
    },
  ],
};

export default async function main() {
  const argsResult = getArgs(process.argv.slice(2));
  if (argsResult.hasErrors) { panic(argsResult); usage(); }
  const [ options, args ] = argsResult.val;
  if (args.length !== 1 || options.help) usage();
  const dir = args[0];

  const data = await loadData(dir, FILE_NAMES);

  const testResult = parseImages(MNIST_HEADERS, data.test);
  if (testResult.hasErrors) panic(testResult);

  const trainResult = parseImages(MNIST_HEADERS, data.training);
  if (trainResult.hasErrors) panic(trainResult);

  doKnn(testResult.val, trainResult.val, options);
}

function doKnn(testLabeledImages, trainLabeledImages, options) {
  const { k, index0, index1, verbose, } = options;
  const incorrects = [];
  const n = index1 - index0;
  let nOk = 0;
  const msg = (testIndex, testLabel, trainIndex, trainLabel) =>
	`${testIndex.toString().padStart(5)} '${testLabel}': ` +
	`${trainIndex.toString().padStart(6)} '${trainLabel}'`;
  let out = msg => console.log(msg);
  for (let i = index0; i < index1; i++) {
    const { features, label } = testLabeledImages[i];;
    const labelIndexResult = knn(features, trainLabeledImages, k);
    if (labelIndexResult.hasErrors) panic(labelIndexResult);
    const [label1, trainIndex] = labelIndexResult.val;
    if (label === label1) {
      if (verbose) out(' ' + msg(i, label, trainIndex, label1));
      nOk++;
    }
    else {
      out('*' + msg(i, label, trainIndex, label1));
    }
  }
  out(`${(nOk*100/n).toFixed(2)}% ok`);
}


/************************** Command-Line Args **************************/

//crude options handling to avoid using external dependencies

const DEFAULT_N_TESTS = 200;
const OPTIONS = {
  'k': {
    arg: 'K',
    help: `
      hyper-parameter for KNN algorithm (default: 3)
    `.replace(/\s+$/, ''),
  },
  index0: {
    arg: 'INDEX0',
    default: 0,
    help: `
      index of first test image to be classified (default: 0)
    `.replace(/\s+$/, ''),
  },
  index1: {
    arg: 'INDEX1',
    default: -1,
    help: `
      index one beyond that of last test image to be classified 
      (default: index0 + ${DEFAULT_N_TESTS})
    `.replace(/\s+$/, ''),
  },
  verbose: {
    help: `
      report classification result for every test image
    `.replace(/\s+$/, ''),
  },
  help: {
    help: `
      print this help message
    `.replace(/\s+$/, ''),
  },
}


function getArgs(args) {
  const opts = { };
  let i;
  for (i = 0; i < args.length; i++) {
    const arg = args[i];
    let m = arg.match(/^--(\w+)(?:=(\w+))?/);
    if (!m) break;
    const [name, value] = [m[1], m[2]];
    if (!OPTIONS[name]) return err(`unknown option ${arg}`);
    const val = (value === undefined) ? true : parseInt(value);
    opts[name] = val;
  }
  const defaults = {
    'k-hyper-param': 3, index0: 0, index1: -1, help: false, verbose: false,
  };
  const options = { ...defaults, ...opts };
  if (options.index1 < 0) options.index1 = options.index0 + DEFAULT_N_TESTS;
  return ok([options, args.slice(i)]);
}

function usage() {
  const optsHelp = Object.entries(OPTIONS).map(([k, {arg, help}]) => {
    return `    --${k}${arg ? '=' + arg : ''}` + help;
  }).join('\n');
  const msg = `
    usage: ${Path.basename(process.argv[1])} [OPTIONS] MNIST_DATA_DIR
    where OPTIONS are:
  `.trim() + '\n' + optsHelp;
  console.error(msg);
  process.exit(1);
}

/**************************** Loading Data *****************************/

async function loadData(dir, filePaths) {
  const readFile = util.promisify(fs.readFile);
  const data = {};
  for (const type of Object.keys(filePaths)) {
    data[type] = {};
    for (const t of Object.keys(filePaths[type])) {
      const path = Path.join(dir, filePaths[type][t]);
      try {
	const bytes = await readFile(path);
	data[type][t] = bytes;
      }
      catch (err) {
	console.error(`unable to read ${path}: ${err.message}`);
	process.exit(1);	  
      }
    }
  }
  return data;
}

/****************************** Utilities ******************************/

function panic(errResult) {
  console.assert(errResult.hasErrors);
  for (const err of errResult.errors) {
    console.error(err.message);
  }
  process.exit(1);
}