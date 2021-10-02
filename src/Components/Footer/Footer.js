import { useEffect, useState } from "react";
import logo from './github-logo.png'

import '../../Styles/Footer.css'

function Footer() {

    const [info, setInfo] = useState({})

    const getInfo = () => {
        console.log(window.location)
        fetch('http://' + window.location.host + '/web_dev/config/deploy.json', {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
            .then(res => {
                return res.ok && res.json();
            })
            .then(json => {
                setInfo(json);
            })
            .catch(err => {
                console.log(err)
            })
    }

    useEffect(() => {
        getInfo();
    }, [])

    return (
        <footer className="footer" id="footer">
            <div>dEdx-Web &copy; 2021. Code available at <img alt="github-logo" src={logo} /></div>
            <p>{`commit ${info.commit} released on ${info.date} on brach ${info.branch}`}</p>
        </footer>
    );
}

export default Footer;