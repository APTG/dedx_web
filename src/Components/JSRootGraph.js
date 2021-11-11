import React, { createRef } from "react";
import PropTypes from 'prop-types';
import { Component } from "react";

let JSROOT
//#region Helper functions

function createTGraphFromTrace(trace) {
    return JSROOT.createTGraph(trace.y.length, trace.x, trace.y)
}

function createMultigraphFromTraces(traces) {
    const tGraphs = JSROOT.createTMultiGraph(
        ...(
            traces
                .filter(trace => trace.isShown)
                .map(createTGraphFromTrace)
        )
    );

    return tGraphs.length !== 0 ? tGraphs : JSROOT.createTGraph(1)
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

    render() {
        return (
            <div>
                <div style={{ width: "100%", height: 480 }} ref={this.graphRef}></div>
            </div>
        )
    }
}