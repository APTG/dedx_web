import React,{ Component, createRef } from "react";
import PropTypes from 'prop-types';

let JSROOT
//#region Helper functions

function createTGraphFromTrace(trace) {
    return JSROOT.createTGraph(trace.y.length, trace.x, trace.y)
}

function createMultigraphFromProps(traces) {
    return JSROOT.createTMultiGraph(...(traces.map(createTGraphFromTrace)));
}

function drawOptFromProps(props){
    const res = [];
    if(props.logx === 1) res.push("logx");
    if(props.logy === 1) res.push("logy");
    if(props.plotStyle === 1) res.push("P");

    return res.join(';');
}

//#endregion Helper functions

// COMPONENT

class JSRootGraph extends Component {

    static traces = 0;

    static propTypes = {
        logx: PropTypes.oneOf([0, 1]).isRequired,
        logy: PropTypes.oneOf([0, 1]).isRequired,
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
            drawn: props.traces.length===JSRootGraph.traces
        }
    }

    componentDidMount() {
        if (this.props.traces.length !== 0) {
            const toDraw = createMultigraphFromProps(this.props.traces);
            JSROOT.draw(this.graphRef.current, toDraw, drawOptFromProps(this.props))
        }
        else{
            JSROOT.draw(this.graphRef.current,JSROOT.createTGraph(1))
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        const should =!nextState.drawn
        || ['logx','logy','plotStyle'].some(el=>this.props[el] !== nextProps[el])

        if (should) {
            JSROOT.cleanup(this.graphRef.current);
            const toDraw = createMultigraphFromProps(nextState.traces);
            const opts = drawOptFromProps(nextProps);
            console.log(opts);
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

export default JSRootGraph;