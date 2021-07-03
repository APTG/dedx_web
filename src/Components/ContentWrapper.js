import React,{ Component } from "react";
import makeAsyncScriptLoader from "react-async-script";
import Form from "./Form";
import JSRootGraph from "./JSRootGraph";

import { getTrace } from '../Backend/WASMWrapper'

const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends Component {
    constructor(props) {
        super(props);

        this.state = {
            ready: false,
            traces: [],
            logx: false,
            logy: true,
            line: true
        }

        this.submitHandler = this.submitHandler.bind(this);
    }

    shouldComponentUpdate(_, nextState) {
        return !this.props.JSROOT 
        || this.state.traces.length !== nextState.traces.length
        || this.state.logx !== nextState.logx
        || this.state.logy !== nextState.logy
        || this.state.line !== nextState.line

    }

    static getDerivedStateFromProps(props, state) {
        return {
            ready: props.JSROOT ? true : false,
            traces: state.traces,
            logx: state.logx,
            logy: state.logy,
            line: state.line,
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

        console.log("rerender wrapper");

        return (
            <div className="content gridish">
                <div>
                    <Form onSubmit={this.submitHandler} />
                    <form onChange={_=>{}} className="radio-container">
                        <div className="radio-group">
                            <div  className="radio-label">X</div>
                            <div>
                                <label>
                                    <input onClick={_=>this.setState({logx:false})} type="radio" name="xAxis" />
                                    <span className="radio">Linear</span>
                                </label>
                                <label>
                                    <input onClick={_=>this.setState({logx:true})} type="radio" name="xAxis" />
                                    <span className="radio">Logarithmic</span>
                                </label>
                            </div>
                        </div >
                        <div className="radio-group">
                            <div className="radio-label">Y</div>
                            <div>
                                <label>
                                    <input onClick={_=>this.setState({logy:false})} type="radio" name="yAxis" />
                                    <span className="radio">Linear</span>

                                </label>
                                <label>
                                    <input onClick={_=>this.setState({logy:true})} type="radio" name="yAxis" />
                                    <span className="radio">Logarithmic</span>
                                </label>
                            </div>
                        </div >
                        <div className="radio-group">
                            <div className="radio-label">Plot as</div>
                            <div>
                                <label>
                                    <input onClick={_=>this.setState({line:false})} type="radio" name="plotType" />
                                    <span className="radio">Points</span>
                                </label>
                                <label>
                                    <input onClick={_=>this.setState({line:true})} type="radio" name="plotType" />
                                    <span className="radio">Line</span>
                                </label>
                            </div>
                        </div >

                    </form>

                </div>
                {
                    this.state.ready
                        ? <JSRootGraph traces={this.state.traces} logx={this.state.logx} logy={this.state.logy} line={this.state.line} />
                        : <h2>JSROOT still loading</h2>
                }
            </div>
        )
    }
}




export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);