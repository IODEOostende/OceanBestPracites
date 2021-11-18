// @ts-check
const { HttpRequest } = require('@aws-sdk/protocol-http');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler');
const { Sha256 } = require('@aws-crypto/sha256-browser');

/**
 * @typedef {import('./dspace-types').OpenSearchOpenScrollResponse} OpenSearchOpenScrollResponse
 */

/**
 * Signs and executes a request against Open Search. This code
 * was copied (mostly) from https://docs.aws.amazon.com/opensearch-service/latest/developerguide/request-signing.html#request-signing-node
 *
 * @param {string} endpoint Open Search endpoint.
 * @param {string} path Path of the Open Search request.
 * @param {Object} body Body of the Open Search request.
 * @param {Object} [options={}] Options to configure the request..
 * @param {string} [options.method='GET'] HTTP method to use for the request.
 * @param {string} [options.region='us-east-1'] Region in which the Open Search
 * cluster exists.
 *
 * @returns {Promise<Object>} Open Search response for the given request.
 */
const signAndRequest = async (endpoint, path, body, options = {}) => {
  const {
    method = 'GET',
    region = 'us-east-1',
  } = options;

  const url = new URL(endpoint);

  // Create the HTTP request
  const request = new HttpRequest({
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      host: url.hostname,
    },
    hostname: url.hostname,
    port: url.port === '' ? undefined : Number.parseInt(url.port),
    method,
    path,
  });

  // Sign the request
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: 'es',
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  // Send the request
  const client = new NodeHttpHandler();
  // @ts-ignore
  const { response } = await client.handle(signedRequest);
  console.log(`${response.statusCode} ${response.body.statusMessage}`);
  let responseBody = '';
  await new Promise((resolve, reject) => {
    response.body.on('data', (chunk) => {
      responseBody += chunk;
    });

    response.body.on('end', () => {
      console.log(`Response body: ${responseBody}`);
      resolve(responseBody);
    });

    response.on('error');
  });

  return JSON.parse(responseBody);
};

module.exports = {
  /**
   * Queries OpenSearch for all items and returns them while also
   * opening a scroll.
   * See https://opensearch.org/docs/latest/opensearch/rest-api/scroll/
   * for more details.
   *
   * @param {string} endpoint Open Search endpoint.
   * @param {string} index Name of the index to query.
   * @param {Object} [options={}] Options to the request.
   * @param {Object} [options.includes=['*']] List of index fields
   * to include in response to the query.
   * @param {string} [options.region='us-east-1'] Region in which the
   * Open Search index exists.
   * @param {number} [options.scrollTimeout=60] Specifies the amount of
   * time the search context is maintained.
   * @param {number} [options.size=500] Number of results to include in a
   * a query response.
   *
   * @returns {Promise<OpenSearchOpenScrollResponse>} Open Search query
   * results including a scroll ID.
   */
  openScroll: async (endpoint, index, options = {}) => {
    const {
      includes = ['*'],
      region = 'us-east-1',
      scrollTimeout = 60,
      size = 500,
    } = options;

    const body = {
      _source: {
        includes,
      },
      size,
    };

    return signAndRequest(
      endpoint,
      `${index}/_search?scroll=${scrollTimeout}m`,
      body,
      { region }
    );
  },

  /**
   * Returns search results for an open Open Search scroll.
   * See https://opensearch.org/docs/latest/opensearch/rest-api/scroll/
   * for more details.
   *
   * @param {string} endpoint Open Search endpoint.
   * @param {string} scrollId Scroll ID of the open scroll.
   * @param {Object} [options={}] Options to the request.
   * @param {string} [options.region='us-east-1'] Region in which the Open
   * Search cluster exists.
   * @param {number} [options.scrollTimeout=60] Specifies the amount of time the
   * search context is maintained.
   *
   * @returns {Promise<unknown>} Open Search query results including scroll ID.
   * The scroll ID in this response should always be used in future next
   * scroll requests.
   */
  nextScroll: async (endpoint, scrollId, options = {}) => {
    const {
      region = 'us-east-1',
      scrollTimeout = 60,
    } = options;

    const body = {
      scroll: `${scrollTimeout}m`,
      scroll_id: scrollId,
    };

    return signAndRequest(
      endpoint,
      '_search/scroll',
      body,
      { region }
    );
  },

  /**
   * Closes an open Open Search scroll query.
   * See https://opensearch.org/docs/latest/opensearch/rest-api/scroll/
   * for more details.
   *
   * @param {string} endpoint - Open Search endpoint.
   * @param {string} scrollId - Scroll ID of the open scroll.
   * @param {Object} [options={}] - Options to the request.
   * @param {string} [options.region='us-east-1'] - Region in which
   * the Open Search cluster exists.
   *
   * @returns {Promise<unknown>} Open Search close scroll response.
   */
  closeScroll: async (endpoint, scrollId, options = {}) => {
    const {
      region = 'us-east-1',
    } = options;

    return signAndRequest(
      endpoint,
      `_search/scroll/${scrollId}`,
      undefined,
      {
        method: 'DELETE',
        region,
      }
    );
  },

  /**
   * Deletes items from an Open Search index using the _bulk API.
   * See: https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
   *
   * @param {string} endpoint Open Search endpoint.
   * @param {string} index Name of the index where the items exist.
   * @param {string[]} ids List of IDs to delete.
   * @param {Object} [options={}] Options for the request.
   * @param {string} [options.region='us-east-1'] Region in which the Open
   * Search cluster exists.
   *
   * @returns {Promise<unknown>} Result of Open Search bulk delete.
   */
  bulkDelete: async (endpoint, index, ids, options = {}) => {
    const {
      region = 'us-east-1',
    } = options;

    const bulkData = ids.map((id) => ({
      delete: {
        _index: index,
        _type: '_doc',
        _id: id,
      },
    }));

    const body = `${bulkData.map((d) => JSON.stringify(d)).join('\n')}\n`;

    const params = {
      method: 'POST',
      region,
    };

    return signAndRequest(
      endpoint,
      '_bulk',
      body,
      params
    );
  },
};