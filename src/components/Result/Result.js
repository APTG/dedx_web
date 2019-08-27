import React, { Component } from 'react';
import {connect} from "react-redux";
import './Result.css';

class Result extends Component {

    render() {
        return(
            <div className="Result">
                <p>Result component works!</p>
                <p>Last value: {this.props.result.value}</p>
            </div>
        )
    }
}



const mapStateToProps = state => ({
    result: state.result
});

export default connect(mapStateToProps, {}) (Result);
