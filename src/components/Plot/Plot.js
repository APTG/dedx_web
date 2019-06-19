import React, { Component } from 'react';
import './Plot.css';
import Plotly from 'react-plotly.js';

class Plot extends Component {

    render() {
        return (
            <div className="Plot">
                <p>Plot component works!</p>
                <Plotly
                    data={[
                        {
                            type: 'scatter',
                            x: [1, 2, 3],
                            y: [2, 6, 3],
                            mode: 'lines+points',
                            marker: {color: 'red'},
                        },
                        {
                            type: 'bar',
                            x: [1, 2, 3],
                            y: [2, 1, 3]
                        },
                    ]}
                    layout={{
                        title: 'Plot title',
                        autosize: true
                    }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                />
            </div>
        );
    }
}

export default Plot;