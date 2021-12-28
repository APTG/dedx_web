import Form from "./Form";
import JSRootGraph from "./JSRootGraph";
import React from "react";
import GraphSetting from './GraphSettings';
import WASMWrapper from "../../../Backend/WASMWrapper";
import ResultTable from "../../ResultTable/ResultTable";

import { transformDataSeriesToTableData } from "../../ResultTable/TableUtils";
import withLibdedxEntities from '../../WithLibdedxEntities'

import colorSequence from '../../../Styles/PlotColors.json'

const AxisLayout = {
    Linear: 0,
    Logarithmic: 1
}

const GridlineStyle = {
    On: 1,
    Off: 0
}

const startingSeriesNumber = 0

class PlotComponent extends React.Component {

    constructor(props) {
        super(props);

        this.wrapper = props.wrapper || new WASMWrapper()

        this.state = {
            energies: [],
            dataSeries: [],
            xAxis: AxisLayout.Logarithmic,
            yAxis: AxisLayout.Logarithmic,
            gridlines: GridlineStyle.On,
            seriesNumber: startingSeriesNumber,
            name: "",
            pointQuantity: 100,
        }

        this.submitHandler = this.submitHandler.bind(this);
        this.clearDataSeries = this.clearDataSeries.bind(this);
    }

    //#region LIFECYCLE
    componentDidUpdate(prevProps) {
        const { program, ion, material } = this.props
        if (program !== prevProps.program
            || ion !== prevProps.ion
            || material !== prevProps.material
        ) {
            this.setState({
                name: `${ion.name}/${material.name}@${program.name}`
            })
        }
    }
    //#endregion LIFECYCLE

    //#region HANDLERS
    onNameChange = name => {
        console.log(name.target.value)
        this.setState({ name: name.target.value })
    }

    async submitHandler(event) {
        event.preventDefault()
        // ~~PlotUsing - double bitwise negation is an efficient way of casting string to int in js
        const { program, ion, material } = this.props
        const { pointQuantity, seriesNumber, name } = this.state
        const metadata = { program, ion, material, pointQuantity, seriesNumber }
        const data = Object.assign({
            isShown: true,
            color: colorSequence[seriesNumber % colorSequence.lengt],
            name
        }, await this.wrapper.getStpPlotData(metadata, this.state.xAxis === AxisLayout.Logarithmic))

        const dataSeries = { data, metadata }

        // destruct oldState before assiging new values
        this.setState(oldState => ({
            ...oldState,
            dataSeries: [...oldState.dataSeries, dataSeries],
            energies: data.energies
        }))
    }

    clearDataSeries() {
        this.setState({
            dataSeries: [],
            seriesNumber: startingSeriesNumber
        })
    }

    async onXAxisChange(xAxis) {
        const dataSeries = await Promise.all(this.state.dataSeries.map(async ({ data, metadata }) => {
            const { color, isShown, name } = data
            const newData = Object.assign(
                { color, isShown, name },
                await this.wrapper.getStpPlotData(metadata, xAxis === AxisLayout.Logarithmic)
            )
            return { data: newData, metadata }

        }))
        this.setState({ xAxis, dataSeries })
    }

    onSettingsChange = {
        xAxis: this.onXAxisChange.bind(this),
        yAxis: (yAxis => this.setState({ yAxis })),
        gridlines: (gridlines => this.setState({ gridlines }))
    }

    //#endregion HANDLERS

    render() {
        const { dataSeries, xAxis, yAxis, plotStyle, gridlines, energies, name } = this.state
        const { submitHandler, clearDataSeries, onNameChange } = this

        return (
            <div className="content gridish">
                <Form
                    onSubmit={submitHandler}
                    onClear={clearDataSeries}
                    onNameChange={onNameChange}
                    name={name}
                    {...this.props}
                />
                <div style={{ minWidth: "70%" }}>
                    <GraphSetting startValues={{ xAxis, yAxis, gridlines }} onChange={this.onSettingsChange} />
                    {
                        this.props.ready
                            ? <JSRootGraph
                                dataSeries={dataSeries.map(ds => ds.data)}
                                xAxis={xAxis}
                                yAxis={yAxis}
                                plotStyle={plotStyle}
                                gridlines={gridlines}
                            />
                            : <h2>JSROOT still loading</h2>
                    }
                </div>
                {dataSeries.length !== 0
                    && <ResultTable
                        energies={energies}
                        values={transformDataSeriesToTableData(dataSeries)}
                    />}
            </div>
        )
    }
}

const defaults = {
    programId: 2, // PSTAR https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L8
    materialId: 276, // liquid WATER https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L197
    ionId: 1, // currently proton (HYDROGEN)  https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L244
}


export default withLibdedxEntities(PlotComponent, defaults);