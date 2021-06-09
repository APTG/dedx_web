import { Component } from "react";

//#region TODO:
import Form from "./Form";
import Graph from "./Graph";
//#endregion

class ContentWrapper extends Component{
    constructor(props){
        super(props);

        this.state = {
            traces:[]
        }

        this.submithandler = this.submitHandler.bind(this);
    }

    //TODO
    submitHandler(){
        this.setState(state=>({
            traces: state.traces.append([]/*Incomming data*/)
        }))
    }

    render(){
        return(
            <div className="content">
                <Form onSubmit={this.submitHandler}/>
                <Graph traces={this.state.traces} />
            </div>
        )
    }
}

export default ContentWrapper;