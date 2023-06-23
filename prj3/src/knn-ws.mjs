import cors from 'cors';
import express from 'express';
import bodyparser from 'body-parser';
import assert from 'assert';
import STATUS from 'http-status';

import { ok, err } from 'cs544-js-utils';
import { knn } from 'prj1-sol';
import { uint8ArrayToB64, b64ToUint8Array } from 'prj2-sol';

import fs from 'fs';
import http from 'http';
import https from 'https';

export const DEFAULT_COUNT = 5;

/** Start KNN server.  If trainData is specified, then clear dao and load
 *  into db before starting server.  Return created express app
 *  (wrapped within a Result).
 *  Types described in knn-ws.d.ts
 */
export default async function serve(knnConfig, dao, data) {
    try {
        const app = express();

        //TODO: squirrel away knnConfig params and dao in app.locals.

        app.locals.base = knnConfig.base;
        app.locals.k = knnConfig.k;
        app.locals.dao = dao;
    
        if (data) {

            //TODO: load data into dao

            for (const item of data) {
                const result = await dao.add(item.features, false, item.label);
                if (result.hasErrors) throw result;
            }
        }

        //TODO: get all training results from dao and squirrel away in app.locals

        const result = await dao.getAllTrainingFeatures();
        if (result.hasErrors) throw result;
        app.locals.trainings = result.val;
        
        //set up routes
        setupRoutes(app);

        return ok(app);
    } catch (e) {
        return err(e.toString(), { code: 'INTERNAL' });
    }
}


function setupRoutes(app) {
    const base = app.locals.base;
    app.use(cors({ exposedHeaders: 'Location' }));
    app.use(express.json({ strict: false })); //false to allow string body
    //app.use(express.text());

    //uncomment to log requested URLs on server stderr
    //app.use(doLogRequest(app));

    //TODO: add knn routes here

    app.post(`${base}/images`, doAddFeature(app))
    app.get(`${base}/labels/:id`, doGetKnn(app))
    app.get(`${base}/images/:id`, doGetFeature(app))

    //must be last
    app.use(do404(app));
    app.use(doErrors(app));
}


//dummy handler to test initial routing and to use as a template
//for real handlers.  Remove on project completion.
/*function dummyHandler(app) {
    return (async function (req, res) {
        try {
            res.json({ status: 'TODO' });
        } catch (err) {
            const mapped = mapResultErrors(err);
            res.status(mapped.status).json(mapped);
        }
    });
}*/

function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

//TODO: add real handlers
function doAddFeature(app) {
    return (async function (req, res) {
        try {
            if (isEmpty(req.body))
            {
                throw err("Invalid Request", { code: 'INTERNAL' });
            }
            const featureArr = req.body;
            const dao = app.locals.dao;
            const result = await dao.add(featureArr, true);

            if (result.hasErrors) throw result;

            res.status(STATUS.OK).json({ id: result.val });

        } catch (err) {
            const mapped = mapResultErrors(err);
            res.status(mapped.status).json(mapped);
        }
    });
}

function doGetFeature(app) {
    return (async function (req, res) {
        try {
            const featureId = req.params.id;
            const dao = app.locals.dao;

            if (featureId.length <= 0) {
                throw err("Invalid Request", { code: 'INTERNAL' });
            }
        
            const result = await dao.get(featureId, true);
            if (result.hasErrors) throw result;

            res.status(STATUS.OK).json(result.val);

        } catch (err) {
            const mapped = mapResultErrors(err);
            res.status(mapped.status).json(mapped);
        }
    });
}
function doGetKnn(app) {
    return (async function (req, res) {
        try {
            const featureId = req.params.id;
            const k = req.query.k ?? app.locals.k;
            const dao = app.locals.dao;

            const result = await dao.get(featureId, true);

            if (result.hasErrors) throw result;

            const trains = await dao.getAllTrainingFeatures();

            if (trains.hasErrors) throw trains;

            const knne = knn(b64ToUint8Array(result.val.features), trains.val, k);
            if (knne.hasErrors) throw knne;

            res.status(STATUS.OK).json({ id: trains.val[knne.val[1]].id,label: knne.val[0]});

        } catch (err) {
            const mapped = mapResultErrors(err);
            res.status(mapped.status).json(mapped);
        }
    });
}



/** Handler to log current request URL on stderr and transfer control
 *  to next handler in handler chain.
 */
function doLogRequest(app) {
    return (function (req, res, next) {
        console.error(`${req.method} ${req.originalUrl}`);
        next();
    });
}

/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
    return async function (req, res) {
        const message = `${req.method} not supported for ${req.originalUrl}`;
        const result = {
            status: STATUS.NOT_FOUND,
            errors: [{ options: { code: 'NOT_FOUND' }, message, },],
        };
        res.status(404).json(result);
    };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */
function doErrors(app) {
    return async function (err, req, res, next) {
        const message = err.message ?? err.toString();
        const result = {
            status: STATUS.INTERNAL_SERVER_ERROR,
            errors: [{ options: { code: 'INTERNAL' }, message }],
        };
        res.status(STATUS.INTERNAL_SERVER_ERROR).json(result);
        console.error(result.errors);
    };
}

/*************************** Mapping Errors ****************************/

//map from domain errors to HTTP status codes.  If not mentioned in
//this map, an unknown error will have HTTP status BAD_REQUEST.
const ERROR_MAP = {
    EXISTS: STATUS.CONFLICT,
    NOT_FOUND: STATUS.NOT_FOUND,
    AUTH: STATUS.UNAUTHORIZED,
    DB: STATUS.INTERNAL_SERVER_ERROR,
    INTERNAL: STATUS.INTERNAL_SERVER_ERROR,
}

/** Return first status corresponding to first options.code in
 *  errors, but SERVER_ERROR dominates other statuses.  Returns
 *  BAD_REQUEST if no code found.
 */
function getHttpStatus(errors) {
    let status = null;
    for (const err of errors) {
        const errStatus = ERROR_MAP[err.options?.code];
        if (!status) status = errStatus;
        if (errStatus === STATUS.SERVER_ERROR) status = errStatus;
    }
    return status ?? STATUS.BAD_REQUEST;
}

/** Map domain/internal errors into suitable HTTP errors.  Usually,
 * the err argument should be a Result; if not, this functions makes
 * a best attempt to come up with reasonable error messsages.
 * Return'd object will have a "status" property corresponding to
 * HTTP status code.
 */
function mapResultErrors(err) {
    //if Error, then dump as much info as possible to help debug cause of problem
    if (err instanceof Error) console.error(err);
    const errors = err.errors ?? [{ message: err.message ?? err.toString() }];
    const status = getHttpStatus(errors);
    if (status === STATUS.INTERNAL_SERVER_ERROR) console.error(errors);
    return { status, errors, };
}