import { getTrace } from '../../Backend/WASMWrapper'

import Form from "../Form";
import JSRootGraph from "../JSRootGraph";
import PropTypes from 'prop-types';
import React from "react";
import Toggle from "../Toggle";

class StoppingPowerComponent extends React.PureComponent {

    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    onXAxisStateChange(newState) {
        this.setState({ logx: newState })
    }

    onYAxisStateChange(newState) {
        this.setState({ logy: newState })
    }

    onPlottingMethodChange(newState) {
        this.setState({ plotStyle: newState })
    }

    onLayoutChange(newState) {
        this.setState({ layout: newState })
    }

    constructor(props) {
        super(props);

        this.state = {
            ready: false,
            traces: [],
            logx: 0,
            logy: 1,
            plotStyle: 0,
            layout: 0,
        }

        this.submitHandler = this.submitHandler.bind(this);
        this.onXAxisStateChange = this.onXAxisStateChange.bind(this);
        this.onYAxisStateChange = this.onYAxisStateChange.bind(this);
        this.onPlottingMethodChange = this.onPlottingMethodChange.bind(this);
    }

    //TODO
    submitHandler(message) {
        const traces = this.state.traces;
        traces.push(getTrace(message, ""));
        this.setState({
            traces: traces
        })
        this.forceUpdate();
    }

    render() {
        return (
            <div className="content gridish">
                <div>
                    <Form onSubmit={this.submitHandler} layout={this.state.layout} />
                    <div style={{ display: "flex", flexDirection: "row", gap: 20, padding: "1rem 3rem" }}>
                        <Toggle onChange={this.onXAxisStateChange} name={"X Axis:"} startValue={this.state.logx}>
                             {"Linear"}
                             {"Logarithmic"}
                        </Toggle>
                        <Toggle onChange={this.onYAxisStateChange} name={"Y Axis:"} startValue={this.state.logy}>
                             {"Linear"}
                             {"Logarithmic"}
                        </Toggle>
                        <Toggle onChange={this.onPlottingMethodChange} name={"Plotting Method:"} startValue={this.state.line}>
                             {"Line"}
                             {"Points"}
                        </Toggle>
                    </div>
                </div>
                {
                    this.props.ready
                        ? <JSRootGraph traces={this.state.traces} logx={this.state.logx} logy={this.state.logy} plotStyle={this.state.plotStyle} />
                        : <h2>JSROOT still loading</h2>
                }
            </div>
        )
    }
}

export default StoppingPowerComponent;