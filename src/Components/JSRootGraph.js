import React, { createRef } from "react";
import PropTypes from 'prop-types';

let JSROOT
//#region Helper functions

function createTGraphFromTrace(trace) {
    return JSROOT.createTGraph(trace.y.length, trace.x, trace.y)
}

function createMultigraphFromProps(traces) {
    return JSROOT.createTMultiGraph(...(traces.map(createTGraphFromTrace)));
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

    static traces = 0;

    static propTypes = {
        xAxis: PropTypes.oneOf([0, 1]).isRequired,
        yAxis: PropTypes.oneOf([0, 1]).isRequired,
        plotStyle: PropTypes.oneOf([0, 1]).isRequired,
        traces: PropTypes.arrayOf(
            PropTypes.shape({
                x: PropTypes.arrayOf(PropTypes.number),
                y: PropTypes.arrayOf(PropTypes.number)
            })
        ).isRequired
    }

    constructor(props) {
        super(props);
        this.graphRef = createRef(null);

        this.state = {
            traces: [],
            drawn: false
        }

        JSROOT = window.JSROOT;
    }

    static getDerivedStateFromProps(props, _) {
        return {
            traces: props.traces,
            drawn: props.traces.length === JSRootGraph.traces
        }
    }

    refreshGraph(){
            JSROOT.resize(this.graphRef.current)
    }

    componentDidMount() {
        window.addEventListener('resize', this.refreshGraph.bind(this))

        if (this.props.traces.length !== 0) {
            const toDraw = createMultigraphFromProps(this.props.traces);
            JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
        }
        else {
            JSROOT.draw(this.graphRef.current, JSROOT.createTGraph(1))
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        const should = !nextState.drawn
            || ['xAxis', 'yAxis', 'plotStyle'].some(el => this.props[el] !== nextProps[el])

        if (should) {
            JSROOT.cleanup(this.graphRef.current);
            const toDraw = createMultigraphFromProps(nextState.traces);
            const opts = drawOptFromProps(nextProps);
            JSROOT.draw(this.graphRef.current, toDraw, opts)
                .then(_ => {
                    JSRootGraph.traces = nextProps.traces.length;
                    this.setState({
                        drawn: true
                    })
                });
            return true;
        }
        return false;
    }

    render() {
        return (
            <div>
                <div style={{ width: "100%", height: 480 }} ref={this.graphRef}></div>
            </div>
        )
    }
}