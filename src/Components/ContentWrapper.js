import { Component } from "react";
import makeAsyncScriptLoader from "react-async-script";
import Form from "./Form";
import JSRootGraph from "./JSRootGraph";

import { getTrace } from '../Backend/WASMWrapper'
import Toggle from "./Toggle";

const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';




class ContentWrapper extends Component {

    onXAxisStateChange(newState){
        this.setState({logx:newState})
    }
    
    onYAxisStateChange(newState){
        this.setState({logy:newState})
    }
    
    onPlottingMethodChange(newState){
        this.setState({plotStyle:newState})
    }

    constructor(props) {
        super(props);

        this.state = {
            ready: false,
            traces: [],
            logx: 0,
            logy: 1,
            plotStyle: 0,
        }

        this.submitHandler = this.submitHandler.bind(this);
    }

    shouldComponentUpdate(_, nextState) {
        return !this.props.JSROOT 
        || this.state.traces.length !== nextState.traces.length
        || this.state.logx !== nextState.logx
        || this.state.logy !== nextState.logy
        || this.state.plotStyle !== nextState.plotStyle

    }

    static getDerivedStateFromProps(props, state) {
        return {
            ready: props.JSROOT ? true : false,
            traces: state.traces,
            logx: state.logx,
            logy: state.logy,
            plotStyle: state.plotStyle,
        };
    }

    //TODO
    submitHandler(message) {
        console.log(message);
        const traces = this.state.traces;
        traces.push(getTrace(message, ""));
        this.setState({
            traces: traces
        })
        this.forceUpdate();

    }

    render() {
        return (
            <div className="content gridish">
                <div>
                    <Form onSubmit={this.submitHandler} />
                    <Toggle onChange={this.onXAxisStateChange.bind(this)} name={"X Axis:"} startValue={this.state.logx}>
                        <>Linear</>
                        <>Logarithmic</>
                    </Toggle>
                    <Toggle onChange={this.onYAxisStateChange.bind(this)} name={"Y Axis"} startValue={this.state.logy}>
                        <>Linear</>
                        <>Logarithmic</>
                    </Toggle>
                    <Toggle onChange={this.onPlottingMethodChange.bind(this)} name={"Plotting Method:"} startValue={this.state.line}>
                        <>Line</>
                        <>Points</>
                    </Toggle>
                </div>
                {
                    this.state.ready
                        ? <JSRootGraph traces={this.state.traces} logx={this.state.logx} logy={this.state.logy} plotStyle={this.state.plotStyle} />
                        : <h2>JSROOT still loading</h2>
                }
            </div>
        )
    }
}




export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);