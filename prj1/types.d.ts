//note Result below refers to Result defined in
//in the course file lib/cs544-js-utils/src/errors.d.ts

/** Different kinds of headers */
type HeaderName = 'magic' | 'nImages' | 'nLabels' | 'nRows' | 'nCols';

type HeaderSpec = {
  name: HeaderName;          /** name of header */
  /** if specified below, then the header value in the byte stream
   *  interpreted as a 32-bit big-endian must equal this value.
   */
  value?: number;
};

type ImagesLabelsSpecs = {
  images: HeaderSpec[];  /** specifies magic, nImages, nRows, nCols */
  labels: HeaderSpec[];  /** specifies magic, nLabels */
};

/** bytes (including headers) for images and labels */
type ImagesLabelsBytes = {
  images: Uint8Array;
  labels: Uint8Array;
};

type Features = Uint8Array;
type Label = string;

type LabeledFeatures = {
  features: Features;
  label : Label;
};

/** parse byte streams in bytes as per specs to return a list
 *  of LabeledFeatures (wrapped within a Result).
 *
 *  Errors:
 *    BAD_VAL: value in byte stream does not match value specified
 *             in spec.
 *    BAD_FMT: size of bytes stream inconsistent with headers
 *             or # of images not equal to # of labels.
 */
declare function
  parseImages(specs: ImagesLabelsSpecs, bytes: ImagesLabelsBytes) :
    Result<LabeledFeatures[]>;

type TrainIndex = number;

/** return pair [label, index] (wrapped within a Result) of the
 *  training LabeledFeatures train having the most common label of
 *  the k training features closest to subject.
 *
 *  Errors:
 *    BAD_FMT: train has features bytes with length different
 *             from length of subject.
 */
declare function
  knn(subject: Features, train: LabeledFeatures[],  k: number)
    : Result<[Label, TrainIndex]>;