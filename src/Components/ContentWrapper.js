import { Component } from "react";
import makeAsyncScriptLoader from "react-async-script";



const JSRootLink ='https://root.cern.ch/js/latest/scripts/JSRoot.core.js';

class ContentWrapper extends Component{
    constructor(props){
        super(props);

        this.state = {
            ready:false,
            traces:[]
        }

        this.submithandler = this.submitHandler.bind(this);
    }

    shouldComponentUpdate(_){
        return !this.props.JSROOT
    }

    //TODO
    submitHandler(){
        this.setState(state=>({
            traces: state.traces.append([]/*Incomming data*/)
        }))
    }

    render(){
        if(this.props.JSROOT) console.log("ready")
        return(
            <div className="content">
                {
                    /*
                    <Form/>
                    <Graph/>
                    */
                }
            </div>
        )
    }
}



export default makeAsyncScriptLoader(JSRootLink,{
    globalName:"JSROOT"
})(ContentWrapper);