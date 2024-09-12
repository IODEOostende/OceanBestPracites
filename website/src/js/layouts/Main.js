import React, { Component } from "react";
import { connect } from 'react-redux';

import Wrapper from './Wrapper';
import SearchBar from '../components/SearchBar';
import SearchTipsModal from '../components/SearchTipsModal';
import FullScreenModal from '../components/FullScreenModal';
import Stats from '../components/Stats';
import LinkListItem from '../components/LinkListItem';
import LinkListItemToggle from '../components/LinkListItemToggle';
import Superlink from '../components/Superlink';
import { formSearchRoute } from '../helpers/url';
import { activeFieldsString } from '../helpers/fields';
import { activeAdvancedOptionsString } from '../helpers/options';

import { clearAllSearch } from '../actions/search';
import { getStats } from '../actions/stats';

import unesco_ioc_obp_logo from '../../images/unesco-ioc-ocb-lockup-2x.png';

const navigation_links = [
  {
    to: 'https://repository.oceanbestpractices.org/page/about',
    title: 'About',
  },
  {
    to: 'citation',
    title: 'Recommended Citation',
  },
  {
    to: 'https://repository.oceanbestpractices.org/page/faq',
    title: 'FAQ',
  },
  {
    to: 'https://repository.oceanbestpractices.org/feedback',
    title: 'Contact Us',
  },
];

class Main extends Component {

  componentDidMount() {

    this.props.dispatch(getStats());

    // Clear the search query for mount. If a user navigates back to the homepage,
    // we shouldn't carry the search state through intended navigation

    this.props.dispatch(clearAllSearch());

  }

  handleSearchButtonClick() {
    const route = formSearchRoute({
      active_fields: activeFieldsString(this.props.fields),
      active_options: activeAdvancedOptionsString(this.props.options),
      active_search: this.props.searchReducer.search,
    });

    this.props.history.push(route);
  }

  render() {

    const { search, activeSearch } = this.props.searchReducer;

    return (
      <Wrapper header={false} page="landing" childrenContainerClass="landing" footerLinks={true}>
        <section className='landing__header'>

          <div className='link-list--landing'>

            <ul className="link-list link-list--horizontal">
              { navigation_links.map((link, index) => <LinkListItem key={`navigation-link-${index}-${link.title}`} location="header" {...link} />) }
            </ul>
            <span className="link-list__link--emphasis">
              <Superlink class_name="link-list__link link-list__link-tagger" to="/tagger" event_category="header" event_action="link" event_label="Ocean Knowledge Tagger">
                OceanKnowledge Tagger
              </Superlink>
              <LinkListItemToggle toggleButtonClass="link-list__link--emphasis" toggleModalClass="link__list-toggle down" label="Submit A New Best Practice">
                <FullScreenModal smallModal="true" modalCTA="Get Templates" modalTitle="Best Practices Document Templates" location="home" modalClass="link-list">
                  <div className="link__list-toggle-modal">
                    <p>Select the template that best matches your document type.</p>
                    <Superlink to="https://repository.oceanbestpractices.org/handle/11329/1243" event_category="header" event_action="link" event_label="Sensors template">
                      Sensors
                    </Superlink>
                    <Superlink to="https://repository.oceanbestpractices.org/handle/11329/1246" event_category="header" event_action="link" event_label="Ocean Applciations template">
                      Ocean Applications
                    </Superlink>
                    <Superlink to="https://repository.oceanbestpractices.org/handle/11329/1649" event_category="header" event_action="link" event_label="Ocean Modeling template">
                      Ocean Modeling
                    </Superlink>
                    <Superlink to="https://repository.oceanbestpractices.org/handle/11329/1245" event_category="header" event_action="link" event_label="Data Management template">
                      Data Management
                    </Superlink>
                  </div>
                </FullScreenModal>
                <Superlink class_name="link-list__link" to="https://repository.oceanbestpractices.org/submissions" event_category="header" event_action="link" event_label="Submit a new Best Practice">
                  Go to Submission Site
                </Superlink>
              </LinkListItemToggle>
            </span>
          </div>

        </section>
        <section className="landing__search-container">
          <img className="landing__obp-logo" src={unesco_ioc_obp_logo} alt="United Nations, Educational, Scientific and Cultural Organization Logo | Intergovernmental Oceanographic Commission Logo | Ocean Best Practices Logo" width="591" height="234"/>
          <div className="landing__search">
            <SearchBar page="landing" history={this.props.history}/>
          </div>
          <button className="button landing__search-button"
            onClick={this.handleSearchButtonClick.bind(this)}
            disabled={!search.length && activeSearch.length === 0}>
              Search
          </button>
          <SearchTipsModal
            call="Search Tips"
            location="home"
            hoverText="How to get the best out of your search"
          />
          <div className="landing__archive">
            <Stats />
          </div>
        </section>

        <FullScreenModal
          open={true}
          noLink={true}
          modalTitle="Welcome to Ocean Best Practices"
          closeLabel="Continue"
        >
          <div className="link__list-toggle-modal welcome-modal">
            <p>
              The OBPS is a secure, permanent global repository of ocean research, operations, data/information and applications methods.
              Methods not showing as “ENDORSED” may not be best practices.
            </p>
          </div>
        </FullScreenModal>
      </Wrapper>
    );
  }
}

export default connect(state => state)(Main);
