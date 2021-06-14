import { Component } from "react";
import makeAsyncScriptLoader from "react-async-script";
import Form from "./Form";
import JSRootGraph from "./JSRootGraph";

import {getTrace} from '../Backend/WASMWrapper'

const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends Component {
    constructor(props) {
        super(props);

        this.state = {
            ready: false,
            traces: []

        }

        this.submitHandler = this.submitHandler.bind(this);
    }

    shouldComponentUpdate(_, nextState) {
        return !this.props.JSROOT || this.state.traces.length !== nextState.traces.length;
    }

    static getDerivedStateFromProps(props,state){
        if(props.JSROOT){
            return{
                ready: true,
                traces:state.traces
            }
        }
        return { ready: false,
            traces:state.traces};
    }

    //TODO
    submitHandler(message){
        console.log(message);
        const traces = this.state.traces;
        traces.push(getTrace(message,""));
        this.setState({
            traces: traces
        })
        this.forceUpdate();

    }

    render() {

        console.log("rerender wrapper");

        return (
            <div className="content gridish">
                <Form onSubmit = {this.submitHandler} />
                {
                    this.state.ready
                        ? <JSRootGraph traces = {this.state.traces} />
                        : <h2>JSROOT still loading</h2>
                }
            </div>
        )
    }
}




export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);