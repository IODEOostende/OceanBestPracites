const bulkIngester = require('./bulk-ingester');

const handler = async () => bulkIngester(
  process.env.DSPACE_ENDPOINT,
  process.env.INGEST_TOPIC_ARN
);

module.exports = handler;