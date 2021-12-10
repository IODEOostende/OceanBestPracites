/* eslint-disable camelcase */
import {
  DocumentSearchRequestBody,
  DocumentSearchRequestNestedQuery,
  DocumentSearchRequestQuery,
} from '../../lib/open-search-schemas';

export interface DocumentSearchRequestQueryOptions {
  keywords: string[]
  terms: string[]
  termURIs: string[]
  from: number,
  size: number,
  sort: string[],
  fields: string[],
  synonyms: boolean,
  refereed: boolean
}

export const nestedQuery = (
  termPhrase: Record<string, string>
): DocumentSearchRequestNestedQuery => ({
  nested: {
    path: 'terms',
    query: {
      bool: {
        must: {
          match_phrase: termPhrase,
        },
      },
    },
  },
});

export const buildSort = (sortParams: string[]): unknown => {
  const sort = sortParams.map((s) => {
    const [sortKey, sortDirection] = s.split(':');

    if (sortKey === undefined) { return undefined; }

    const param: Record<string, string> = {};
    param[sortKey] = sortDirection || 'desc';

    return param;
  }).filter((x) => x);

  return [...sort, '_score'];
};

/**
 * TODO: This function was unchanged (other than ignoring typescript errors) but
 * needs to be tested and updated.
 *
 * This function takes a valid keyword string and formats it specifically
 * for our Elasticsearch query. It's responsible for parsing logical operators
 * and inserting/removing any necessary or unnecessary quotes.
 *
 * e.g. "+ocean current" becomes "AND \"ocean current\""
 * */
export const formatKeyword = (k: string): string => {
  // Map the UI operators to ES operators.
  const opTransforms = {
    '+': 'AND',
    '-': 'NOT',
  };

  // Extract the operator from the keyword.
  let op = ''; let
    fk = k;
  if (Object.keys(opTransforms).includes(fk.slice(0, 1))) {
    // @ts-expect-error TODO: Review this when we add tests for this function.
    op = opTransforms[fk.slice(0, 1)];
    // eslint-disable-next-line unicorn/prefer-string-slice
    fk = fk.substring(1, fk.length);
  }

  // Strip all double quotes from the keyword since we're
  // performing a quoted query in ES.
  fk = fk.replace(/"/g, '');

  // Optional: try splitting the search term on a space. If it's a multi-
  // word search term we'll append each term as OR'd AND searches.
  const fk_comps = fk.split(' ');
  const opt_t = fk_comps.map((t) => `"${t}"`);

  console.log(`opt_t:\n${JSON.stringify(opt_t)}`);

  // Construct the query for the primary keyword.
  fk = `${op} "${fk}"`;

  // It's a multi-word keyword. Append a grouped AND for each word in the term
  // and boost the original keyword.
  if (opt_t.length > 1) {
    fk = `${fk}^2 OR ( ${opt_t.join(' AND ')} )`;
  }

  return fk;
};

/**
 * Helper function that builds the `query` field of the Elasticsearch search
 * document.
 *
 * @param keywords - An array of search keywords.
 * @param terms An array of terms that will be used as filters in the query.
 * @param termURIs A list of term URIs (ontology URIs) that can be used as
 * filters in the query.
 * @param fields An array of field names to be searched against by the query.
 * @param refereed Whether or not `refereed` should be used as a filter.
 *
 * @returns The query object that can be used in an Elasticsearch search
 * document `query` field.
 */
export const buildDocumentSearchRequestQuery = (
  keywords: string[],
  terms: string[],
  termURIs: string[],
  fields: string[],
  refereed: boolean
): DocumentSearchRequestQuery => {
  const query: DocumentSearchRequestQuery = {
    bool: {
      must: {
        query_string: {
          fields,
          query: keywords.length > 0
            ? keywords.map((k) => formatKeyword(k)).join(' ')
            : '*',
        },
      },
    },
  };

  console.log(`Keywords:${JSON.stringify(keywords)}`);

  const filter = [];
  if (terms.length > 0 || termURIs.length > 0) {
    for (const t of terms) {
      filter.push(nestedQuery({ 'terms.label': t }));
    }

    for (const t of termURIs) {
      filter.push(nestedQuery({ 'terms.uri': t }));
    }
  }

  if (refereed) {
    filter.push({ term: { refereed: 'Refereed' } });
  }

  if (filter.length > 0) {
    query.bool.filter = filter;
  }

  console.log(JSON.stringify(query));

  return query;
};

/**
 * Builds an Elasticsearch search document object that can be used in an
 * Elasctsearch search request. Specifically, this function sets the fields to
 * include, options like from and size, and which fields should provide the
 * highlight information. It also builds the query string value based on
 * keywords provided in the `opts` argument.
 *
 * @param options Search options to include in the search document. At a
 * minimum this object should contain a from, size, keywords, terms | termsURI,
 * fields, and whether or not `refereed` should be checked.
 *
 * @returns A search document object that can be used directly by an
 * Elasticsearch search request.
 */
export const buildDocumentSearchRequestBody = (
  options: DocumentSearchRequestQueryOptions
): DocumentSearchRequestBody => ({
  _source: {
    excludes: ['_bitstreamText'],
  },
  from: options.from,
  size: options.size,
  query: buildDocumentSearchRequestQuery(
    options.keywords,
    options.terms,
    options.termURIs,
    options.fields,
    options.refereed
  ),
  highlight: {
    fields: {
      _bitstreamText: {},
    },
  },
  sort: buildSort(options.sort),
});