import { find, filter } from 'lodash/fp';
import { Bitstream, Metadata } from './dspace-schemas';

/**
 * Returns an array of metadata items that match the given key.
 * @param metadataItems - List of metadata to search.
 * @param key - The key for the metadata items to find.
 *
 * @returns An array with metadata items for the given key.
 * If no metadata items match the key an empty array is returned.
 */
export const findMetadataItems = (
  metadataItems: Metadata[],
  key: string
): Metadata[] => filter({ key }, metadataItems);

/**
   * Bitstream item that represents the thumbnail.
   * @param bitstreams - List of bitstreams to search.
   * @returns The bitstream item for the thumbnail or undefined
   * if none is found.
   */
export const findThumbnailBitstreamItem = find<Bitstream>(
  {
    bundleName: 'THUMBNAIL',
    mimeType: 'image/jpeg',
  }
);

/**
   * Bitstream item that represents the source PDF.
   * @param bitstreams - List of bitstreams to search.
   * @returns The bitstream item for the PDF or undefined if none is found.
   */
export const findPDFBitstreamItem = find<Bitstream>(
  {
    bundleName: 'ORIGINAL',
    mimeType: 'application/pdf',
  }
);

const lastModifiedRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

/**
 * There are cases where DSpace is giving us an invalid timestamp string. The
 * milliseconds field should be three digits, but some DSpace values only
 * contain one milliseconds digit. For example: `2021-08-24 17:36:38.7`
 *
 * Because that value can't be trusted, we are setting all values to have a ms
 * of `000`.
 *
 * @param x - Possible last modified date as string
 * @returns - Normalized last modified date as string
 */
export const normalizeLastModified = (x: string): string => {
  const match = x.match(lastModifiedRegex);

  if (match === null) throw new TypeError(`Invalid lastModified: ${x}`);

  return `${match[0]}.000`;
};
