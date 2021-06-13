import { Component } from "react";
import makeAsyncScriptLoader from "react-async-script";
import Form from "./Form";
import JSRootGraph from "./JSRootGraph";

import JSRootGraph from "./JSRootGraph";



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

    shouldComponentUpdate(_) {
        return !this.props.JSROOT
    }

    static getDerivedStateFromProps(props,_){
        if(props.JSROOT){
            return{
                ready: true,
                traces:[]
            }
        }
        return { ready: false,
            traces:[]};
    }

    //TODO
    submitHandler(message){
        console.log(message);
        console.log(this);
        this.setState(state=>({
            traces: state.traces.concat([]/*Incomming data*/)
        }))
    }

    render() {
        return (
            <div className="content">
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