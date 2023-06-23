import { MongoClient, ObjectId } from 'mongodb';
import { ok, err } from 'cs544-js-utils';

import { b64ToUint8Array, uint8ArrayToB64 } from './uint8array-b64.mjs';

class DAO {

    static async instantiate(url) {
        this.client = new MongoClient(url);
        try {
            let connections = await this.client.connect();
            if (connections) {
                this.db = this.client.db("myDatabase");
                return [this, true]
            } else {
                return ["No Connection established", false]
            }
        } catch (error) {
            return [error, false]
        }

    }
    static async getNewID(data) {
        const featureCollection = this.db.collection("features");
        try {
            const count = await featureCollection.estimatedDocumentCount();
            var newId = count + 1;
            var name = data + "_" + newId;
            return name;
        } catch (error) {
            return null;
        }
    }
    static async add(feature, base64, label) {
        var response = await DAO.getNewID("tiHs_K3Y");
        if (!response) {
            return err("Error Occured", { code: 'NAME_ERR' });
        }
        if (base64) {
            await this.db.collection("features").insertOne({ _id: response, feature: feature, label: label }).catch(errors => {
                return err(errors, { code: 'INSRT_ERROR' });
            });
            return ok(response);

        } else {
            await this.db.collection("features").insertOne({ _id: response, feature: uint8ArrayToB64(feature), label: label }).catch(errors => {
                err(errors, { code: 'INSRT_ERROR' })
            });
            return ok(response)
        }

    }

    static async clear() {
        let exists = await this.db.listCollections({ name: "features" }).hasNext()
        if (exists) {
            try {
                await this.db.collection("features").deleteMany({})
                return ok("Data has been cleared.")
            } catch (error) {
                return err(error, { code: 'EXP_THROW' })
            }
        } else {
            return err("No collection found named features", { code: 'INVALID_COLLECTION' })
        }

    }
    static async close() {
        await this.client.close()
    }
    static async getAllTrainingFeatures() {
        try {
            let trainingFeatures = await this.db.collection("features").find({ "label": { $exists: true, $ne: null } }).toArray();
            return ok(trainingFeatures)
        } catch (error) {
            return err(error, { code: 'EXP_THROW' })
        }

    }
    static async get(id, base64) {
        if (base64) {
            try {
                let response = await this.db.collection("features").findOne({ _id: id });
                if (response !== null && response !== undefined) {
                    return ok({ features: response.feature, label: response.label })

                } else {
                    return err("No Data Found", { code: "NOT_FOUND" })
                }
            } catch (error) {
                return err(error, { code: 'EXP_THROW' })
            }

        } else {
            try {
                let response = await this.db.collection("features").findOne({ _id: id });
                if (response !== null && response !== undefined) {
                    return ok({ features: b64ToUint8Array(response.feature), label: response.label })

                } else {
                    return err("No Data Found", { code: "NOT_FOUND" })
                }
            } catch (error) {
                return err(error, { code: 'EXP_THROW' })
            }

        }
    }
}

export default async function makeFeaturesDao(dbUrl) {
    let [dbClient, status] = await DAO.instantiate(dbUrl)
    if (status) {
        return ok(dbClient);
    } else {
        return err(dbClient, { code: "CONNECTION_ERROR" });
    }

}