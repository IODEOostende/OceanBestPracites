import { activeQueryOperatorsString } from './query';
import { activeFieldsString } from './fields';
import { activeTagsString } from './tags';
import { optionIsActiveById } from './options';

/**
 * customDimensionsFromState
 * @description
 */

export function customDimensionsFromState(state) {

  const active_fields = activeFieldsString(state.fields);
  const active_tags = activeTagsString(state.searchReducer.activeFilters);
  const is_synonyms_active = optionIsActiveById(state.options, 'synonyms');
  const is_refereed_active = optionIsActiveById(state.options, 'refereed');
  const active_operators = activeQueryOperatorsString(state.searchReducer.activeSearch);

  return {
    dimension2: active_fields,
    dimension3: active_tags,
    dimension4: is_synonyms_active,
    dimension5: is_refereed_active,
    dimension6: active_operators,
  };

}
