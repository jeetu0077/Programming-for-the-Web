import { ok, err } from 'cs544-js-utils';

export default function makeKnnWsClient(wsUrl) {
  return new KnnWsClient(wsUrl);
}

class KnnWsClient {
  constructor(wsUrl) {
    
    //TODO
    this.url = wsUrl + '/knn';
    this.imgUrl = this.url + '/images';
    this.labelUrl = this.url + '/labels/';
  }

  /** Given a base64 encoding b64Img of an MNIST compatible test
   *  image, use web services to return a Result containing at least
   *  the following properties:
   *
   *   `label`: the classification of the image.
   *   `id`: the ID of the training image "closest" to the test
   *         image.
   * 
   *  If an error is encountered then return an appropriate
   *  error Result.
   */
  async classify(b64Img) {
    
    //TODO

    try {
      let res = await fetch(this.imgUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: b64Img
      })
      let resJson = await res.json();
      if (resJson.errors) {
        return this.wsError(resJson)
      } else {
        let foundRe = await fetch(this.labelUrl + resJson.id)
        let foundJson = await foundRe.json();
        if (foundJson.errors) {
          return this.wsError(foundJson)
        } else {
          return ok(foundJson);
        }
      }

    } catch (error) {
      return err(error.toString(), { code: 'CONNECTION' });
    }
  }

  /** Return a Result containing the base-64 representation of
   *  the image specified by imageId.  Specifically, the success
   *  return should be an object containing at least the following
   *  properties:
   *
   *   `features`:
   *     A base-64 representation of the retrieved image bytes.
   *   `label`:
   *     The label associated with the image (if any).
   *
   *  If an error is encountered then return an appropriate
   *  error Result.
   */
  async getImage(imageId) {
    //TODO
  }

  /** convert an erroneous JSON web service response to an error Result. */
  wsError(jsonRes) {
    return err(jsonRes.errors[0].message, jsonRes.errors[0].options);
  }

}