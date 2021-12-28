import React, { createRef } from "react";
import PropTypes from 'prop-types';

let JSROOT
//#region Helper functions

function createTGraphFromDataSeries(energies, dataSeries) {
    const tgraph = JSROOT.createTGraph(
        energies.length,
        energies,
        dataSeries.stoppingPowers
    )
    tgraph.fLineColor = dataSeries.seriesNumber + 1
    tgraph.fLineWidth = 2
    tgraph.fMarkerSize = 1
    //tgraph.fMarkerStyle = 8
    // line below the comment sets kNotEditable bit (no 18) which disables graph dragging
    // kNotEditable is defined in TGraph class in ROOT project: https://github.com/root-project/root/blob/v6-25-01/hist/hist/inc/TGraph.h#L72
    tgraph.InvertBit(JSROOT.BIT(18))

    return tgraph
}

function createMultigraphFromDataSeries(energies, dataSeries, stpUnit) {
    const filtered = dataSeries
        .filter(dataSeries => dataSeries.isShown)
        .map((ds, k) => createTGraphFromDataSeries(energies, ds, k))

    const res = filtered.length !== 0
        ? JSROOT.createTMultiGraph(...filtered)
        : JSROOT.createTGraph(1)

    if (res) {
        res.fTitle = ''
        const hist = JSROOT.createHistogram("TH1F", 20)
        hist.fXaxis.fTitle = 'Energy[MeV/nucl]'
        hist.fXaxis.fXmin = 1e-3
        hist.fXaxis.fXmax = 1e+4
        hist.fYaxis.fTitle = `Stopping power[${stpUnit.name}]`
        hist.fYaxis.fXmin = 1e-4
        hist.fYaxis.fXmax = 1e+2
        console.log(hist)
        res.fHistogram = hist
    }
    return res
}

function drawOptFromProps({ xAxis, yAxis, plotStyle, gridlines }) {
    const res = [];
    if (xAxis === 1) res.push("logx");
    if (yAxis === 1) res.push("logy");
    if (plotStyle === 1) res.push("P");
    if (gridlines === 1) res.push("gridx;gridy");

    return res.join(';') + ';tickx;ticky';
}

//#endregion Helper functions

// COMPONENT

export default class JSRootGraph extends React.Component {

    constructor(props) {
        super(props);
        this.graphRef = createRef(null);

        JSROOT = window.JSROOT;
    }

    shouldComponentUpdate(nextProps) {
        //prevent update when changing stopping power units. 
        //Since the stps need to be recalculated there will be another update very soon anyways
        return !(nextProps.stoppingPowerUnit.id !== this.props.stoppingPowerUnit.id)
    }

    componentDidUpdate(prevProps) {
        const { stoppingPowerUnit } = this.props
        JSROOT.cleanup(this.graphRef.current)

        const opts = drawOptFromProps(this.props);
        const toDraw = createMultigraphFromDataSeries(this.props.energies, this.props.dataSeries, stoppingPowerUnit);

        JSROOT.redraw(this.graphRef.current, toDraw, opts)

    }

    refreshGraph() {
        JSROOT.resize(this.graphRef.current)
    }

    componentDidMount() {
        window.addEventListener('resize', this.refreshGraph.bind(this))
        const { energies, dataSeries, stoppingPowerUnit } = this.props

        const toDraw = createMultigraphFromDataSeries(energies, dataSeries, stoppingPowerUnit)
        JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
    }

    render() {
        return (
            <div>
                <div style={{ width: "100%", height: '40vw', minHeight: '400px' }} ref={this.graphRef}></div>
            </div>
        )
    }
}