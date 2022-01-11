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

const startingSeriesNumber = 1
const pointQuantity = 100

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
            previewSeries: undefined,
            // Since changing Data Series visibility doesn't work with shouldComponentUpdate cause of
            // nested state objects this helps it recognize when the visibility has been changed
            visibilityFlag: false
        }

        this.submitHandler = this.submitHandler.bind(this);
        this.clearDataSeries = this.clearDataSeries.bind(this);
        this.onDataSeriesStateChange = this.onDataSeriesStateChange.bind(this)
        this.onDownloadCSV = this.onDownloadCSV.bind(this)
    }

    //#region LIFECYCLE
    async componentDidUpdate(prevProps) {
        const { program, ion, material, stoppingPowerUnit } = this.props
        if (program !== prevProps.program
            || ion !== prevProps.ion
            || material !== prevProps.material
        ) {
            let previewSeries = {}
            let energies = []
            if (program && ion && material && stoppingPowerUnit) {
                const metadata = { program, ion, material, pointQuantity }
                const data = Object.assign({
                    isShown: true,
                    color: '#000',
                    name: `${ion.name} on ${material.name} (${program.name})`,
                    seriesNumber: 0
                }, await this.wrapper.getStpPlotData(metadata, this.state.xAxis === AxisLayout.Logarithmic, stoppingPowerUnit))
                energies = data.energies
                data.energies = undefined
                previewSeries = { data, metadata }
            }
            this.setState({
                seriesNumber: program !== prevProps.program ? startingSeriesNumber : this.state.seriesNumber,
                dataSeries: program !== prevProps.program ? [] : this.state.dataSeries,
                energies,
                previewSeries,
                name: `${ion.name} on ${material.name} (${program.name})`
            })
        } else if (stoppingPowerUnit !== prevProps.stoppingPowerUnit) {
            const { dataSeries, previewSeries } = this.state
            let newDataSeries = dataSeries
            let newPreviewSeries = previewSeries
            if (dataSeries) {
                newDataSeries = await Promise.all(dataSeries.map(async ds => {
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
            }
            if (previewSeries) {
                const { data, metadata } = previewSeries
                newPreviewSeries = {
                    metadata,
                    data: {
                        ...data,
                        stoppingPowers: await this.wrapper.recalcualteStoppingPowers(
                            prevProps.stoppingPowerUnit, stoppingPowerUnit, metadata.material, data.stoppingPowers
                        )
                    }

                }
            }
            this.setState({
                dataSeries: newDataSeries,
                previewSeries: newPreviewSeries
            })
        }
    }
    //#endregion LIFECYCLE

    //#region HANDLERS
    onNameChange = name => {
        this.setState({ name: name.target.value })
    }

    submitHandler(event) {
        event.preventDefault()
        const { data, metadata } = this.state.previewSeries
        const added = {
            metadata,
            data: {
                ...data,
                color: colorSequence[this.state.seriesNumber - 1 % colorSequence.length],
                seriesNumber: this.state.seriesNumber
            }
        }
        
        this.setState(oldState => ({
            ...oldState,
            dataSeries: [...oldState.dataSeries, added],
            seriesNumber: ++oldState.seriesNumber
        }))
    }

    clearDataSeries() {
        this.setState({
            dataSeries: [],
            seriesNumber: startingSeriesNumber
        })
    }

    async onXAxisChange(xAxis) {
        let _energies = []
        const dataSeries = await Promise.all(this.state.dataSeries.map(async ({ data, metadata }) => {
            const { energies, stoppingPowers } = await this.wrapper.getStpPlotData(metadata, xAxis === AxisLayout.Logarithmic, this.props.stoppingPowerUnit)
            const newData = {
                ...data,
                stoppingPowers
            }
            if (_energies.length === 0) _energies = energies
            return { data: newData, metadata }

        }))
        this.setState({ xAxis, dataSeries, energies: _energies })
    }

    onSettingsChange = {
        xAxis: this.onXAxisChange.bind(this),
        yAxis: (yAxis => this.setState({ yAxis })),
        gridlines: (gridlines => this.setState({ gridlines }))
    }

    onDataSeriesStateChange({ target }) {
        const index = ~~target.id

        if (index === 0) {
            const { previewSeries } = this.state
            previewSeries.data.isShown = !previewSeries.data.isShown
            this.setState(oldState => ({
                previewSeries,
                visibilityFlag: !oldState.visibilityFlag
            }))
        } else {
            const { dataSeries } = this.state
            dataSeries[index - 1].data.isShown = !dataSeries[index - 1].data.isShown
            this.setState(oldState => ({
                dataSeries,
                visibilityFlag: !oldState.visibilityFlag
            }))
        }

    }

    onDownloadCSV() {
        const { energies, dataSeries } = this.state

        if (dataSeries.length !== 0) {
            const transformed = transformDataSeriesToTableData(dataSeries)
            getCSV(energies, transformed)
        } else {
            const transformed = transformDataSeriesToTableData([this.state.previewSeries])
            getCSV(energies, transformed)
        }

    }

    //#endregion HANDLERS

    render() {
        const { dataSeries, xAxis, yAxis, gridlines, energies, name, previewSeries, visibilityFlag } = this.state
        const { submitHandler, clearDataSeries, onNameChange, onDataSeriesStateChange, onDownloadCSV } = this
        const { stoppingPowerUnit } = this.props

        return (
            <div className="gridish row-flex flex-medium gap1">
                <Form
                    onSubmit={submitHandler}
                    onClear={clearDataSeries}
                    onNameChange={onNameChange}
                    onDownloadCSV={onDownloadCSV}
                    name={name}
                    {...this.props}
                />
                <div style={{ minWidth: '70%' }}>
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
                                    previewSeries={previewSeries && previewSeries.data}
                                    visibilityFlag={visibilityFlag}
                                />
                                <DataSeriesList
                                    previewSeries={previewSeries && previewSeries.data}
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