/* eslint-disable no-underscore-dangle */
import { z } from 'zod';
import pMap from 'p-map';
import * as osClient from '../../lib/open-search-client';
import {
  Bitstream,
  DSpaceItem,
  dspaceItemSchema,
  Metadata,
} from '../../lib/dspace-schemas';
import { documentItemSchema } from '../../lib/open-search-schemas';

import {
  findMetadataItems,
  findThumbnailBitstreamItem,
  normalizeLastModified,
} from '../../lib/dspace-item';
import * as s3Utils from '../../lib/s3-utils';
import { deleteMessage, receiveMessage, SqsMessage } from '../../lib/sqs-utils';

export const getDSpaceItemFields = async (
  dspaceItemBucket: string,
  dspaceItemKey: string
): Promise<DSpaceItem> => {
  const s3Location = new s3Utils.S3ObjectLocation(
    dspaceItemBucket,
    dspaceItemKey
  );

  const { lastModified, ...fields } = await s3Utils.safeGetObjectJson(
    s3Location,
    dspaceItemSchema
  );

  return {
    lastModified: normalizeLastModified(lastModified),
    ...fields,
  };
};

interface BitstreamTextSource {
  bitstreamText: string
  bitstreamTextKey: string
}

export const getBitstreamTextSource = async (
  bitstreamTextBucket: string,
  bitstreamTextKey: string
): Promise<BitstreamTextSource> => {
  const bitstreamText = await s3Utils.getObjectText(
    new s3Utils.S3ObjectLocation(bitstreamTextBucket, bitstreamTextKey)
  );

  return {
    bitstreamText,
    bitstreamTextKey,
  };
};

type MetadataSearchFields = Record<string, string | string[]>;

export const getMetadataSearchFields = (
  metadata: Metadata[]
): MetadataSearchFields => {
  const searchFields: MetadataSearchFields = {};

  for (const m of metadata) {
    const key = m.key.replace(/\./g, '_');

    const searchFieldValue = searchFields[key];
    searchFields[key] = searchFieldValue !== undefined
      ? [searchFieldValue, m.value].flat()
      : m.value;
  }

  return searchFields;
};

export interface PrimaryAuthor {
  primaryAuthor: string
}

export const getPrimaryAuthor = (
  metadata: Metadata[]
): PrimaryAuthor | undefined => {
  const [primaryAuthor] = findMetadataItems(metadata, 'dc.contributor.author');
  if (primaryAuthor) {
    return {
      primaryAuthor: primaryAuthor.value,
    };
  }

  return undefined;
};

interface ThumbnailRetrieveLink {
  thumbnailRetrieveLink: string
}

export const getThumbnailRetrieveLink = (
  bitstreams: Bitstream[]
): ThumbnailRetrieveLink | undefined => {
  const thumbnailBitstream = findThumbnailBitstreamItem(bitstreams);
  if (thumbnailBitstream) {
    return {
      thumbnailRetrieveLink: thumbnailBitstream.retrieveLink,
    };
  }

  return undefined;
};

export const getTerms = async (
  openSearchEndpoint: string,
  percolateFields: { title: string, contents: string }
) => {
  const terms = await osClient.percolateDocumentFields(
    openSearchEndpoint,
    'terms',
    percolateFields
  );

  return {
    terms,
  };
};

const createIndexes = (esUrl: string) => Promise.all([
  osClient.createDocumentsIndex(esUrl, 'documents'),
  osClient.createTermsIndex(esUrl, 'terms'),
]);

interface Config {
  esUrl: string;
  dspaceItemBucket: string;
  indexerQueueUrl: string;
}

const getMessages = async (queueUrl: string): Promise<SqsMessage[]> =>
  receiveMessage(queueUrl).then((r) => r.Messages);

const ingestRecordSchema = z.object({
  uuid: z.string().uuid(),
  bitstreamTextBucket: z.string().min(1).optional(),
  bitstreamTextKey: z.string().min(1).optional(),
});

type IndexerRequest = z.infer<typeof ingestRecordSchema>;

const index = async (
  ingestRecord: IndexerRequest,
  dspaceItemBucket: string,
  openSearchEndpoint: string
): Promise<void> => {
  console.log(`INFO: Indexing from ingest record: ${JSON.stringify(ingestRecord)}`);

  // Get the DSpace item that starts this all off.
  const dspaceItem = await getDSpaceItemFields(
    dspaceItemBucket,
    `${ingestRecord.uuid}.json`
  );

  // Get the PDF source if it exists.
  let bitstreamSource: BitstreamTextSource | undefined;
  if (ingestRecord.bitstreamTextBucket && ingestRecord.bitstreamTextKey) {
    bitstreamSource = await getBitstreamTextSource(
      ingestRecord.bitstreamTextBucket,
      ingestRecord.bitstreamTextKey
    );
  }

  // Promote the metadata fields to make search easier. Since the metadata
  // is dynamic we validate that the dc.title field exists.
  // TODO: As we add explicit search fields we could turn this into a type.
  const metadataSearchFields = z.object({ dc_title: z.string() })
    .catchall(z.unknown())
    .parse(getMetadataSearchFields(dspaceItem.metadata));

  const primaryAuthor = getPrimaryAuthor(dspaceItem.metadata);

  // Get the thumbnail retrieve link to make it easier for the UI to render
  // search results.
  const thumbnailRetrieveLink = getThumbnailRetrieveLink(
    dspaceItem.bitstreams
  );

  // Get terms.
  const title = metadataSearchFields.dc_title;
  const contents = bitstreamSource?.bitstreamText || '';
  const terms = await getTerms(
    openSearchEndpoint,
    {
      title,
      contents,
    }
  );

  const { uuid } = dspaceItem;
  const termNames = terms.terms.map((t) => t.label);
  console.log(`${uuid} matched terms ${JSON.stringify(termNames)}`);

  const documentItem = documentItemSchema.parse({
    ...dspaceItem,
    ...bitstreamSource,
    ...metadataSearchFields,
    ...primaryAuthor,
    ...thumbnailRetrieveLink,
    ...terms,
  });

  // Index our document item.
  await osClient.putDocumentItem(openSearchEndpoint, documentItem);

  console.log(`INFO: Indexed document item ${documentItem.uuid}`);
};

const parseSqsMessageBody = (body: string): IndexerRequest =>
  ingestRecordSchema.parse(JSON.parse(body));

interface SqsMessageHandlerConfig {
  dspaceItemBucket: string,
  esUrl: string,
  indexerQueueUrl: string
}

const sqsMessageHandler = async (
  config: SqsMessageHandlerConfig,
  sqsMessage: SqsMessage
) => {
  const ingestRecord = parseSqsMessageBody(sqsMessage.Body);

  await index(ingestRecord, config.dspaceItemBucket, config.esUrl);

  await deleteMessage(config.indexerQueueUrl, sqsMessage.ReceiptHandle);
};

const processIndexerQueue = async (config: Config): Promise<void> => {
  await createIndexes(config.esUrl);

  let messages: SqsMessage[];
  do {
    /* eslint-disable no-await-in-loop */
    messages = await getMessages(config.indexerQueueUrl);

    await pMap(
      messages,
      sqsMessageHandler.bind(undefined, config),
      { concurrency: 1 }
    );
    /* eslint-enable no-await-in-loop */
  } while (messages.length > 0);
};

const envSchema = z.object({
  DOCUMENT_METADATA_BUCKET: z.string().min(1),
  OPEN_SEARCH_ENDPOINT: z.string().url(),
  INDEXER_QUEUE_URL: z.string().url(),
});

const loadConfigFromEnv = (): Config => {
  const env = envSchema.parse(process.env);

  return {
    dspaceItemBucket: env.DOCUMENT_METADATA_BUCKET,
    esUrl: env.OPEN_SEARCH_ENDPOINT,
    indexerQueueUrl: env.INDEXER_QUEUE_URL,
  };
};

export const handler = async () => {
  const config = loadConfigFromEnv();

  await processIndexerQueue(config);
};
