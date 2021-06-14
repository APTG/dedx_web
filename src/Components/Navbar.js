import React from 'react'
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';

import "../Styles/Router.css"
import Energy from './Pages/Energy';
import EnergySingle from './Pages/EnergySingle';
import Power from './Pages/Power';
import PowerSingle from './Pages/PowerSingle';
import Home from './Pages/Home';


class Navbar extends React.Component{

    render(){
        return(
            <Router>
                <div className="navbar">
                    <Link className="logo" to={"/"}>dEdx</Link>
                    <Link to={"/"}>Home</Link>
                    <Link to={"/energy"}>Energy</Link>
                    <Link to={"/energy/single"}>Single Energy</Link>
                    <Link to={"/power"}>Power</Link>
                    <Link to={"/power/single"}>Single Power</Link>
                </div>
                <Switch>
                    <Route exact path={"/"} component={Home}/>
                    <Route exact path={"/energy"} component={Energy}/>
                    <Route path={"/energy/single"} component={EnergySingle}/>
                    <Route exact path={"/power"} component={Power}/>
                    <Route path={"/power/single"} component={PowerSingle}/>
                </Switch>
            </Router>
        )
    }

}

export default Navbar;