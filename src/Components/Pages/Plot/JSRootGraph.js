import React, { createRef } from "react";
import { StoppingPowerUnits } from "../../../Backend/Utils";

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
    tgraph.fTitle = ''
    //tgraph.fMarkerStyle = 8
    // line below the comment sets kNotEditable bit (no 18) which disables graph dragging
    // kNotEditable is defined in TGraph class in ROOT project: https://github.com/root-project/root/blob/v6-25-01/hist/hist/inc/TGraph.h#L72
    tgraph.InvertBit(JSROOT.BIT(18))

    return tgraph
}

function createMultigraphFromDataSeries(energies, previewSeries, dataSeries, stpUnit) {
    const filtered = [previewSeries, ...dataSeries]
        .filter(dataSeries => dataSeries && dataSeries.isShown)
        .map((ds, k) => createTGraphFromDataSeries(energies, ds, k))

    const res = filtered.length !== 0
        ? JSROOT.createTMultiGraph(...filtered)
        : JSROOT.createTGraph(1)

    if (res) {
        res.fTitle = ''
        // inspired by https://github.com/root-project/jsroot/blob/6.3.2/demo/multigraph_legend.htm#L53
        // method described in https://github.com/root-project/jsroot/issues/225
        const hist = JSROOT.createHistogram("TH1F", 20)
        hist.fXaxis.fTitle = 'Energy [MeV/nucl]'
        hist.fXaxis.fXmin = 1e-3
        hist.fXaxis.fXmax = 1e+4
        const stpType = stpUnit.id === StoppingPowerUnits.MassStoppingPower.id ? 'Mass Stopping Power' : 'Stopping power'
        hist.fYaxis.fTitle = `${stpType} [${stpUnit.name}]`
        hist.fYaxis.fXmin = 1e-4
        hist.fYaxis.fXmax = 1e+2
        hist.fTitle = ''
        
        //centering axes labels
        hist.fXaxis.InvertBit(JSROOT.BIT(12))
        hist.fYaxis.InvertBit(JSROOT.BIT(12))
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
        return nextProps.previewSeries !== this.props.previewSeries 
            || nextProps.dataSeries.length !== this.props.dataSeries.length
            || nextProps.visibilityFlag !== this.props.visibilityFlag
    }

    componentDidUpdate() {
        const { stoppingPowerUnit, energies, dataSeries, previewSeries } = this.props
        JSROOT.cleanup(this.graphRef.current)

        const opts = drawOptFromProps(this.props);
        const toDraw = createMultigraphFromDataSeries(energies, previewSeries, dataSeries, stoppingPowerUnit);

        JSROOT.redraw(this.graphRef.current, toDraw, opts)

    }

    refreshGraph() {
        JSROOT.resize(this.graphRef.current)
    }

    componentDidMount() {
        window.addEventListener('resize', this.refreshGraph.bind(this))
        const { energies, dataSeries, stoppingPowerUnit, previewSeries } = this.props

        const toDraw = createMultigraphFromDataSeries(energies, previewSeries, dataSeries, stoppingPowerUnit)
        JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
    }

    render() {
        return (
            <div>
                <div style={{ width: "100%", height: '35vw', minHeight: '400px' }} ref={this.graphRef}></div>
            </div>
        )
    }
}