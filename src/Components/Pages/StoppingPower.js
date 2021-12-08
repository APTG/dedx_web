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
            dataSeries: [],
            xAxis: 1,
            yAxis: 1,
            plotStyle: 0,
            layout: 0,
        }

        this.submitHandler = this.submitHandler.bind(this);
    }

    async submitHandler(message) {
        const { name, program, ion, material, method, plotUsing, seriesNumber } = message
        const isLog = this.state.xAxis === 1;
        // ~~PlotUsing - double bitwise negation is an efficient way of casting string to int in js
        const metadata = {
            program,
            ion,
            material,
            plotUsing: ~~plotUsing,
            method
        }
        const data = Object.assign({
            isShown: true,
            color: colorSequence[seriesNumber%colorSequence.length],
            index: seriesNumber,
            name
        }, await this.wrapper.getDataSeries(metadata, isLog))

        const dataSeries = {
            data,
            metadata
        }
        console.log(dataSeries)

        // destruct oldState before assiging new values
        this.setState(oldState => ({
            ...oldState,
            dataSeries: [...oldState.dataSeries, dataSeries]
        }))
        this.forceUpdate();
    }

    startValues() {
        const { xAxis, yAxis, method } = this.state
        return { xAxis, yAxis, method }
    }

    async onXAxisChange(xAxis){
        const dataSeries = await Promise.all(this.state.dataSeries.map(async ({data,metadata})=>{
            const {color, isShown, index, name} = data
            const newData = Object.assign(
                {color, isShown, index, name}
                , await this.wrapper.getDataSeries(metadata, xAxis===1)
            )
            return {data: newData,metadata}
    
        }))
        this.setState({xAxis,dataSeries})
    }

    onSettingsChange = {
        xAxis: this.onXAxisChange.bind(this),
        yAxis: (yAxis => this.setState({ yAxis })),
        method: (plotStyle => this.setState({ plotStyle }))
    }

    render() {
        console.log(this.state.dataSeries)
        return (
            <div className="content gridish">
                <Form onSubmit={this.submitHandler} layout={this.state.layout} wrapper={this.wrapper} />
                <div style={{ minWidth: "70%" }}>
                    <GraphSetting startValues={this.startValues()} onChange={this.onSettingsChange} />
                    {
                        this.props.ready
                            ? <JSRootGraph dataSeries={this.state.dataSeries.map(ds=>ds.data)} xAxis={this.state.xAxis} yAxis={this.state.yAxis} plotStyle={this.state.plotStyle} />
                            : <h2>JSROOT still loading</h2>
                    }
                </div>
            </div>
        )
    }
}

export default StoppingPowerComponent;