import React, { Component } from 'react';
import { connect } from 'react-redux';
import './History.css';

class History extends Component {

    render() {
        return(
            <div className="History">
                <p>History component works!</p>

                <ul>
                    {this.props.history.list.map(result => <li>{result}</li>)}
                </ul>

            </div>
        )
    }
}

const mapStateToProps = state => ({
    history: state.history
});

export default connect(mapStateToProps, {}) (History);