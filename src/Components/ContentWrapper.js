import { Component } from "react";
import makeAsyncScriptLoader from "react-async-script";
import JSRootGraph from "./JSRootGraph";



const JSRootLink = 'https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends Component {
    constructor(props) {
        super(props);

        this.state = {
            ready: false,
            traces: []
        }

        this.submithandler = this.submitHandler.bind(this);
    }

    shouldComponentUpdate(_) {
        return !this.props.JSROOT
    }


    static getDerivedStateFromProps(props, _) {
        if (props.JSROOT) {
            console.log("ready");
            return {
                ready: true
            }
        }
        return null;

    }

    //TODO
    submitHandler() {
        this.setState(state => ({
            traces: state.traces.append([]/*Incomming data*/)
        }))
    }

    render() {
        return (
            <div className="content">
                {
                    this.state.ready
                        ? <JSRootGraph traces = {this.state.traces} />
                        : <div>JSROOT still loading</div>
                }
            </div>
        )
    }
}



export default makeAsyncScriptLoader(JSRootLink, {
    globalName: "JSROOT"
})(ContentWrapper);