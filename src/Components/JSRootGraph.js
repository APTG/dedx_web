import React, { createRef } from "react";
import PropTypes from 'prop-types';
import DataSeriesList from "./DataSeriesList";

let JSROOT
//#region Helper functions

function createTGraphFromDataSeries(dataSeries) {
    const tgraph = JSROOT.createTGraph(
        dataSeries.energies.length,
        dataSeries.energies,
        dataSeries.stoppingPowers
    )
    //console.log(tgraph)
    tgraph.fLineColor = dataSeries.index + 1
    tgraph.fLineWidth = 2
    tgraph.fMarkerSize = 1
    //tgraph.fMarkerStyle = 8
    // line below the comment sets kNotEditable bit (no 18) which disables graph dragging
    // kNotEditable is defined in TGraph class in ROOT project: https://github.com/root-project/root/blob/v6-25-01/hist/hist/inc/TGraph.h#L72
    tgraph.InvertBit(JSROOT.BIT(18))

    return tgraph
}

function createMultigraphFromDataSeries(dataSeries) {
    const filtered = dataSeries
        .filter(dataSeries => dataSeries.isShown)
        .map(createTGraphFromDataSeries)

    const res = filtered.length !== 0
        ? JSROOT.createTMultiGraph(...filtered)
        : JSROOT.createTGraph(1)

    if (res) res.fTitle = ""
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

    static propTypes = {
        xAxis: PropTypes.oneOf([0, 1]).isRequired,
        yAxis: PropTypes.oneOf([0, 1]).isRequired,
        gridlines: PropTypes.oneOf([0, 1]).isRequired,
        dataSeries: PropTypes.arrayOf(
            PropTypes.shape({
                isShown: PropTypes.bool,
                name: PropTypes.string,
                x: PropTypes.arrayOf(PropTypes.number),
                y: PropTypes.arrayOf(PropTypes.number)
            })
        ).isRequired
    }

    constructor(props) {
        super(props);
        this.graphRef = createRef(null);

        this.state = {
            dataSeries: props.dataSeries
        }

        JSROOT = window.JSROOT;
        this.onDataSeriesStateChange = this.onDataSeriesStateChange.bind(this)
    }

    static getDerivedStateFromProps({ dataSeries }, _) {
        return {
            dataSeries: dataSeries
        }
    }

    getSnapshotBeforeUpdate() {
        JSROOT.cleanup(this.graphRef.current);
        const toDraw = createMultigraphFromDataSeries(this.state.dataSeries);
        const opts = drawOptFromProps(this.props);

        return { toDraw, opts }
    }

    componentDidUpdate(_, __, snapshot) {
        JSROOT.draw(this.graphRef.current, snapshot.toDraw, snapshot.opts)
    }

    refreshGraph() {
        JSROOT.resize(this.graphRef.current)
    }

    componentDidMount() {
        window.addEventListener('resize', this.refreshGraph.bind(this))

        const toDraw = createMultigraphFromDataSeries(this.props.dataSeries)
        JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
    }

    onDataSeriesStateChange(event) {
        let index = (Number)(event.target.id)
        let dataSeries = this.state.dataSeries.slice(0)
        dataSeries[index].isShown = !dataSeries[index].isShown
        this.setState({ dataSeries })
    }

    render() {
        return (
            <div>
                <div style={{ width: "100%", height: '40vw', minHeight: '400px' }} ref={this.graphRef}></div>
                <DataSeriesList dataSeries={this.state.dataSeries} onDataSeriesStateChange={this.onDataSeriesStateChange} />
            </div>
        )
    }
}