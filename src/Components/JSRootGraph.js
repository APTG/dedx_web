import { Component, createRef } from "react";

let JSROOT
//#region Helper functions

function createTGraphFromTrace(trace) {
    return JSROOT.createTGraph(trace.y.length, trace.x, trace.y)
}

function createMultigraphFromProps(traces) {
    return JSROOT.createTMultiGraph(...(traces.map(createTGraphFromTrace)));
}

//#endregion Helper functions

// COMPONENT

class JSRootGraph extends Component {

    static traces = 0;

    constructor(props) {
        super(props);   
        this.graphRef = createRef(null);

        this.state = {
            traces: [],
            drawn: false
        }

        JSROOT = window.JSROOT;
    }

    static getDerivedStateFromProps(props, state) {
        return {
            traces: props.traces,
            drawn: props.traces.length===JSRootGraph.traces
        }
    }

    componentDidMount() {
        if (this.props.traces.length !== 0) {
            const toDraw = createMultigraphFromProps(this.props.traces);
            JSROOT.draw(this.graphRef.current, toDraw, "logx;logy")
        }
    }



    shouldComponentUpdate(nextProps, nextState) {
        if (!nextState.drawn) {
            const toDraw = createMultigraphFromProps(nextState.traces);
            JSROOT.draw(this.graphRef.current, toDraw, "logx;logy")
                .then(_ => {
                    JSRootGraph.traces = nextProps.traces.length;
                    this.setState({
                        drawn: true
                    })
                });

        }
        return !nextState.drawn;
    }

    render() {
        return (
            <div>
                Hello graph
                <div style={{ width: 640, height: 480 }} ref={this.graphRef}></div>
            </div>

        )
    }
}

export default JSRootGraph;