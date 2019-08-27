import React, { Component } from 'react';
import './MainPage.css';
import Form from "../Form/Form";
import Plot from "../Plot/Plot";
import Result from "../Result/Result";
import History from "../History/History";

import { Row, Col } from 'antd';

class MainPage extends Component {

    render() {
        return(
            <div className="MainPage">
                <p>MainPage component works!</p>
                <Row gutter={8}>
                    <Col md={8}><Form/></Col>
                    <Col md={16}><Plot/></Col>
                </Row>

                <Row gutter={8}>
                    <Col md={12}><History/></Col>
                    <Col md={12}><Result/></Col>
                </Row>
            </div>
        )
    }
}

export default MainPage;