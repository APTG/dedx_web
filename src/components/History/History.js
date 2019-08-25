import React, { Component } from 'react';
import { connect } from 'react-redux';
import './History.css';

class History extends Component {

    constructor(props) {
        super(props);
        this.keyListCounter = 0;
    }

    render() {
        return(
            <div className="History">
                <p>History component works!</p>
                <ul>
                    {this.props.history.list.map(result =>
                        <li key={this.keyListCounter++}>{result}</li>
                    )}
                </ul>
            </div>
        )
    }
}

const mapStateToProps = state => ({
    history: state.history
});

export default connect(mapStateToProps, {}) (History);