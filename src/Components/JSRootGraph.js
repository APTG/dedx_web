import React, { createRef } from "react";
import PropTypes from 'prop-types';
import TraceList from "./TraceList";

let JSROOT
//#region Helper functions

function createTGraphFromTrace(trace) {
    const tgraph = JSROOT.createTGraph(trace.y.length, trace.x, trace.y)
    tgraph.fLineColor = trace.index + 1
    tgraph.fLineWidth = 2
    console.log(tgraph)
    return tgraph
}

function createMultigraphFromTraces(traces) {
    const filtered = traces
                .filter(trace => trace.isShown)
                .map(createTGraphFromTrace)

    return filtered.length !== 0 
        ? JSROOT.createTMultiGraph(...filtered) 
        : JSROOT.createTGraph(1)
}

function drawOptFromProps(props) {
    const res = [];
    if (props.xAxis === 1) res.push("logx");
    if (props.yAxis === 1) res.push("logy");
    if (props.plotStyle === 1) res.push("P");

    return res.join(';');
}

//#endregion Helper functions

// COMPONENT

export default class JSRootGraph extends React.Component {

    static propTypes = {
        xAxis: PropTypes.oneOf([0, 1]).isRequired,
        yAxis: PropTypes.oneOf([0, 1]).isRequired,
        plotStyle: PropTypes.oneOf([0, 1]).isRequired,
        traces: PropTypes.arrayOf(
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
            traces: []
        }

        JSROOT = window.JSROOT;
        this.onTraceStateChange = this.onTraceStateChange.bind(this)
    }

    static getDerivedStateFromProps(props, _) {
        return {
            traces: props.traces
        }
    }

    getSnapshotBeforeUpdate(){
        JSROOT.cleanup(this.graphRef.current);
        const toDraw = createMultigraphFromTraces(this.state.traces);
        const opts = drawOptFromProps(this.props);

        return {toDraw,opts}
    }

    componentDidUpdate(_,__,snapshot){
        JSROOT.draw(this.graphRef.current, snapshot.toDraw, snapshot.opts)
    }

    refreshGraph(){
        JSROOT.resize(this.graphRef.current)
    }

    componentDidMount() {
        window.addEventListener('resize', this.refreshGraph.bind(this))

        const toDraw = createMultigraphFromTraces(this.props.traces);
        JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
    }

    onTraceStateChange(event){
        let index = (Number)(event.target.id)
        let traces = [...(this.state.traces)]
        traces[index].isShown = !traces[index].isShown
        this.setState({traces})
    }

    render() {
        return (
            <div>
                <div style={{ width: "100%", height: '40vw', minHeight:'400px' }} ref={this.graphRef}></div>
                <TraceList traces={this.state.traces} onTraceStateChange={this.onTraceStateChange} />
            </div>
        )
    }
}