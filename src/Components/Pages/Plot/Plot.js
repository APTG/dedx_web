import Form from "./Form";
import JSRootGraph from "./JSRootGraph";
import DataSeriesList from './DataSeriesList'
import React from "react";
import GraphSetting from './GraphSettings';
import WASMWrapper from "../../../Backend/WASMWrapper";
import ResultTable from "../../ResultTable/ResultTable";

import { getCSV, transformDataSeriesToTableData } from "../../ResultTable/TableUtils";
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
        this.onDataSeriesStateChange = this.onDataSeriesStateChange.bind(this)
        this.onDownloadCSV = this.onDownloadCSV.bind(this)
    }

    //#region LIFECYCLE
    async componentDidUpdate(prevProps, prevState) {
        const { program, ion, material, stoppingPowerUnit } = this.props
        if (program !== prevProps.program
            || ion !== prevProps.ion
            || material !== prevProps.material
        ) {
            this.setState({
                name: `${ion.name}/${material.name}@${program.name}`
            })
        } else if (stoppingPowerUnit !== prevProps.stoppingPowerUnit) {
            const {dataSeries} = this.state
            if (dataSeries) {
                const newDataSeries = await Promise.all(dataSeries.map(async ds => {
                    const { data, metadata } = ds
                    return {
                        metadata,
                        data: {
                            ...data,
                            stoppingPowers: await this.wrapper.recalcualteStoppingPowers(
                                prevProps.stoppingPowerUnit, stoppingPowerUnit, metadata.material, data.stoppingPowers
                            )
                        }

                    }
                }))
                this.setState({dataSeries: newDataSeries})
            }
        }
    }
    //#endregion LIFECYCLE

    //#region HANDLERS
    onNameChange = name => {
        this.setState({ name: name.target.value })
    }

    async submitHandler(event) {
        event.preventDefault()
        // ~~PlotUsing - double bitwise negation is an efficient way of casting string to int in js
        const { program, ion, material, stoppingPowerUnit } = this.props
        const { pointQuantity, seriesNumber, name } = this.state
        const metadata = { program, ion, material, pointQuantity }
        const data = Object.assign({
            isShown: true,
            color: colorSequence[seriesNumber % colorSequence.length],
            name,
            seriesNumber: seriesNumber
        }, await this.wrapper.getStpPlotData(metadata, this.state.xAxis === AxisLayout.Logarithmic, stoppingPowerUnit))

        // avoid storing multiple energy arrays = they are all the same
        const energies = data.energies
        data.energies = undefined

        const dataSeries = { data, metadata }

        // destruct oldState before assiging new values
        this.setState(oldState => ({
            ...oldState,
            dataSeries: [...oldState.dataSeries, dataSeries],
            energies: energies,
            seriesNumber: ++oldState.seriesNumber
        }))
    }

    clearDataSeries() {
        this.setState({
            energies: [],
            dataSeries: [],
            seriesNumber: startingSeriesNumber
        })
    }

    async onXAxisChange(xAxis) {
        let _energies = []
        const dataSeries = await Promise.all(this.state.dataSeries.map(async ({ data, metadata }) => {
            const {energies,stoppingPowers} = await this.wrapper.getStpPlotData(metadata, xAxis === AxisLayout.Logarithmic, this.props.stoppingPowerUnit)
            const newData = {
                ...data,
                stoppingPowers
            }
            if(_energies.length === 0) _energies = energies
            return { data: newData, metadata }

        }))
        this.setState({ xAxis, dataSeries, energies: _energies })
    }

    onSettingsChange = {
        xAxis: this.onXAxisChange.bind(this),
        yAxis: (yAxis => this.setState({ yAxis })),
        gridlines: (gridlines => this.setState({ gridlines }))
    }

    onDataSeriesStateChange({target}){
        const index = ~~ target.id
        const {dataSeries} = this.state
        dataSeries[index].data.isShown = !dataSeries[index].data.isShown
        this.setState({dataSeries})
    }

    onDownloadCSV(){
        const {energies, dataSeries} = this.state

        const transformed = transformDataSeriesToTableData(dataSeries)
        getCSV(energies, transformed)
    }

    //#endregion HANDLERS

    render() {
        const { dataSeries, xAxis, yAxis, gridlines, energies, name } = this.state
        const { submitHandler, clearDataSeries, onNameChange, onDataSeriesStateChange, onDownloadCSV } = this
        const { stoppingPowerUnit } = this.props

        return (
            <div className="gridish row-flex flex-medium gap1">
                <Form
                    onSubmit={submitHandler}
                    onClear={clearDataSeries}
                    onNameChange={onNameChange}
                    onDownloadCSV={onDownloadCSV}
                    showCSVDownload={dataSeries?.length !== 0}
                    name={name}
                    {...this.props}
                />
                <div style={{minWidth:'70%'}}>
                    <GraphSetting startValues={{ xAxis, yAxis, gridlines }} onChange={this.onSettingsChange} />
                    {
                        this.props.ready
                            ? <div>
                                <JSRootGraph
                                energies={energies}
                                dataSeries={dataSeries.map(ds => ds.data)}
                                stoppingPowerUnit={stoppingPowerUnit}
                                xAxis={xAxis}
                                yAxis={yAxis}
                                gridlines={gridlines}
                            />
                            <DataSeriesList 
                            dataSeries={dataSeries.map(ds => ds.data)}
                            onDataSeriesStateChange={onDataSeriesStateChange}
                            />
                             </div>
                            : <h2>JSROOT still loading</h2>
                    }
                </div>
                {dataSeries.length !== 0
                    && <ResultTable
                        energies={energies}
                        values={transformDataSeriesToTableData(dataSeries)}
                        stoppingPowerUnit={stoppingPowerUnit.name}
                        shouldDisplay={dataSeries?.length !== 0}
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