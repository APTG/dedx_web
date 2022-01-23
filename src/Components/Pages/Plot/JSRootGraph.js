import React, { createRef } from 'react';
import { StoppingPowerUnits } from '../../../Backend/Utils';

function power10Max(values) {
    return Math.pow(10, Math.ceil(Math.log10(Math.max(...values))))
}

function power10Min(values) {
    return Math.pow(10, Math.floor(Math.log10(Math.min(...values))))
}

function checkBoundaries(dataSeries) {
    if(dataSeries.length < 1) return {
        minEnergy: 0,
        maxEnergy: 10,
        minValue: 0,
        maxValue: 10,
    }
    // We're not handling such big energies so it's safe to assume everything will be smaller than 1e+10
    const boundaries = {
        minEnergy: 1e+10,
        maxEnergy: 0,
        minValue: 1e+10,
        maxValue: 0,
    }

    dataSeries.forEach(ds => {
        const newMinEnergy = power10Min(ds.energies.map(v=>Number(v)))
        const newMaxEnergy = power10Max(ds.energies.map(v=>Number(v)))
        const newMinValue = power10Min(ds.stoppingPowers.map(v=>Number(v)))
        const newMaxValue = power10Max(ds.stoppingPowers.map(v=>Number(v)))

        const { minEnergy, maxEnergy, minValue, maxValue } = boundaries


        if (newMinEnergy < minEnergy) boundaries.minEnergy = newMinEnergy
        if (newMaxEnergy > maxEnergy) boundaries.maxEnergy = newMaxEnergy
        if (newMinValue < minValue) boundaries.minValue = newMinValue
        if (newMaxValue > maxValue) boundaries.maxValue = newMaxValue
    })

    return boundaries
}

function createTGraphFromDataSeries(dataSeries) {
    const { energies, stoppingPowers, seriesNumber } = dataSeries
    const tgraph = JSROOT.createTGraph(
        energies.length,
        energies,
        stoppingPowers
    )
    tgraph.fLineColor = seriesNumber + 1
    tgraph.fLineWidth = 2
    tgraph.fMarkerSize = 1
    tgraph.fTitle = ''
    //tgraph.fMarkerStyle = 8
    // line below the comment sets kNotEditable bit (no 18) which disables graph dragging
    // kNotEditable is defined in TGraph class in ROOT project: https://github.com/root-project/root/blob/v6-25-01/hist/hist/inc/TGraph.h#L72
    tgraph.InvertBit(JSROOT.BIT(18))

    return tgraph
}

function createMultigraphFromDataSeries(previewSeries, dataSeries, stpUnit) {
    const filtered = [previewSeries, ...dataSeries]
        .filter(dataSeries => dataSeries && dataSeries.isShown)
        

    const res = filtered.length !== 0
        ? JSROOT.createTMultiGraph(...(filtered.map((ds, k) => createTGraphFromDataSeries(ds, k))))
        : JSROOT.createTGraph(1)

    if (res) {

        const { minEnergy, maxEnergy, minValue, maxValue } = checkBoundaries(filtered)

        res.fTitle = ''
        // inspired by https://github.com/root-project/jsroot/blob/6.3.2/demo/multigraph_legend.htm#L53
        // method described in https://github.com/root-project/jsroot/issues/225
        const hist = JSROOT.createHistogram("TH1F", 20)
        hist.fXaxis.fTitle = 'Energy [MeV/nucl]'
        hist.fXaxis.fXmin = minEnergy
        hist.fXaxis.fXmax = maxEnergy
        const stpType = stpUnit.id === StoppingPowerUnits.MassStoppingPower.id ? 'Mass Stopping Power' : 'Stopping power'
        hist.fYaxis.fTitle = `${stpType} [${stpUnit.name}]`
        hist.fTitle = ''

        //centering axes labels
        hist.fXaxis.InvertBit(JSROOT.BIT(12))
        hist.fYaxis.InvertBit(JSROOT.BIT(12))

        hist.fMinimum = minValue
        hist.fMaximum = maxValue

        res.fHistogram = hist
    }
    return res
}

let JSROOT

function drawOptFromProps({ xAxis, yAxis, plotStyle, gridlines }) {
    const res = [];
    if (xAxis === 1) res.push('logx');
    if (yAxis === 1) res.push('logy');
    if (plotStyle === 1) res.push('P');
    if (gridlines === 1) res.push('gridx;gridy');

    return res.join(';') + ';tickx;ticky';
}

// COMPONENT

export default class JSRootGraph extends React.Component {

    constructor(props) {
        super(props);
        this.graphRef = createRef(null);

        JSROOT = window.JSROOT;
    }

    //#region LIFECYCLE
    shouldComponentUpdate(nextProps) {
        // Shows which fields from props have changed. Important for debugging
        /* Object.keys(nextProps).forEach(k=>{
            if(nextProps[k]!==this.props[k]) console.log(k)
        }) */

        //prevent update when changing stopping power units. 
        //Since the stps need to be recalculated there will be another update very soon anyways
        const monitoredFields = ['previewSeries', 'visibilityFlag', 'xAxis', 'yAxis', 'plotStyle', 'gridlines']
        return monitoredFields.some(field => nextProps[field] !== this.props[field])
            || nextProps.dataSeries.length !== this.props.dataSeries.length
    }

    componentDidUpdate() {
        const { stoppingPowerUnit, dataSeries, previewSeries } = this.props
        JSROOT.cleanup(this.graphRef.current)

        const opts = drawOptFromProps(this.props);
        const toDraw = createMultigraphFromDataSeries(previewSeries, dataSeries, stoppingPowerUnit);

        JSROOT.redraw(this.graphRef.current, toDraw, opts)
    }

    componentDidMount() {
        window.addEventListener('resize', this.refreshGraph.bind(this))
        const { dataSeries, stoppingPowerUnit, previewSeries } = this.props

        const toDraw = createMultigraphFromDataSeries(previewSeries, dataSeries, stoppingPowerUnit)
        JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
    }

    //#endregion LIFECYCLE

    refreshGraph() {
        JSROOT.resize(this.graphRef.current)
    }

    render() {
        return (
            <div>
                <div style={{ width: '100%', height: '35em' }} ref={this.graphRef}></div>
            </div>
        )
    }
}