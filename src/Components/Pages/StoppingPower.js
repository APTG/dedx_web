import { getTrace } from '../../Backend/WASMWrapper'

import Form from "../Form";
import JSRootGraph from "../JSRootGraph";
import PropTypes from 'prop-types';
import React from "react";
import GraphSetting from '../GraphSettings/GraphSettings';

class StoppingPowerComponent extends React.PureComponent {

    static propTypes = {
        ready: PropTypes.bool.isRequired
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

    startValues() {
        return {
            xAxis: this.state.logx,
            yAxis: this.state.logy,
            method: this.state.plotStyle
        }
    }

    render() {
        const onSettingsChange = {
            xAxis: (newState => this.setState({ logx: newState })),
            yAxis: (newState => this.setState({ logy: newState })),
            method: (newState => this.setState({ plotStyle: newState }))
        }

        return (
            <div className="content gridish">
                <Form onSubmit={this.submitHandler} layout={this.state.layout} />
                <div style={{minWidth:"70%"}}>
                    <GraphSetting startValues={this.startValues()} onChange={onSettingsChange} />
                    {
                        this.props.ready
                            ? <JSRootGraph traces={this.state.traces} logx={this.state.logx} logy={this.state.logy} plotStyle={this.state.plotStyle} />
                            : <h2>JSROOT still loading</h2>
                    }

                </div>
            </div>
        )
    }
}

export default StoppingPowerComponent;