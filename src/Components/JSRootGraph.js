import { useRef } from "react";

let JSROOT
//#region Helper functions

function createTGraphFromTrace(trace) {
    return JSROOT.createTGraph(trace.y.length,trace.x,trace.y)
}

function createMultigraphFromProps(traces) {
    return JSROOT.createTMultiGraph(...(traces.map(createTGraphFromTrace)));
}

//#endregion Helper functions

// COMPONENT

const JSRootGraph = props => {
    JSROOT = window.JSROOT;

    const ref = useRef(null);

    if(props.traces.length !== 0){
        const toDraw = createMultigraphFromProps(props.traces);
        JSROOT.draw(ref.current,toDraw,"",_=>console.log("drawing complete"))
    }

    return (
        <div>
            Hello graph
            <div ref={ref}></div>
        </div>
    )
}

export default JSRootGraph;