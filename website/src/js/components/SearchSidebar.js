import React, { Component } from "react";
import { connect } from 'react-redux';
import { resetTerms } from '../actions/terms';

import PanelRelationships from './PanelRelationships';


class SearchSidebar extends Component {

  constructor(props) {
  super(props);

  this.state = {
      activeTags: null
    }
  }

  componentWillReceiveProps(props) {
    this.setState({
      activeTags: props.termsReducer.activeTerms.title
    });
  }

  closeSidebar() {
    this.setState({
      activeTags: null
    });
    this.props.dispatch(resetTerms());
  }

  render() {
      return (
        <aside className={`search-sidebar ${this.state.activeTags ? 'active' : ''}`}>
          { this.state.activeTags
                ? <button className="search-sidebar__close-button" aria-labelledby="CLOSE" onClick={this.closeSidebar.bind(this)}><i className="fa fa-close"></i></button>
                : null
            }
          <PanelRelationships />
        </aside>
  
      );

  }
}

export default connect(state => state)(SearchSidebar);
