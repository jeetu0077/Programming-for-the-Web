//will run the project DAO using an in-memory mongodb server
import FeaturesDao from './features-mem-dao.mjs';
import { uint8ArrayToB64, b64ToUint8Array } from '../src/uint8array-b64.mjs';

import chai from 'chai';
const { expect } = chai;

describe('features DAO', () => {

    //mocha will run beforeEach() before each test to set up these variables
    let dao;
    beforeEach(async function() {
        dao = await FeaturesDao.setup();
    });

    //mocha runs this after each test; we use this to clean up the DAO.
    afterEach(async function() {
        await FeaturesDao.tearDown(dao);
    });

    it('should add features without any errors', async() => {
        const features = new Uint8Array([0, 2, 4, 5, 255]);
        const result = await dao.add(features, false);
        expect(result.hasErrors).to.equal(false);
        expect(result.val).to.be.a('string');
    });

    it('should retrieve previously added features', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            const result = await dao.add(new Uint8Array(features), false, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(LABELED_FEATURES_LIST.length);
        for (const [i, id] of ids.entries()) {
            const result = await dao.get(id);
            expect(result.hasErrors).to.equal(false);
            const { features, label } = result.val;
            expect(features).to.be.instanceof(Uint8Array);
            const labeledFeatures = LABELED_FEATURES_LIST[i];
            expect(Array.from(features)).to.deep.equal(labeledFeatures.features);
            expect(label).to.equal(labeledFeatures.label);
        }
    });

    it('should retrieve Uint8Array features as base64', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            const result = await dao.add(new Uint8Array(features), false, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(LABELED_FEATURES_LIST.length);
        for (const [i, id] of ids.entries()) {
            const result = await dao.get(id, true);
            expect(result.hasErrors).to.equal(false);
            const { features, label } = result.val;
            expect(features).to.be.a('string');
            const labeledFeatures = LABELED_FEATURES_LIST[i];
            expect(Array.from(b64ToUint8Array(features)))
                .to.deep.equal(labeledFeatures.features);
            expect(label).to.equal(labeledFeatures.label);
        }
    });

    it('should retrieve added base-64 features as base64', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            const b64Features = uint8ArrayToB64(new Uint8Array(features));
            const result = await dao.add(b64Features, true, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(LABELED_FEATURES_LIST.length);
        for (const [i, id] of ids.entries()) {
            const result = await dao.get(id, true);
            expect(result.hasErrors).to.equal(false);
            const { features, label } = result.val;
            expect(features).to.be.a('string');
            const labeledFeatures = LABELED_FEATURES_LIST[i];
            expect(Array.from(b64ToUint8Array(features)))
                .to.deep.equal(labeledFeatures.features);
            expect(label).to.equal(labeledFeatures.label);
        }
    });

    it('should retrieve added base-64 features as Uint8Array', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            const b64Features = uint8ArrayToB64(new Uint8Array(features));
            const result = await dao.add(b64Features, true, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(LABELED_FEATURES_LIST.length);
        for (const [i, id] of ids.entries()) {
            const result = await dao.get(id, false);
            expect(result.hasErrors).to.equal(false);
            const { features, label } = result.val;
            const test = result.val;
            expect(features).to.be.instanceof(Uint8Array);
            const labeledFeatures = LABELED_FEATURES_LIST[i];
            expect(Array.from(features)).to.deep.equal(labeledFeatures.features);
            expect(label).to.equal(labeledFeatures.label);
        }
    });

    it('should return NOT_FOUND errors for incorrect id\'s', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            const result = await dao.add(new Uint8Array(features), false, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(LABELED_FEATURES_LIST.length);
        for (const id of ids) {
            const result = await dao.get(id + 'x');
            expect(result.hasErrors).to.equal(true);
            expect(result.errors[0].options.code).to.equal('NOT_FOUND');
        }
    });

    it('should retrieve training data set', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            let result = await dao.add(new Uint8Array(features), false, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
            result = await dao.add(new Uint8Array(features), false);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(2 * LABELED_FEATURES_LIST.length);
        const trainResult = await dao.getAllTrainingFeatures();
        expect(trainResult.hasErrors).to.equal(false);
        const train = trainResult.val;
        expect(train.length).to.equal(LABELED_FEATURES_LIST.length);
        const xtrain =
            train.map(e => ({ features: Array.from(e.features), label: e.label }));
        expect(xtrain).to.have.deep.members(LABELED_FEATURES_LIST);
    });


    it('should not retrieve features after clear', async() => {
        let ids = [];
        for (const { features, label }
            of LABELED_FEATURES_LIST) {
            let result = await dao.add(new Uint8Array(features), false, label);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
            result = await dao.add(new Uint8Array(features), false);
            expect(result.hasErrors).to.equal(false);
            ids.push(result.val);
        }
        expect(ids.length).to.equal(2 * LABELED_FEATURES_LIST.length);
        let clear = await dao.clear();
        for (const [i, id] of ids.entries()) {
            const result = await dao.get(id);
            expect(result.hasErrors).to.equal(true);
        }
    });

});

const LABELED_FEATURES_LIST = [
    { features: [0, 2, 54, 3, 5], label: 'a', },
    { features: [0, 5, 10, 222, 244, 255], label: 'b', },
    { features: [3, 3, 99, 111, 222, 0, 88, 77, ], label: 'c', },
    { features: [], label: 'd', },
    { features: Array.from({ length: 256 }).map((_, i) => i), label: 'a', },
];