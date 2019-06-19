import React, { Component } from 'react';
import './MainPage.css';
import Form from "../Form/Form";
import Plot from "../Plot/Plot";
import Result from "../Result/Result";
import History from "../History/History";

class MainPage extends Component {

    render() {
        return(
            <div className="MainPage">
                <p>MainPage component works!</p>
                <Form/>
                <Plot/>
                <Result/>
                <History/>
            </div>
        )
    }
}

export default MainPage;