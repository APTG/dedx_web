import React, { Component } from 'react';
import './Plot.css';
import Plotly from 'react-plotly.js';

import { connect } from 'react-redux';

class Plot extends Component {

    render() {
        return (
            <div className="Plot">
                <p>Plot component works!</p>
                <Plotly
                    data={this.props.plot.data}
                    layout={{
                        title: 'Initial data from redux state',
                        autosize: true
                    }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    plot: state.plot
});

export default connect(mapStateToProps, {}) (Plot);