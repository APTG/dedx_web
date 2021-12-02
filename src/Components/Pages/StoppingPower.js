import Form from "../Form/Form";
import JSRootGraph from "../JSRootGraph";
import PropTypes from 'prop-types';
import React from "react";
import GraphSetting from '../GraphSettings/GraphSettings';
import WASMWrapper from "../../Backend/WASMWrapper";

import colorSequence from '../../Styles/PlotColors.json'

class StoppingPowerComponent extends React.PureComponent {

    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    constructor(props) {
        super(props);

        this.wrapper = props.wrapper || new WASMWrapper()

        this.state = {
            traces: [],
            xAxis: 0,
            yAxis: 1,
            plotStyle: 0,
            layout: 0,
        }

        this.submitHandler = this.submitHandler.bind(this);
    }

    async submitHandler(message) {
        const { name, program, ion, material, method, plotUsing, seriesNumber } = message
        const trace = Object.assign({
            isShown: true,
            color: colorSequence[seriesNumber%colorSequence.length],
            index: seriesNumber,
            name
        }, await this.wrapper.getDataSeries(program, ion, material, method, plotUsing))

        console.log(trace)

        // destruct oldState before assiging new values
        this.setState(oldState => ({
            ...oldState,
            traces: [...oldState.traces, trace]
        }))
        this.forceUpdate();
    }

    startValues() {
        const { xAxis, yAxis, method } = this.state
        return { xAxis, yAxis, method }
    }

    onSettingsChange = {
        xAxis: (xAxis => this.setState({ xAxis })),
        yAxis: (yAxis => this.setState({ yAxis })),
        method: (plotStyle => this.setState({ plotStyle }))
    }

    render() {
        return (
            <div className="content gridish">
                <Form onSubmit={this.submitHandler} layout={this.state.layout} wrapper={this.wrapper} />
                <div style={{ minWidth: "70%" }}>
                    <GraphSetting startValues={this.startValues()} onChange={this.onSettingsChange} />
                    {
                        this.props.ready
                            ? <JSRootGraph traces={this.state.traces} xAxis={this.state.xAxis} yAxis={this.state.yAxis} plotStyle={this.state.plotStyle} />
                            : <h2>JSROOT still loading</h2>
                    }
                </div>
            </div>
        )
    }
}

export default StoppingPowerComponent;